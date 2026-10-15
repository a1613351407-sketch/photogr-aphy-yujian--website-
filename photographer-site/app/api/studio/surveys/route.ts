import {feishuConfigured} from '@/lib/feishu';
import {emailConfigured} from '@/lib/email';
import {EMAIL_RECIPIENTS} from '@/lib/email-content';
import {getDatabase,getFiles} from '@/db';import {json,isStudio,sameOrigin} from '@/lib/server';
export async function GET(request:Request){if(!await isStudio(request))return json({error:'请先登录摄影师工作台。'},401);
 try{const page=Math.max(0,Math.min(10000,Number(new URL(request.url).searchParams.get('page'))||0));const {results}=await getDatabase().prepare(`SELECT s.*,(SELECT COUNT(*) FROM feishu_deliveries f WHERE f.survey_id=s.id) AS feishu_total,(SELECT COUNT(*) FROM feishu_deliveries f WHERE f.survey_id=s.id AND f.state='sent') AS feishu_sent,(SELECT COUNT(*) FROM feishu_deliveries f WHERE f.survey_id=s.id AND f.state IN ('failed','uncertain')) AS feishu_failed,e.state AS email_state,e.error AS email_error,e.first_attempt_at AS email_first_attempt FROM surveys s LEFT JOIN email_deliveries e ON e.survey_id=s.id ORDER BY s.created_at DESC LIMIT 31 OFFSET ?`).bind(page*30).all();return json({surveys:results.slice(0,30).map(r=>({...r,payload:JSON.parse(String(r.payload)),photos:JSON.parse(String(r.photos)).map((p:{id:string;name:string})=>({id:p.id,name:p.name}))})),hasMore:results.length>30,email:{configured:emailConfigured(),recipients:EMAIL_RECIPIENTS},feishu:{configured:feishuConfigured()}});}catch{return json({error:'问卷暂时无法加载，请重试。'},503);}}
export async function PATCH(request:Request){if(!sameOrigin(request)||!await isStudio(request))return json({error:'请先登录摄影师工作台。'},401);try{const {id,status}=await request.json() as {id:string;status:string};if(typeof id!=='string'||!['new','contacted'].includes(status))return json({error:'无效状态。'},400);await getDatabase().prepare('UPDATE surveys SET status=? WHERE id=?').bind(status,id).run();return json({ok:true});}catch{return json({error:'更新失败，请重试。'},503);}}

type StoredPhoto={key?:unknown};
const surveyIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(request:Request){
 if(!sameOrigin(request))return json({error:'请求来源无效。'},403);
 if(!await isStudio(request))return json({error:'请先登录摄影师工作台。'},401);
 try{
  const body=await request.json() as {ids?:unknown};
  const ids=Array.isArray(body.ids)?[...new Set(body.ids)]:[];
  if(!ids.length||ids.length>100||ids.some(id=>typeof id!=='string'||!surveyIdPattern.test(id)))return json({error:'请选择有效的沟通记录。'},400);
  const placeholders=ids.map(()=>'?').join(',');
  const database=getDatabase();
  const {results}=await database.prepare(`SELECT id,photos FROM surveys WHERE id IN (${placeholders})`).bind(...ids).all<{id:string;photos:string}>();
  if(!results.length)return json({error:'所选沟通记录已不存在。'},404);
  const foundIds=results.map(row=>row.id);
  const foundPlaceholders=foundIds.map(()=>'?').join(',');
  await database.batch([
   database.prepare(`DELETE FROM feishu_deliveries WHERE survey_id IN (${foundPlaceholders})`).bind(...foundIds),
   database.prepare(`DELETE FROM email_deliveries WHERE survey_id IN (${foundPlaceholders})`).bind(...foundIds),
   database.prepare(`DELETE FROM surveys WHERE id IN (${foundPlaceholders})`).bind(...foundIds),
  ]);
  const keys=results.flatMap(row=>{
   try{return (JSON.parse(row.photos) as StoredPhoto[]).map(photo=>photo.key).filter((key):key is string=>typeof key==='string'&&key.length>0);}
   catch{return [];}
  });
  let filesNotRemoved=0;
  if(keys.length){
   const settled=await Promise.allSettled(keys.map(key=>getFiles().delete(key)));
   filesNotRemoved=settled.filter(result=>result.status==='rejected').length;
  }
  return json({deleted:foundIds.length,filesNotRemoved});
 }catch{return json({error:'删除失败，沟通记录仍保留，请重试。'},503);}
}
