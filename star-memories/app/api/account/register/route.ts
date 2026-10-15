import {browserVisitor} from '@/lib/visitor';
import {currentAccount,hashPassword,makeSession,rateLimited,sessionCookie} from '@/lib/account';
import {json,sameOrigin,storage} from '@/lib/storage';
import {maybeSyncApi} from '@/lib/platform-sync';
export const dynamic='force-dynamic';

export async function POST(request:Request){
 const synced=await maybeSyncApi(request);if(synced)return synced;
 if(!sameOrigin(request))return json({error:'请求来源无效。'},403);
 if(Number(request.headers.get('content-length')||0)>4096)return json({error:'请求内容过大。'},413);
 try{
  if(await currentAccount(request))return json({error:'请先退出当前账号，再注册新账号。'},409);
  const browserId=await browserVisitor(request);if(!browserId)return json({error:'请刷新星图后重试。'},428);
  if(await rateLimited(request,'register',8))return json({error:'尝试次数过多，请稍后再试。'},429);
  const body=await request.json() as {username?:unknown;password?:unknown;confirmPassword?:unknown};
  const username=typeof body.username==='string'?body.username.trim().normalize('NFKC'):'';
  const password=typeof body.password==='string'?body.password:'';
  if(!/^[\p{L}\p{N}_-]{3,24}$/u.test(username)||Array.from(username).length>24)return json({error:'用户名须为 3–24 个字母、数字、汉字、下划线或短横线。'},400);
  if(password.length<6||password.length>128)return json({error:'密码须为 6–128 个字符。'},400);
  if(password!==body.confirmPassword)return json({error:'两次输入的密码不一致。'},400);
  const usernameKey=username.toLowerCase(),{db}=storage();
  if(await db.prepare('SELECT id FROM accounts WHERE username_key=?').bind(usernameKey).first())return json({error:'这个用户名已被使用。'},409);
  const id=crypto.randomUUID(),now=new Date().toISOString(),passwordHash=await hashPassword(password);
  try{await db.batch([
   db.prepare('INSERT INTO accounts (id,username,username_key,password_hash,created_at) VALUES (?,?,?,?,?)').bind(id,username,usernameKey,passwordHash,now),
   db.prepare('UPDATE memories SET user_id=? WHERE user_id=?').bind('account:'+id,browserId),
   db.prepare('UPDATE photos SET user_id=? WHERE user_id=?').bind('account:'+id,browserId),
  ])}catch(error){if(String(error).includes('UNIQUE'))return json({error:'这个用户名已被使用。'},409);throw error}
  const token=await makeSession(id),response=json({account:{id,username}},201);
  response.headers.set('Set-Cookie',sessionCookie(request,token));return response;
 }catch(error){console.error('account register',error);return json({error:'注册暂时没有完成，请稍后重试。'},503)}
}
