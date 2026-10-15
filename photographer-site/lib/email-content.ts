import {STYLES, type Answers} from './options';
// Replace this public placeholder through your deployment configuration before enabling email delivery.
export const EMAIL_RECIPIENTS = ['photographer@example.com'];
export function emailBrief(id:string, a:Answers, count:number){
 const styles=[...STYLES.filter(s=>a.styles.includes(s.id)).map(s=>s.name),...(a.customStyle?[a.customStyle]:[]),...(a.undecided?['一起商量']:[])].join('、');
 return ['玉鉴 PHOTO STUDIO · 新的拍摄意向','问卷编号：YJ-'+id.slice(0,8).toUpperCase(),'',...Object.entries({'客户称呼':a.name,'联系方式':a.contact,'喜欢的风格':styles,'拍摄用途':a.purpose,'场景偏好':a.location,'修图偏好':a.retouch,'妆造准备':a.makeup,'期望日期':a.date||'待沟通','预算':a.budget||'待沟通','补充想法':a.notes||'未填写','参考图说明':a.referenceNotes||'未填写'}).map(([label,value])=>label+'：'+value),'',`本次拍摄意向包含问卷沟通单和 ${count} 张客户参考照片。`,'请妥善保管客户信息，仅用于本次拍摄沟通。','摄影师工作台：https://yujian-photo-studio.a1613351407.chatgpt.site/studio'].join('\n');
}
export function attachmentName(index:number,name:string,type:string){
 const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
 const stem=name.replace(/\.[^.]*$/,'').replace(/[\x00-\x1f\x7f/\\<>:"|?*]/g,'_').trim().slice(0,60)||'参考照片';
 return `${String(index+1).padStart(2,'0')}-${stem}.${ext}`;
}
export function emailSubject(name:string){return '玉鉴 · 新拍摄意向｜'+name.replace(/[\r\n\x00-\x1f\x7f]/g,' ').slice(0,60);}
