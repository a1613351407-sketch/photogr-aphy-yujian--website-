import {currentAccount,clearSessionCookie,revokeSession} from '@/lib/account';
import {json,sameOrigin} from '@/lib/storage';
import {maybeSyncApi} from '@/lib/platform-sync';
export const dynamic='force-dynamic';

export async function GET(request:Request){
 const synced=await maybeSyncApi(request);if(synced)return synced;
 try{return json({account:await currentAccount(request)})}
 catch(error){console.error('account status',error);return json({error:'账号状态暂时无法读取。'},503)}
}

export async function DELETE(request:Request){
 const synced=await maybeSyncApi(request);if(synced)return synced;
 if(!sameOrigin(request))return json({error:'请求来源无效。'},403);
 try{await revokeSession(request);const response=json({account:null});response.headers.set('Set-Cookie',clearSessionCookie(request));return response}
 catch(error){console.error('account sign out',error);return json({error:'退出失败，请重试。'},503)}
}
