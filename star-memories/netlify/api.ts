import * as memories from '../app/api/memories/route';
import * as account from '../app/api/account/route';
import * as register from '../app/api/account/register/route';
import * as login from '../app/api/account/login/route';
import * as photo from '../app/api/photos/[id]/route';
import {restoreUploads} from './uploads';

export default async (request:Request) => {
 const path=new URL(request.url).pathname,method=request.method;
 try{
  if(path==='/api/memories'){
   if(method==='GET')return memories.GET(request);
   if(method==='POST'||method==='PATCH')return restoreUploads(request,24*1024*1024,4*1024*1024,req=>memories[method](req));
  }
  if(path==='/api/account'&&method==='GET')return account.GET(request);
  if(path==='/api/account'&&method==='DELETE')return account.DELETE(request);
  if(path==='/api/account/register'&&method==='POST')return register.POST(request);
  if(path==='/api/account/login'&&method==='POST')return login.POST(request);
  if(/^\/api\/photos\/[^/]+$/.test(path)&&method==='GET')return photo.GET(request,{params:Promise.resolve({id:path.split('/').pop()!})});
  return Response.json({error:'接口不存在。'},{status:404});
 }catch{
  return Response.json({error:'服务暂时不可用，请稍后重试。'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
};
export const config={path:['/api/memories','/api/account','/api/account/register','/api/account/login','/api/photos/:id']};
