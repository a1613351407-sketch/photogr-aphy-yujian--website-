import {startFeishu} from '@/lib/feishu';
import {attachmentName} from '@/lib/email-content';
import {startEmail} from '@/lib/email';
import {getDatabase,getFiles} from '@/db';
import {json,sameOrigin,limit} from '@/lib/server';
import {validateAnswers,imageType,MAX_FILE,MAX_TOTAL} from '@/lib/validation';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'请从问卷页面提交。'},403);
 try{
 if(!await limit(request,'submit',15,3600000))return json({error:'提交次数较多，请稍后再试。'},429);
 const reader=request.body?.getReader();if(!reader)return json({error:'问卷内容为空。'},400);
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_TOTAL+65536){await reader.cancel();return json({error:'照片总大小不能超过 12MB。'},413);}chunks.push(value);}
 const multipart=await new Response(new Blob(chunks as BlobPart[]),{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();
 let answers;try{answers=validateAnswers(JSON.parse(String(multipart.get('answers'))));}catch(e){return json({error:e instanceof Error?e.message:'问卷内容不完整。'},400);}
 const files=multipart.getAll('photos').filter((f):f is File=>f instanceof File);
 if(files.length>6||files.reduce((s,f)=>s+f.size,0)>MAX_TOTAL)return json({error:'最多 6 张照片，总大小不超过 12MB。'},400);
 const types:string[]=[];
 for(const file of files){const type=imageType(new Uint8Array(await file.slice(0,12).arrayBuffer()));if(!type||!file.size||file.size>MAX_FILE)return json({error:'请上传 JPG、PNG 或 WebP 图片，每张不超过 5MB。'},400);types.push(type);}
 const id=crypto.randomUUID();const uploaded:{id:string;key:string;name:string;type:string}[]=[];
 try{
 for(let i=0;i<files.length;i++){const photoId=crypto.randomUUID();const key='references/'+id+'/'+photoId;await getFiles().put(key,await files[i].arrayBuffer(),{httpMetadata:{contentType:types[i]}});uploaded.push({id:photoId,key,name:files[i].name.slice(0,160),type:types[i]});}
 await getDatabase().batch([
 getDatabase().prepare('INSERT INTO surveys (id,name,contact,payload,photos,created_at,status) VALUES (?,?,?,?,?,?,?)').bind(id,answers.name,answers.contact,JSON.stringify(answers),JSON.stringify(uploaded),new Date().toISOString(),'new'),
 getDatabase().prepare('INSERT INTO email_deliveries (survey_id,state,attempts,updated_at) VALUES (?,?,0,?)').bind(id,'pending',Date.now()),
 ...[{filename:'00-玉鉴拍摄沟通单-'+id.slice(0,8)+'.txt',type:'text/plain',key:null},...uploaded.map((photo,index)=>({filename:attachmentName(index,photo.name,photo.type),type:photo.type,key:photo.key}))].map(file=>getDatabase().prepare('INSERT INTO feishu_deliveries (id,survey_id,filename,content_type,source_key,state,updated_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,file.filename,file.type,file.key,'pending',Date.now())),
 ]);
 }catch(e){for(const f of uploaded)await getFiles().delete(f.key).catch(()=>{});throw e;}
 startEmail(id);
 startFeishu(id);
 return json({id,reference:'YJ-'+id.slice(0,8).toUpperCase()},201);
 }catch{return json({error:'暂时无法保存，请稍后重试。你的填写内容仍保留在当前页面。'},503);}
}
