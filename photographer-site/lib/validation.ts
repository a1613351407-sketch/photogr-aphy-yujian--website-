import {OPTIONS, STYLES, type Answers} from './options';
export const MAX_FILE = 5*1024*1024;
export const MAX_TOTAL = 12*1024*1024;
export function validateAnswers(input:unknown):Answers{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('问卷格式不正确，请重新填写。');
 const a=input as Answers;
 for(const [k,max] of Object.entries({name:60,contact:120,customStyle:200,date:10,budget:100,notes:2000,referenceNotes:1500,website:100})){
  if(typeof a[k as keyof Answers]!=='string'||(a[k as keyof Answers] as string).length>max)throw new Error('请检查填写内容的长度。');
 }
 if(a.website)throw new Error('暂时无法提交，请刷新后重试。');
 if(!a.name.trim()||a.contact.trim().length<3)throw new Error('请填写称呼和有效的联系方式。');
 if(a.consent!==true)throw new Error('请先同意将问卷用于拍摄沟通。');
 if(typeof a.undecided!=='boolean'||!Array.isArray(a.styles)||a.styles.length>1||new Set(a.styles).size!==a.styles.length||a.styles.some(s=>!STYLES.some(x=>x.id===s)))throw new Error('请选择一种有效的拍摄风格。');
 if(a.styles.length+Number(a.undecided)+Number(!!a.customStyle.trim())!==1)throw new Error('请选择一种风格，或选择一起商量。');
 for(const k of Object.keys(OPTIONS) as (keyof typeof OPTIONS)[])if(!OPTIONS[k].includes(a[k]))throw new Error('请检查拍摄偏好。');
 if(a.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||isNaN(Date.parse(a.date))||new Date(a.date+'T00:00:00Z').toISOString().slice(0,10)!==a.date))throw new Error('请选择有效的日期。');
 return {...a,name:a.name.trim(),contact:a.contact.trim()};
}
export function imageType(bytes:Uint8Array):string|null{
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
