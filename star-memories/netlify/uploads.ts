import type {} from '@netlify/functions';
import {getStore,getDeployStore} from '@netlify/blobs';
const CHUNK=2*1024*1024;
function store(){return Netlify.env.get('CONTEXT')==='production'?getStore({name:'upload-parts',consistency:'strong'}):getDeployStore({name:'upload-parts',consistency:'strong'})}
function token(request:Request){return request.headers.get('cookie')?.match(/(?:^|;\s*)upload_session=([a-f0-9]{64})(?:;|$)/)?.[1]}
async function owner(request:Request){const value=token(request);if(!value)throw new Error('请重新选择照片后重试。');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
function validId(id:string){return /^\d{13}-[a-f0-9-]{36}$/.test(id)&&Math.abs(Date.now()-Number(id.slice(0,13)))<30*60*1000}
function originOK(request:Request){return request.headers.get('origin')===new URL(request.url).origin}
export async function upload(request:Request){
 if(!originOK(request))return Response.json({error:'请求来源无效。'},{status:403});
 const path=new URL(request.url).pathname;
 if(path==='/api/upload-session'&&request.method==='POST'){
  const value=token(request)||Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':`upload_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${new URL(request.url).protocol==='https:'?'; Secure':''}`}});
 }
 const match=path.match(/^\/api\/upload-parts\/([^/]+)\/([0-5])\/([0-2])$/);
 if(request.method!=='PUT'||!match||!validId(match[1]))return Response.json({error:'上传已过期，请重试。'},{status:400});
 if(!token(request))return Response.json({error:'上传会话已过期。'},{status:401});
 if(Number(request.headers.get('content-length')||0)>CHUNK)return Response.json({error:'照片分片过大。'},{status:413});
 const bytes=await request.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>CHUNK)return Response.json({error:'照片分片无效。'},{status:400});
 await store().set(`${match[1]}/${await owner(request)}/${match[2]}/${match[3]}`,bytes);
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
export async function restoreUploads(request:Request,totalMax:number,fileMax:number,handler:(request:Request)=>Promise<Response>){
 if(!request.headers.get('x-netlify-chunked'))return handler(request);
 if(!originOK(request))return Response.json({error:'请求来源无效。'},{status:403});
 const form=await request.formData(),id=String(form.get('netlifyUpload')||'');
 if(!validId(id)||!token(request))return Response.json({error:'上传已过期，请重试。'},{status:400});
 const keys:string[]=[];
 try{
  const files=JSON.parse(String(form.get('netlifyPhotos')||'[]')) as {name:string;type:string;size:number}[];
  if(!Array.isArray(files)||files.length>6||files.some(f=>!f||typeof f.name!=='string'||typeof f.type!=='string'||!Number.isInteger(f.size)||f.size<=0||f.size>fileMax)||files.reduce((n,f)=>n+f.size,0)>totalMax)throw new Error('照片数量或大小超过限制。');
  if(form.getAll('photos').length)throw new Error('上传格式无效。');
  const prefix=`${id}/${await owner(request)}`;
  for(const [index,file] of files.entries()){
   const parts:ArrayBuffer[]=[];
   for(let part=0;part<Math.ceil(file.size/CHUNK);part++){
    const key=`${prefix}/${index}/${part}`;keys.push(key);
    const bytes=await store().get(key,{type:'arrayBuffer'});
    if(!bytes||bytes.byteLength!==Math.min(CHUNK,file.size-part*CHUNK))throw new Error('照片上传不完整，请重试。');
    parts.push(bytes);
   }
   form.append('photos',new File(parts,file.name,{type:file.type}));
  }
  form.delete('netlifyUpload');form.delete('netlifyPhotos');
  const headers=new Headers(request.headers);headers.delete('content-type');headers.delete('content-length');headers.delete('x-netlify-chunked');
  return await handler(new Request(request.url,{method:request.method,headers,body:form}));
 }catch{return Response.json({error:'照片上传不完整或已过期，请重新提交。'},{status:400})}
 finally{await Promise.allSettled(keys.map(key=>store().delete(key)))}
}
export async function cleanup(){
 const {blobs}=await store().list();
 for(const blob of blobs)if(Number(blob.key.slice(0,13))<Date.now()-60*60*1000)await store().delete(blob.key);
}
