import {existingVisitor,visitorForList} from '@/lib/visitor';
import {storage,json,sameOrigin,imageMime} from '@/lib/storage';
import {maybeSyncApi} from '@/lib/platform-sync';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const synced=await maybeSyncApi(request);if(synced)return synced;
 try{const visitor=await visitorForList(request);const {db}=storage();const rows=await db.prepare('SELECT id, slot, occurred_at AS occurredAt, content FROM memories WHERE user_id = ? ORDER BY slot').bind(visitor.id).all();
 const pics=await db.prepare('SELECT id, memory_id AS memoryId FROM photos WHERE user_id = ? ORDER BY position').bind(visitor.id).all();
 const response=json({memories:rows.results.map(row=>({...row,photos:pics.results.filter(p=>p.memoryId===row.id).map(p=>'/api/photos/'+p.id)}))});
 if(visitor.cookie)response.headers.set('Set-Cookie',visitor.cookie);
 return response;
 }catch(error){console.error('load memories',error);return json({error:'星图暂时没有加载成功，请重试。'},503)}
}
export async function POST(request:Request){
 const synced=await maybeSyncApi(request);if(synced)return synced;
 if(!sameOrigin(request))return json({error:'请求来源无效。'},403);
 const visitorId=await existingVisitor(request);if(!visitorId)return json({error:'请刷新星图后重试。'},428);
 if(Number(request.headers.get('content-length')||0)>26*1024*1024)return json({error:'照片过大，请减少照片后重试。'},413);
 const keys:string[]=[];let committed=false;
 try{
 const {db,bucket}=storage();const form=await request.formData();const id=String(form.get('id')||'');const slot=Number(form.get('slot'));const occurredAt=String(form.get('occurredAt')||'');const content=String(form.get('content')||'').trim();
 const files=form.getAll('photos').filter((v):v is File=>v instanceof File&&v.size>0);
 if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isInteger(slot)||slot<0||slot>99999||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(occurredAt)||!Number.isFinite(Date.parse(occurredAt))||content.length>10000||(!content&&!files.length)||files.length>6)return json({error:'请填写有效时间，并添加文字或照片；最多 6 张照片、10000 字。'},400);
 const calendar=new Date(occurredAt+'Z');if(calendar.toISOString().slice(0,16)!==occurredAt)return json({error:'请选择有效日期。'},400);
 const existing=await db.prepare('SELECT id FROM memories WHERE id=? AND user_id=?').bind(id,visitorId).first();if(existing)return json({id},200);
 const occupied=await db.prepare('SELECT id FROM memories WHERE user_id=? AND slot=?').bind(visitorId,slot).first();if(occupied)return json({error:'这颗星已被另一条回忆点亮，请返回星图选择一颗新星。'},409);
 const photoData=[];
 for(const [position,file] of files.entries()){
 if(file.size>4*1024*1024)return json({error:'单张照片不能超过 4 MB，请使用较小的照片。'},400);
 const bytes=new Uint8Array(await file.arrayBuffer());const mime=imageMime(bytes);if(!mime||mime!==file.type)return json({error:'仅支持 JPG、PNG 和 WebP 照片。'},400);
 photoData.push({id:crypto.randomUUID(),position,bytes,mime});
 }
 const statements=[db.prepare('INSERT INTO memories (id,user_id,slot,occurred_at,content,created_at) VALUES (?,?,?,?,?,?)').bind(id,visitorId,slot,occurredAt,content,new Date().toISOString())];
 for(const p of photoData){const key=crypto.randomUUID();await bucket.put(key,p.bytes,{httpMetadata:{contentType:p.mime}});keys.push(key);statements.push(db.prepare('INSERT INTO photos (id,memory_id,user_id,object_key,mime,position) VALUES (?,?,?,?,?,?)').bind(p.id,id,visitorId,key,p.mime,p.position));}
 await db.batch(statements);committed=true;return json({id},201);
 }catch(error){console.error('save memory',error);return json({error:'没有保存成功，输入仍保留在此页。请检查网络后重试。'},503)}
 finally{if(!committed&&keys.length){try{await storage().bucket.delete(keys)}catch(error){console.error('cleanup upload',error)}}}
}

