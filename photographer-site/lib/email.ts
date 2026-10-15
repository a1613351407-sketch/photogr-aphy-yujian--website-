import {env,waitUntil} from 'cloudflare:workers';
import {Buffer} from 'node:buffer';
import {getDatabase,getFiles} from '@/db';
import {EMAIL_RECIPIENTS,emailBrief,emailSubject,attachmentName} from './email-content';
import {MailError,sendMail,type MailAttachment} from './email-provider';
import type {Answers} from './options';
export function emailConfigured(){return !!env.RESEND_API_KEY&&!!env.EMAIL_FROM;}
export type EmailRow={survey_id:string;state:string;provider_id:string|null;error:string|null;attempts:number;first_attempt_at:number|null;updated_at:number};
export function startEmail(id:string){try{waitUntil(deliverEmail(id).catch(()=>{}));}catch{/* The durable pending row remains available for retry. */}}
export async function deliverEmail(id:string){
 const db=getDatabase();if(!emailConfigured())return;
 const now=Date.now();
 // A row-level lease prevents simultaneous requests. An uncertain provider result
 // may be retried only inside its 24-hour idempotency window.
 const row=await db.prepare("UPDATE email_deliveries SET state='sending',attempts=attempts+1,updated_at=?,error=NULL WHERE survey_id=? AND state NOT IN ('sent','delivered','bounced') AND (state!='sending' OR updated_at<?) AND (first_attempt_at IS NULL OR first_attempt_at>?) RETURNING *").bind(now,id,now-60000,now-23*3600000).first<EmailRow>();
 if(!row)return;
 let uncertain=row.first_attempt_at!==null;
 try{
 const survey=await db.prepare('SELECT payload,photos FROM surveys WHERE id=?').bind(id).first<{payload:string;photos:string}>();if(!survey)throw new MailError('问卷不存在。');
 const answers=JSON.parse(survey.payload) as Answers;const photos=JSON.parse(survey.photos) as {name:string;key:string;type:string}[];
 const text=emailBrief(id,answers,photos.length);const attachments:MailAttachment[]=[{filename:'拍摄沟通单-'+id.slice(0,8)+'.txt',content:Buffer.from(text,'utf8').toString('base64'),content_type:'text/plain'}];
 for(let i=0;i<photos.length;i++){const photo=photos[i];const object=await getFiles().get(photo.key);if(!object)throw new MailError('参考照片读取失败，问卷已保留，请稍后重试。');attachments.push({filename:attachmentName(i,photo.name,photo.type),content:Buffer.from(await object.arrayBuffer()).toString('base64'),content_type:photo.type});}
 const payload={from:env.EMAIL_FROM!,to:EMAIL_RECIPIENTS,subject:emailSubject(answers.name),text,attachments};
 let providerId='';
 await db.prepare('UPDATE email_deliveries SET first_attempt_at=COALESCE(first_attempt_at,?) WHERE survey_id=?').bind(Date.now(),id).run();
 for(let attempt=0;attempt<2;attempt++){
  try{providerId=await sendMail(env.RESEND_API_KEY!,'yujian-survey/'+id,payload);uncertain=true;break;}catch(e){uncertain ||= e instanceof MailError&&e.uncertain;if(attempt===1||!(e instanceof MailError)||!e.retryable)throw e;await new Promise(resolve=>setTimeout(resolve,1200));}
 }
 await db.prepare("UPDATE email_deliveries SET state='sent',provider_id=?,error=NULL,updated_at=? WHERE survey_id=?").bind(providerId,Date.now(),id).run();
 }catch(e){const error=e instanceof MailError?e.message:'邮件处理失败，问卷与参考照片已保留。';await db.prepare('UPDATE email_deliveries SET state=?,error=?,updated_at=?,first_attempt_at=CASE WHEN ? THEN first_attempt_at ELSE NULL END WHERE survey_id=?').bind(uncertain?'uncertain':'failed',uncertain?'发送结果待确认，请在 23 小时内重试或先核对邮箱。':error,Date.now(),uncertain?1:0,id).run();}
}
export async function deliverySummary(){
 const {results}=await getDatabase().prepare('SELECT state, COUNT(*) AS count FROM email_deliveries GROUP BY state').all<{state:string;count:number}>();
 return {configured:emailConfigured(),recipients:EMAIL_RECIPIENTS,counts:results};
}
