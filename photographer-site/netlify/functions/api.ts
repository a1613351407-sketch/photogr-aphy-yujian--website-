import {restoreUploads} from '../uploads';
import type {Config, Context} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {getStore,getDeployStore} from '@netlify/blobs';
import {Buffer} from 'node:buffer';
import {validateAnswers, imageType, MAX_FILE, MAX_TOTAL} from '../../lib/validation';
import type {Answers} from '../../lib/options';
import {EMAIL_RECIPIENTS, attachmentName, emailBrief, emailSubject} from '../../lib/email-content';
import {MailError, sendMail, type MailAttachment} from '../../lib/email-provider';
import {FeishuError, getFeishuToken, sendFeishuFile, uploadFeishuFile, type FeishuRecipientType} from '../../lib/feishu-provider';

type Photo = {id:string; key:string; name:string; type:string};
type EmailRow = {survey_id:string; state:string; provider_id:string|null; error:string|null; attempts:number; first_attempt_at:number|null; updated_at:number};
type FeishuRow = {id:string; survey_id:string; filename:string; content_type:string; source_key:string|null; state:string; file_key:string|null; message_id:string|null; attempts:number; first_attempt_at:number|null; updated_at:number; target:string|null; error:string|null};
const surveyIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const encoder = new TextEncoder();
const photoStore = () => Netlify.env.get('CONTEXT')==='production' ? getStore({name:'yujian-photos', consistency:'strong'}) : getDeployStore({name:'yujian-photos', consistency:'strong'});
const json = (data:unknown, status=200) => Response.json(data, {status, headers:{'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}});
const env = (key:string) => Netlify.env.get(key) || '';
const emailConfigured = () => !!env('RESEND_API_KEY') && !!env('EMAIL_FROM');
const feishuConfigured = () => !!env('FEISHU_APP_ID') && !!env('FEISHU_APP_SECRET') && !!env('FEISHU_RECEIVE_ID') && ['open_id','user_id','union_id'].includes(env('FEISHU_RECEIVE_ID_TYPE') || 'open_id');
const parseJson = <T>(value:unknown):T => typeof value === 'string' ? JSON.parse(value) as T : value as T;
const sameOrigin = (request:Request) => request.headers.get('Origin') === new URL(request.url).origin;
const digest = async (value:string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))).map(x => x.toString(16).padStart(2,'0')).join('');
const sessionKey = () => crypto.subtle.importKey('raw', encoder.encode(env('STUDIO_SECRET')), {name:'HMAC', hash:'SHA-256'}, false, ['sign','verify']);

function briefFor(request:Request, id:string, answers:Answers, count:number) {
  return emailBrief(id, answers, count).replace('https://yujian-photo-studio.a1613351407.chatgpt.site/studio', new URL('/studio', request.url).toString());
}

async function isStudio(request:Request) {
  try {
    const token = request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('studio_session='))?.slice(15);
    if (!token || !env('STUDIO_SECRET')) return false;
    const [expiry, signature] = token.split('.');
    if (!/^\d{13}$/.test(expiry) || !signature || Number(expiry) < Date.now()) return false;
    const bytes = signature.match(/.{2}/g)?.map(v => parseInt(v,16));
    return !!bytes && await crypto.subtle.verify('HMAC', await sessionKey(), new Uint8Array(bytes), encoder.encode(expiry));
  } catch { return false; }
}

async function limit(request:Request, kind:string, max:number, windowMs:number) {
  const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const key = await digest(kind + ':' + ip); const now = Date.now(); const db = getDatabase();
  const rows = await db.sql`INSERT INTO rate_limits (key,count,reset_at) VALUES (${key},1,${now + windowMs}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at < ${now} THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at < ${now} THEN ${now + windowMs} ELSE rate_limits.reset_at END RETURNING count`;
  return Number(rows[0]?.count || 0) <= max;
}

