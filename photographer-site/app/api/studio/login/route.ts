import {json,sameOrigin,checkPassword,sessionToken,limit} from '@/lib/server';
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'请求来源无效。'},403);
 try{if(!await limit(request,'login',10,15*60*1000))return json({error:'尝试次数较多，请 15 分钟后再试。'},429);
 const {password}=await request.json() as {password?:unknown};if(typeof password!=='string'||password.length>200||!await checkPassword(password))return json({error:'工作台口令不正确。'},401);
 const response=json({ok:true});response.headers.set('Set-Cookie','studio_session='+await sessionToken()+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800'+(new URL(request.url).protocol==='https:'?'; Secure':''));return response;
 }catch{return json({error:'工作台暂时无法连接，请稍后重试。'},503);}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return json({error:'请求来源无效。'},403);const response=json({ok:true});response.headers.set('Set-Cookie','studio_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');return response;}
