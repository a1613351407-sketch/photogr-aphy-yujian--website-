import {currentAccount,makeSession,rateLimited,sessionCookie,verifyPassword} from '@/lib/account';
import {browserVisitor} from '@/lib/visitor';
import {json,sameOrigin,storage} from '@/lib/storage';
import {maybeSyncApi} from '@/lib/platform-sync';
export const dynamic='force-dynamic';

export async function POST(request:Request){
 const synced=await maybeSyncApi(request);if(synced)return synced;
 if(!sameOrigin(request))return json({error:'请求来源无效。'},403);
 if(Number(request.headers.get('content-length')||0)>4096)return json({error:'请求内容过大。'},413);
 try{
  if(await currentAccount(request))return json({error:'请先退出当前账号。'},409);
  if(await rateLimited(request,'login',15))return json({error:'尝试次数过多，请 15 分钟后再试。'},429);
  const body=await request.json() as {username?:unknown;password?:unknown};
  const username=typeof body.username==='string'?body.username.trim().normalize('NFKC').toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(!username||username.length>100||!password||password.length>128)return json({error:'用户名或密码不正确。'},401);
  const {db}=storage();
  const account=await db.prepare('SELECT id,username,password_hash AS passwordHash FROM accounts WHERE username_key=?').bind(username).first<{id:string;username:string;passwordHash:string}>();
  if(!account||!(await verifyPassword(password,account.passwordHash)))return json({error:'用户名或密码不正确。'},401);
  const browserId=await browserVisitor(request);
  if(browserId){
   const visitorRecords=await db.prepare('SELECT id,slot FROM memories WHERE user_id=? ORDER BY created_at,id').bind(browserId).all<{id:string;slot:number}>();
   if(visitorRecords.results.length){
    const owned=await db.prepare('SELECT slot FROM memories WHERE user_id=?').bind('account:'+account.id).all<{slot:number}>();
    const occupied=new Set(owned.results.map(record=>record.slot));
    const statements=[];
    for(const record of visitorRecords.results){
     let slot=record.slot;while(occupied.has(slot))slot++;
     occupied.add(slot);
     statements.push(db.prepare('UPDATE memories SET user_id=?,slot=? WHERE id=? AND user_id=?').bind('account:'+account.id,slot,record.id,browserId));
     statements.push(db.prepare('UPDATE photos SET user_id=? WHERE memory_id=? AND user_id=?').bind('account:'+account.id,record.id,browserId));
    }
    await db.batch(statements);
   }
  }
  const token=await makeSession(account.id),response=json({account:{id:account.id,username:account.username}});
  response.headers.set('Set-Cookie',sessionCookie(request,token));return response;
 }catch(error){console.error('account login',error);return json({error:'登录暂时失败，请稍后重试。'},503)}
}