export async function PATCH(request:Request){
 const synced=await maybeSyncApi(request);if(synced)return synced;
 if(!sameOrigin(request))return json({error:'请求来源无效。'},403);
 const visitorId=await existingVisitor(request);if(!visitorId)return json({error:'请刷新星图后重试。'},428);
 if(Number(request.headers.get('content-length')||0)>26*1024*1024)return json({error:'照片过大，请减少照片后重试。'},413);
 const keys:string[]=[];let committed=false;
 try{
  const {db,bucket}=storage(),form=await request.formData();
  const id=String(form.get('id')||''),occurredAt=String(form.get('occurredAt')||''),content=String(form.get('content')||'').trim();
  let retained:unknown;try{retained=JSON.parse(String(form.get('retainedPhotos')||'[]'))}catch{return json({error:'照片列表格式无效。'},400)}
  const files=form.getAll('photos').filter((v):v is File=>v instanceof File&&v.size>0);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!Array.isArray(retained)||retained.some(p=>typeof p!=='string')||new Set(retained).size!==retained.length||retained.length+files.length>6||content.length>10000||(!content&&!retained.length&&!files.length)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(occurredAt)||!Number.isFinite(Date.parse(occurredAt)))return json({error:'请填写有效时间，并保留文字或照片；最多 6 张照片、10000 字。'},400);
  if(new Date(occurredAt+'Z').toISOString().slice(0,16)!==occurredAt)return json({error:'请选择有效日期。'},400);
  const memory=await db.prepare('SELECT id FROM memories WHERE id=? AND user_id=?').bind(id,visitorId).first();
  if(!memory)return json({error:'这段回忆不存在，或你无权编辑。'},404);
  const existing=await db.prepare('SELECT id,object_key FROM photos WHERE memory_id=? AND user_id=? ORDER BY position').bind(id,visitorId).all<{id:string;object_key:string}>();
  if(retained.some(url=>!existing.results.some(p=>url==='/api/photos/'+p.id)))return json({error:'照片已发生变化，请重新打开回忆后编辑。'},409);
  const photoData=[];
  for(const file of files){
   if(file.size>4*1024*1024)return json({error:'单张照片不能超过 4 MB。'},400);
   const bytes=new Uint8Array(await file.arrayBuffer()),mime=imageMime(bytes);
   if(!mime||mime!==file.type)return json({error:'仅支持 JPG、PNG 和 WebP 照片。'},400);
   photoData.push({id:crypto.randomUUID(),bytes,mime});
  }
  const removed=existing.results.filter(p=>!retained.includes('/api/photos/'+p.id));
  const statements=[db.prepare('UPDATE memories SET occurred_at=?,content=? WHERE id=? AND user_id=?').bind(occurredAt,content,id,visitorId)];
  for(const p of removed)statements.push(db.prepare('DELETE FROM photos WHERE id=? AND memory_id=? AND user_id=?').bind(p.id,id,visitorId));
  for(const [position,url] of retained.entries())statements.push(db.prepare('UPDATE photos SET position=? WHERE id=? AND memory_id=? AND user_id=?').bind(position,url.slice('/api/photos/'.length),id,visitorId));
  for(const [index,p] of photoData.entries()){
   const key=crypto.randomUUID();await bucket.put(key,p.bytes,{httpMetadata:{contentType:p.mime}});keys.push(key);
   statements.push(db.prepare('INSERT INTO photos (id,memory_id,user_id,object_key,mime,position) VALUES (?,?,?,?,?,?)').bind(p.id,id,visitorId,key,p.mime,retained.length+index));
  }
  await db.batch(statements);committed=true;
  // Only remove replaced objects once all record and photo changes have committed.
  if(removed.length)try{await bucket.delete(removed.map(p=>p.object_key))}catch(error){console.error('cleanup replaced photos',error)}
  return json({id});
 }catch(error){console.error('edit memory',error);return json({error:'修改没有保存成功，输入仍保留在此页，请重试。'},503)}
 finally{if(!committed&&keys.length)try{await storage().bucket.delete(keys)}catch(error){console.error('cleanup edit upload',error)}}
}
