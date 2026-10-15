import {getDatabase,getFiles} from '@/db';import {isStudio,json} from '@/lib/server';
export async function GET(request:Request,{params}:{params:Promise<{surveyId:string;photoId:string}>}){
 if(!await isStudio(request))return json({error:'请先登录。'},401);
 try{const {surveyId,photoId}=await params;const row=await getDatabase().prepare('SELECT photos FROM surveys WHERE id=?').bind(surveyId).first<{photos:string}>();
 const photo=row?JSON.parse(row.photos).find((p:{id:string})=>p.id===photoId):null;if(!photo)return json({error:'图片不存在。'},404);
 const object=await getFiles().get(photo.key);if(!object)return json({error:'图片不存在。'},404);return new Response(object.body,{headers:{'Content-Type':photo.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(photo.name)}});
 }catch{return json({error:'图片暂时无法加载。'},503);}
}
