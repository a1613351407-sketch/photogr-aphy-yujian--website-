import {env} from 'cloudflare:workers';
import {browserVisitor} from '@/lib/visitor';
import {storage} from '@/lib/storage';

const CANONICAL_ORIGIN = 'https://yujian-stars.netlify.app';
const CHUNK_SIZE = 2 * 1024 * 1024;

function enabled() {
  // Local previews keep their local D1/R2. The hosted Site opts in explicitly.
  return (env as unknown as {STAR_SYNC_ORIGIN?:string}).STAR_SYNC_ORIGIN === CANONICAL_ORIGIN;
}

function sessionCookie(request:Request) {
  return request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>/^star_session=[a-f0-9]{64}$/.test(value))??null;
}

function replaceSessionCookie(request:Request,newSession:string){
  return [...(request.headers.get('cookie')??'').split(';').map(value=>value.trim()).filter(value=>value&&!value.startsWith('star_session=')),newSession].join('; ');
}

function remoteHeaders(request:Request,cookie?:string) {
  const headers=new Headers(request.headers);
  for(const name of ['host','content-length','origin','referer','cf-connecting-ip','x-forwarded-host','x-forwarded-proto'])headers.delete(name);
  headers.set('Origin',CANONICAL_ORIGIN);
  if(cookie)headers.set('Cookie',cookie);
  return headers;
}

function mutableResponse(response:Response){
  // Vinext adds route cache headers, which a fetch() response's immutable
  // header guard rejects. Copy the proxied response before handing it back.
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:new Headers(response.headers)});
}

async function remote(request:Request,path=new URL(request.url).pathname,cookie?:string) {
  const headers=remoteHeaders(request,cookie);
  return fetch(CANONICAL_ORIGIN+path,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,redirect:'manual'});
}

async function uploadForm(request:Request,form:FormData,cookie?:string) {
  const files=form.getAll('photos').filter((value):value is File=>value instanceof File&&value.size>0);
  if(!files.length){
    const headers=remoteHeaders(request,cookie);headers.delete('content-type');
    return fetch(CANONICAL_ORIGIN+new URL(request.url).pathname,{method:request.method,headers,body:form,redirect:'manual'});
  }
  const session=await fetch(CANONICAL_ORIGIN+'/api/upload-session',{method:'POST',headers:{Origin:CANONICAL_ORIGIN,Cookie:cookie??request.headers.get('cookie')??''}});
  if(!session.ok)throw new Error('同步照片的上传会话未建立。');
  const uploadCookie=session.headers.get('set-cookie')?.split(';',1)[0];
  if(!uploadCookie)throw new Error('同步照片的上传会话无效。');
  const combined=[cookie??request.headers.get('cookie'),uploadCookie].filter(Boolean).join('; ');
  const uploadId=Date.now()+'-'+crypto.randomUUID();
  for(const [index,file] of files.entries())for(let part=0;part<Math.ceil(file.size/CHUNK_SIZE);part++){
    const response=await fetch(`${CANONICAL_ORIGIN}/api/upload-parts/${uploadId}/${index}/${part}`,{
      method:'PUT',headers:{Origin:CANONICAL_ORIGIN,Cookie:combined,'Content-Type':'application/octet-stream'},
      body:file.slice(part*CHUNK_SIZE,(part+1)*CHUNK_SIZE),
    });
    if(!response.ok)throw new Error('同步照片上传未完成。');
  }
  const payload=new FormData();
  for(const [name,value] of form.entries())if(name!=='photos')payload.append(name,value);
  payload.set('netlifyUpload',uploadId);
  payload.set('netlifyPhotos',JSON.stringify(files.map(file=>({name:file.name,type:file.type,size:file.size}))));
  const headers=remoteHeaders(request,combined);
  headers.delete('content-type');headers.set('x-netlify-chunked','1');
  return fetch(CANONICAL_ORIGIN+new URL(request.url).pathname,{method:request.method,headers,body:payload,redirect:'manual'});
}

async function migrateBrowserMemories(request:Request,newSession:string) {
  const visitor=await browserVisitor(request);
  if(!visitor||!newSession)return;
  const {db,bucket}=storage();
  const records=await db.prepare('SELECT id,slot,occurred_at AS occurredAt,content FROM memories WHERE user_id=? ORDER BY created_at,id').bind(visitor).all<{id:string;slot:number;occurredAt:string;content:string}>();
  if(!records.results.length)return;
  const cookie=replaceSessionCookie(request,newSession);
  const existing=await fetch(CANONICAL_ORIGIN+'/api/memories',{headers:{Cookie:cookie,Origin:CANONICAL_ORIGIN}});
  if(!existing.ok)throw new Error('无法核对已有回忆。');
  const list=(await existing.json() as {memories:Array<{id:string;slot:number}>}).memories;
  const ids=new Set(list.map(item=>item.id)),slots=new Set(list.map(item=>item.slot));
  for(const record of records.results){
    if(ids.has(record.id))continue;
    const photos=await db.prepare('SELECT object_key AS objectKey,mime FROM photos WHERE memory_id=? AND user_id=? ORDER BY position').bind(record.id,visitor).all<{objectKey:string;mime:string}>();
    let slot=record.slot;
    while(slots.has(slot))slot++;
    const form=new FormData();
    form.set('id',record.id);form.set('slot',String(slot));form.set('occurredAt',record.occurredAt);form.set('content',record.content);
    for(const [index,photo] of photos.results.entries()){
      const object=await bucket.get(photo.objectKey);
      if(!object)throw new Error('旧照片暂时无法读取。');
      form.append('photos',new File([await object.arrayBuffer()],`旧照片-${index+1}`,{type:photo.mime}));
    }
    const imported=await uploadForm(new Request(CANONICAL_ORIGIN+'/api/memories',{method:'POST',headers:{Cookie:cookie,Origin:CANONICAL_ORIGIN},body:form}),form,cookie);
    if(!imported.ok)throw new Error('旧回忆暂时无法迁入。');
    ids.add(record.id);slots.add(slot);
  }
}

export async function maybeSyncApi(request:Request):Promise<Response|null>{
  if(!enabled())return null;
  const path=new URL(request.url).pathname;
  const origin=request.headers.get('origin');
  if(!['GET','HEAD'].includes(request.method)&&origin&&origin!==new URL(request.url).origin)
    return Response.json({error:'请求来源无效。'},{status:403,headers:{'Cache-Control':'no-store'}});
  // Anonymous records remain in the original browser until the owner signs in.
  if((path==='/api/memories'||path.startsWith('/api/photos/'))&&!sessionCookie(request))return null;
  try{
    if(path==='/api/memories'&&request.method==='GET'&&sessionCookie(request)){
      try{await migrateBrowserMemories(request,sessionCookie(request)!)}
      catch(error){console.error('legacy memory migration',error);return Response.json({error:'旧回忆暂时无法同步；原记录仍安全保留，请稍后重试。'},{status:503,headers:{'Cache-Control':'no-store'}})}
    }
    const response=path==='/api/memories'&&['POST','PATCH'].includes(request.method)
      ?await uploadForm(request,await request.formData())
      :await remote(request);
    if(response.ok&&['/api/account/login','/api/account/register'].includes(path)&&request.method==='POST'){
      const newSession=response.headers.get('set-cookie')?.split(';',1)[0];
      if(newSession)try{await migrateBrowserMemories(request,newSession)}catch(error){console.error('legacy memory migration',error)}
    }
    return mutableResponse(response);
  }catch(error){console.error('star sync proxy',error);return Response.json({error:'两处星迹暂时无法连接，请稍后重试。'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