async function login(request:Request) {
  if (request.method === 'DELETE' && !sameOrigin(request)) return json({error:'请求来源无效。'},403);
  if (request.method === 'DELETE') return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json', 'Set-Cookie':'studio_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure'}});
  if (request.method !== 'POST' || !sameOrigin(request)) return json({error:'请求来源无效。'},403);
  if (!await limit(request, 'login', 10, 15 * 60 * 1000)) return json({error:'尝试次数较多，请 15 分钟后再试。'},429);
  const {password} = await request.json() as {password?:unknown};
  if (typeof password !== 'string' || !env('STUDIO_SECRET') || await digest(password) !== await digest(env('STUDIO_SECRET'))) return json({error:'工作台口令不正确。'},401);
  const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', await sessionKey(), encoder.encode(expiry)))).map(x => x.toString(16).padStart(2,'0')).join('');
  return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json', 'Set-Cookie':`studio_session=${expiry}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure`}});
}

async function emailStatus(id:string) {
  const rows = await getDatabase().sql`SELECT state,error,first_attempt_at FROM email_deliveries WHERE survey_id=${id}`;
  return rows[0] || {state:'pending', error:null};
}

async function deliverEmail(request:Request, id:string) {
  if (!emailConfigured()) return emailStatus(id);
  const db = getDatabase(); const now = Date.now();
  const claimed = await db.sql`UPDATE email_deliveries SET state='sending',attempts=attempts+1,updated_at=${now},error=NULL WHERE survey_id=${id} AND state NOT IN ('sent','delivered','bounced') AND (state!='sending' OR updated_at<${now-60000}) AND (first_attempt_at IS NULL OR first_attempt_at>${now-23*60*60*1000}) RETURNING *`;
  const row = claimed[0] as EmailRow | undefined; if (!row) return emailStatus(id);
  let uncertain = row.first_attempt_at !== null;
  try {
    const surveys = await db.sql`SELECT payload,photos FROM surveys WHERE id=${id}`;
    if (!surveys[0]) throw new MailError('问卷不存在。');
    const answers = parseJson<Answers>(surveys[0].payload); const photoList = parseJson<Photo[]>(surveys[0].photos);
    const text = briefFor(request, id, answers, photoList.length);
    const attachments:MailAttachment[] = [{filename:`拍摄沟通单-${id.slice(0,8)}.txt`,content:Buffer.from(text,'utf8').toString('base64'),content_type:'text/plain'}];
    for (let index=0; index<photoList.length; index++) {
      const photo = photoList[index]; const bytes = await photoStore().get(photo.key, {type:'arrayBuffer'});
      if (!bytes) throw new MailError('参考照片读取失败，问卷已保留，请稍后重试。');
      attachments.push({filename:attachmentName(index, photo.name, photo.type),content:Buffer.from(bytes).toString('base64'),content_type:photo.type});
    }
    await db.sql`UPDATE email_deliveries SET first_attempt_at=COALESCE(first_attempt_at,${Date.now()}) WHERE survey_id=${id}`;
    let providerId = '';
    for (let attempt=0; attempt<2; attempt++) {
      try { providerId = await sendMail(env('RESEND_API_KEY'), `yujian-survey/${id}`, {from:env('EMAIL_FROM'),to:EMAIL_RECIPIENTS,subject:emailSubject(answers.name),text,attachments}); uncertain = true; break; }
      catch (error) { uncertain ||= error instanceof MailError && error.uncertain; if (attempt === 1 || !(error instanceof MailError) || !error.retryable) throw error; await new Promise(resolve => setTimeout(resolve,1200)); }
    }
    await db.sql`UPDATE email_deliveries SET state='sent',provider_id=${providerId},error=NULL,updated_at=${Date.now()} WHERE survey_id=${id}`;
  } catch (error) {
    const message = error instanceof MailError ? error.message : '邮件处理失败，问卷与参考照片已保留。';
    await db.sql`UPDATE email_deliveries SET state=${uncertain ? 'uncertain' : 'failed'},error=${uncertain ? '发送结果待确认，请在 23 小时内重试或先核对邮箱。' : message},updated_at=${Date.now()},first_attempt_at=CASE WHEN ${uncertain} THEN first_attempt_at ELSE NULL END WHERE survey_id=${id}`;
  }
  return emailStatus(id);
}

