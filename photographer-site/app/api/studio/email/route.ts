import {getDatabase} from '@/db';
import {isStudio,json,sameOrigin} from '@/lib/server';
import {emailConfigured,deliverEmail,deliverySummary,type EmailRow} from '@/lib/email';
export async function GET(request:Request){if(!await isStudio(request))return json({error:'请先登录摄影师工作台。'},401);try{return json(await deliverySummary());}catch{return json({error:'邮件状态暂时无法读取。'},503);}}
export async function POST(request:Request){
 if(!sameOrigin(request)||!await isStudio(request))return json({error:'请先登录摄影师工作台。'},401);
 if(!emailConfigured())return json({error:'尚未配置邮件发送授权，问卷与照片仍安全保存在工作台。'},503);
 try{const {surveyId}=await request.json() as {surveyId?:unknown};if(typeof surveyId!=='string'||surveyId.length>100)return json({error:'无效问卷。'},400);
 const row=await getDatabase().prepare('SELECT * FROM email_deliveries WHERE survey_id=?').bind(surveyId).first<EmailRow>();if(!row)return json({error:'此问卷没有待发邮件记录。'},404);
 if(row.first_attempt_at&&row.first_attempt_at<Date.now()-23*3600000&&!['sent','delivered'].includes(row.state))return json({error:'已超过安全重试时限，请先在邮件服务中核对是否发送，以免重复。'},409);
 await deliverEmail(surveyId);const result=await getDatabase().prepare('SELECT state,error,provider_id FROM email_deliveries WHERE survey_id=?').bind(surveyId).first();return json(result);
 }catch{return json({error:'邮件重试失败，客户资料仍保留。'},503);}
}
