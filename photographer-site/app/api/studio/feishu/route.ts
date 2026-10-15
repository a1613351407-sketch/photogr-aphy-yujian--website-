import {isStudio,json,sameOrigin} from '@/lib/server';
import {deliverFeishu,feishuConfigured,feishuSummary} from '@/lib/feishu';
export async function POST(request:Request){
 if(!sameOrigin(request)||!await isStudio(request))return json({error:'请先登录摄影师工作台。'},401);
 if(!feishuConfigured())return json({error:'飞书机器人尚未授权，问卷与照片仍保存在工作台。'},503);
 try{const {surveyId}=await request.json() as {surveyId?:unknown};if(typeof surveyId!=='string'||surveyId.length>100)return json({error:'无效问卷。'},400);
 const before=await feishuSummary(surveyId);if(!before.total)return json({error:'此问卷没有飞书发送记录。'},404);
 await deliverFeishu(surveyId);return json(await feishuSummary(surveyId));
 }catch{return json({error:'飞书发送暂时失败，客户资料仍保留。'},503);}
}