async function feishuSummary(id:string) {
  const rows = await getDatabase().sql`SELECT id,filename,state,error FROM feishu_deliveries WHERE survey_id=${id} ORDER BY filename`;
  return {configured:feishuConfigured(), items:rows, sent:rows.filter(row => row.state === 'sent').length, total:rows.length};
}

async function deliverFeishu(request:Request, surveyId:string) {
  if (!feishuConfigured()) return feishuSummary(surveyId);
  const db = getDatabase(); const surveys = await db.sql`SELECT payload,photos FROM surveys WHERE id=${surveyId}`;
  if (!surveys[0]) return feishuSummary(surveyId);
  const answers = parseJson<Answers>(surveys[0].payload); const photoList = parseJson<Photo[]>(surveys[0].photos);
  const records = await db.sql`SELECT * FROM feishu_deliveries WHERE survey_id=${surveyId} AND state!='sent' ORDER BY filename` as FeishuRow[];
  if (!records.length) return feishuSummary(surveyId);
  let token:string;
  try { token = await getFeishuToken(env('FEISHU_APP_ID'), env('FEISHU_APP_SECRET')); }
  catch { await db.sql`UPDATE feishu_deliveries SET state='failed',error='飞书机器人授权失败，请检查应用配置。',updated_at=${Date.now()} WHERE survey_id=${surveyId} AND state IN ('pending','failed')`; return feishuSummary(surveyId); }
  const recipientType = (env('FEISHU_RECEIVE_ID_TYPE') || 'open_id') as FeishuRecipientType;
  const target = JSON.stringify([env('FEISHU_APP_ID'), recipientType, env('FEISHU_RECEIVE_ID')]);
  const brief = briefFor(request, surveyId, answers, photoList.length); const retryWindow = 55 * 60 * 1000;
  for (const item of records) {
    const now = Date.now();
    if (item.target && item.target !== target) { await db.sql`UPDATE feishu_deliveries SET error='接收账户或机器人配置发生变化，请先核对此前发送记录。' WHERE id=${item.id} AND state!='sent'`; continue; }
    if (item.first_attempt_at && item.first_attempt_at < now - retryWindow) { await db.sql`UPDATE feishu_deliveries SET state='uncertain',error='已超过安全去重时限，请先核对飞书私聊，避免重复发送。' WHERE id=${item.id} AND state!='sent'`; continue; }
    const claim = await db.sql`UPDATE feishu_deliveries SET state='sending',attempts=attempts+1,updated_at=${now},target=COALESCE(target,${target}),error=NULL WHERE id=${item.id} AND state!='sent' AND (state!='sending' OR updated_at<${now-60000}) RETURNING *`;
    const row = claim[0] as FeishuRow | undefined; if (!row) continue;
    let uncertain = row.first_attempt_at !== null;
    try {
      let fileKey = row.file_key;
      if (!fileKey) {
        const bytes = row.source_key ? await photoStore().get(row.source_key, {type:'arrayBuffer'}) : encoder.encode(brief).buffer;
        if (!bytes) throw new FeishuError('参考文件读取失败，问卷仍保存在工作台。');
        fileKey = await uploadFeishuFile(token, row.filename, new Blob([bytes], {type:row.content_type}));
        await db.sql`UPDATE feishu_deliveries SET file_key=${fileKey},updated_at=${Date.now()} WHERE id=${row.id}`;
      }
      await db.sql`UPDATE feishu_deliveries SET first_attempt_at=COALESCE(first_attempt_at,${Date.now()}) WHERE id=${row.id}`;
      const messageId = await sendFeishuFile(token, recipientType, env('FEISHU_RECEIVE_ID'), fileKey, row.id); uncertain = true;
      await db.sql`UPDATE feishu_deliveries SET state='sent',message_id=${messageId},error=NULL,updated_at=${Date.now()} WHERE id=${row.id}`;
    } catch (error) {
      uncertain ||= error instanceof FeishuError && error.uncertain;
      const message = error instanceof FeishuError ? error.message : '飞书文件处理失败，请稍后重试。';
      await db.sql`UPDATE feishu_deliveries SET state=${uncertain ? 'uncertain' : 'failed'},error=${uncertain ? '发送结果待确认，请在 55 分钟内重试或核对飞书私聊。' : message},first_attempt_at=CASE WHEN ${uncertain} THEN first_attempt_at ELSE NULL END,updated_at=${Date.now()} WHERE id=${row.id}`;
    }
  }
  return feishuSummary(surveyId);
}

