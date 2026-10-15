import {existingVisitor} from '@/lib/visitor';
import {storage,json} from '@/lib/storage';
import {maybeSyncApi} from '@/lib/platform-sync';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const synced=await maybeSyncApi(request);if(synced)return synced;
 const visitorId=await existingVisitor(request);if(!visitorId)return json({error:'照片不存在。'},404);
 try{const {id}=await params;const {db,bucket}=storage();const photo=await db.prepare('SELECT object_key, mime FROM photos WHERE id=? AND user_id=?').bind(id,visitorId).first<{object_key:string;mime:string}>();
 if(!photo)return json({error:'照片不存在。'},404);const object=await bucket.get(photo.object_key);if(!object)return json({error:'照片暂时不可用，请稍后重试。'},503);
 return new Response(object.body,{headers:{'Content-Type':photo.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){console.error('load photo',error);return json({error:'照片暂时无法加载。'},503)}
}