async function submit(request:Request, context:Context) {
  if (!sameOrigin(request)) return json({error:'请从问卷页面提交。'},403);
  if (!await limit(request,'submit',15,60*60*1000)) return json({error:'提交次数较多，请稍后再试。'},429);
  try {
    const form = await request.formData(); const answers = validateAnswers(JSON.parse(String(form.get('answers'))));
    const files = form.getAll('photos').filter((value):value is File => value instanceof File);
    if (files.length > 6 || files.reduce((total,file) => total + file.size,0) > MAX_TOTAL) return json({error:'最多 6 张照片，总大小不超过 12MB。'},400);
    const id = crypto.randomUUID(); const uploaded:Photo[] = [];
    try {
      for (const file of files) {
        const type = imageType(new Uint8Array(await file.slice(0,12).arrayBuffer()));
        if (!type || !file.size || file.size > MAX_FILE) throw new Error('请上传 JPG、PNG 或 WebP 图片，每张不超过 5MB。');
        const photoId = crypto.randomUUID(); const key = `references/${id}/${photoId}`;
        await photoStore().set(key, await file.arrayBuffer(), {metadata:{contentType:type}});
        uploaded.push({id:photoId,key,name:file.name.slice(0,160),type});
      }
      const db = getDatabase(); const created = new Date().toISOString(); const now = Date.now();
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO surveys (id,name,contact,payload,photos,created_at,status) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)', [id,answers.name,answers.contact,JSON.stringify(answers),JSON.stringify(uploaded),created,'new']);
        await client.query('INSERT INTO email_deliveries (survey_id,state,attempts,updated_at) VALUES ($1,$2,$3,$4)', [id,'pending',0,now]);
        await client.query('INSERT INTO feishu_deliveries (id,survey_id,filename,content_type,source_key,state,attempts,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [crypto.randomUUID(),id,'拍摄沟通单.txt','text/plain',null,'pending',0,now]);
        for (const [index,photo] of uploaded.entries()) await client.query('INSERT INTO feishu_deliveries (id,survey_id,filename,content_type,source_key,state,attempts,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [crypto.randomUUID(),id,attachmentName(index,photo.name,photo.type),photo.type,photo.key,'pending',0,now]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    } catch (error) {
      await Promise.allSettled(uploaded.map(photo => photoStore().delete(photo.key)));
      throw error;
    }
    context.waitUntil(Promise.allSettled([deliverEmail(request,id),deliverFeishu(request,id)]).then(() => undefined));
    return json({id,reference:'YJ-'+id.slice(0,8).toUpperCase()},201);
  } catch (error) { return json({error:error instanceof Error ? error.message : '暂时无法保存，请稍后再试。'},400); }
}

async function studio(request:Request, context:Context) {
  if (!await isStudio(request)) return json({error:'请先登录摄影师工作台。'},401);
  const db = getDatabase(); const url = new URL(request.url); const path = url.pathname;
  if (path === '/api/studio/surveys' && request.method === 'GET') {
    const page = Math.max(0,Number(url.searchParams.get('page')) || 0);
    const rows = await db.sql`SELECT s.*,e.state AS email_state,e.error AS email_error,e.first_attempt_at AS email_first_attempt,(SELECT count(*) FROM feishu_deliveries f WHERE f.survey_id=s.id) AS feishu_total,(SELECT count(*) FROM feishu_deliveries f WHERE f.survey_id=s.id AND f.state='sent') AS feishu_sent,(SELECT count(*) FROM feishu_deliveries f WHERE f.survey_id=s.id AND f.state IN ('failed','uncertain')) AS feishu_failed FROM surveys s LEFT JOIN email_deliveries e ON e.survey_id=s.id ORDER BY s.created_at DESC LIMIT 31 OFFSET ${page*30}`;
    return json({surveys:rows.slice(0,30),hasMore:rows.length>30,email:{configured:emailConfigured(),recipients:EMAIL_RECIPIENTS},feishu:{configured:feishuConfigured()}});
  }
  if (path === '/api/studio/surveys' && request.method === 'PATCH') {
    if (!sameOrigin(request)) return json({error:'请求来源无效。'},403);
    const {id,status} = await request.json() as {id?:string; status?:string}; if (!id || !status || !['new','contacted'].includes(status)) return json({error:'无效状态。'},400);
    await db.sql`UPDATE surveys SET status=${status} WHERE id=${id}`; return json({ok:true});
  }
  if (path === '/api/studio/surveys' && request.method === 'DELETE') {
    if (!sameOrigin(request)) return json({error:'请求来源无效。'},403);
    const body = await request.json() as {ids?:unknown};
    const ids = Array.isArray(body.ids) ? [...new Set(body.ids)] : [];
    if (!ids.length || ids.length > 100 || ids.some(id => typeof id !== 'string' || !surveyIdPattern.test(id))) return json({error:'请选择有效的沟通记录。'},400);
    const rows:{id:string; photos:unknown}[] = [];
    for (const id of ids as string[]) {
      const found = await db.sql`SELECT id,photos FROM surveys WHERE id=${id}`;
      if (found[0]) rows.push({id:String(found[0].id),photos:found[0].photos});
    }
    if (!rows.length) return json({error:'所选沟通记录已不存在。'},404);
    for (const row of rows) {
      await db.sql`DELETE FROM feishu_deliveries WHERE survey_id=${row.id}`;
      await db.sql`DELETE FROM email_deliveries WHERE survey_id=${row.id}`;
      await db.sql`DELETE FROM surveys WHERE id=${row.id}`;
    }
    const keys = rows.flatMap(row => parseJson<Photo[]>(row.photos).map(photo => photo.key).filter(Boolean));
    const settled = await Promise.allSettled(keys.map(key => photoStore().delete(key)));
    return json({deleted:rows.length,filesNotRemoved:settled.filter(result => result.status === 'rejected').length});
  }
  if (path === '/api/studio/email' && request.method === 'POST') {
    if (!sameOrigin(request)) return json({error:'请求来源无效。'},403); const {surveyId} = await request.json() as {surveyId?:string}; if (!surveyId) return json({error:'缺少问卷编号。'},400);
    if (!emailConfigured()) return json({error:'邮件发送尚未配置。'},503); return json(await deliverEmail(request,surveyId));
  }
  if (path === '/api/studio/feishu' && request.method === 'POST') {
    if (!sameOrigin(request)) return json({error:'请求来源无效。'},403); const {surveyId} = await request.json() as {surveyId?:string}; if (!surveyId) return json({error:'缺少问卷编号。'},400);
    if (!feishuConfigured()) return json({error:'飞书机器人尚未配置。'},503); return json(await deliverFeishu(request,surveyId));
  }
  if (path.startsWith('/api/studio/photos/') && request.method === 'GET') {
    const surveyId = context.params.surveyId; const photoId = context.params.photoId; const rows = await db.sql`SELECT photos FROM surveys WHERE id=${surveyId}`;
    const photo = parseJson<Photo[]>(rows[0]?.photos || []).find(item => item.id === photoId); if (!photo) return json({error:'照片不存在。'},404);
    const data = await photoStore().get(photo.key,{type:'arrayBuffer'}); return data ? new Response(data,{headers:{'Content-Type':photo.type,'Cache-Control':'private, no-store'}}) : json({error:'照片不存在。'},404);
  }
  return json({error:'接口不存在。'},404);
}

export default async (request:Request, context:Context) => {
  const path = new URL(request.url).pathname;
  if (path === '/api/surveys' && request.method === 'POST') return restoreUploads(request,MAX_TOTAL,MAX_FILE,req=>submit(req,context));
  if (path === '/api/studio/login') return login(request);
  if (path.startsWith('/api/studio/')) return studio(request,context);
  return json({error:'接口不存在。'},404);
};

export const config:Config = {path:['/api/surveys','/api/studio/login','/api/studio/surveys','/api/studio/email','/api/studio/feishu','/api/studio/photos/:surveyId/:photoId']};
