export type LocalMemory={id:string;slot:number;occurredAt:string;content:string;photos:string[]};
type StoredPhoto={id:string;blob:Blob};
type StoredMemory=Omit<LocalMemory,'photos'>&{photos:StoredPhoto[]};
const DATABASE='xingji-phone-memories';
const MAX_PHOTO_BYTES=4*1024*1024;
let database:Promise<IDBDatabase>|undefined;
const urls=new Map<string,string>();

function request<T>(value:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{value.onsuccess=()=>resolve(value.result);value.onerror=()=>reject(value.error)})}
function completed(transaction:IDBTransaction){return new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onabort=()=>reject(transaction.error||new Error('本地保存没有完成，请重试。'));transaction.onerror=()=>{/* onabort reports a rolled-back transaction. */}})}
function friendly(error:unknown):Error{
  if(error instanceof DOMException&&error.name==='QuotaExceededError')return new Error('手机可用存储空间不足，内容尚未保存。请先导出备份、释放空间后重试。');
  if(error instanceof DOMException&&error.name==='ConstraintError')return new Error('这颗星已经被点亮，请回到星图刷新后重试。');
  return error instanceof Error?error:new Error('无法访问手机本地存储，请使用普通浏览模式重试。');
}
async function open(){
  if(typeof indexedDB==='undefined')throw new Error('当前浏览器不支持本地保存，请使用 Safari、Chrome 或 Edge 打开。');
  database??=new Promise<IDBDatabase>((resolve,reject)=>{
    const connection=indexedDB.open(DATABASE,1);
    connection.onupgradeneeded=()=>{const records=connection.result.createObjectStore('memories',{keyPath:'id'});records.createIndex('slot','slot',{unique:true})};
    connection.onsuccess=()=>{const db=connection.result;db.onversionchange=()=>{db.close();database=undefined};resolve(db)};
    connection.onerror=()=>{database=undefined;reject(friendly(connection.error))};
    connection.onblocked=()=>{database=undefined;reject(new Error('请关闭其他星迹页面后重试。'))};
  });
  return database;
}
async function stored(){const db=await open();return request(db.transaction('memories').objectStore('memories').getAll()) as Promise<StoredMemory[]>}
function validateFields(value:Omit<LocalMemory,'photos'>){
  if(typeof value.id!=='string'||!value.id||value.id.length>100)throw new Error('回忆编号无效。');
  if(!Number.isInteger(value.slot)||value.slot<0||value.slot>99999)throw new Error('星芒编号无效。');
  if(typeof value.occurredAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value.occurredAt))throw new Error('请选择完整的日期与时间。');
  const parsed=new Date(value.occurredAt);if(Number.isNaN(parsed.getTime())||value.occurredAt.slice(0,4)<'1900'||parsed.getMonth()+1!==Number(value.occurredAt.slice(5,7))||parsed.getDate()!==Number(value.occurredAt.slice(8,10)))throw new Error('日期与时间无效。');
  if(typeof value.content!=='string'||value.content.length>10000)throw new Error('文字不能超过 10000 字。');
}
function validatePhotos(photos:StoredPhoto[],content:string){
  if(photos.length>6)throw new Error('一段回忆最多保存 6 张照片。');
  if(!photos.length&&!content.trim())throw new Error('请至少留下一句话或一张照片。');
  for(const photo of photos)if(!['image/jpeg','image/png','image/webp'].includes(photo.blob.type)||photo.blob.size>MAX_PHOTO_BYTES||!photo.blob.size)throw new Error('照片格式或大小无效，每张照片最多 4 MB。');
}
export async function listLocalMemories():Promise<LocalMemory[]>{
  try{
    const records=await stored(),used=new Set<string>();
    const result=records.sort((a,b)=>a.slot-b.slot).map(record=>({...record,photos:record.photos.map(photo=>{used.add(photo.id);if(!urls.has(photo.id))urls.set(photo.id,URL.createObjectURL(photo.blob));return urls.get(photo.id)!})}));
    for(const [id,url] of urls)if(!used.has(id)){URL.revokeObjectURL(url);urls.delete(id)}
    return result;
  }catch(error){throw friendly(error)}
}
export async function saveLocalMemory(form:FormData,editing:boolean){
  const fields={id:String(form.get('id')||''),slot:Number(form.get('slot')),occurredAt:String(form.get('occurredAt')||''),content:String(form.get('content')||'')};
  validateFields(fields);
  const added=form.getAll('photos').map(value=>{if(!(value instanceof Blob))throw new Error('照片无效。');return{id:crypto.randomUUID(),blob:value}});
  const retained=editing?JSON.parse(String(form.get('retainedPhotos')||'[]')) as unknown:[];
  if(!Array.isArray(retained)||retained.some(value=>typeof value!=='string'))throw new Error('已保存照片列表无效。');
  try{
    const db=await open(),transaction=db.transaction('memories','readwrite'),done=completed(transaction),records=transaction.objectStore('memories');
    // Attach a rejection handler immediately; validation may abort the transaction.
    void done.catch(()=>{});
    const previous=await request(records.get(fields.id)) as StoredMemory|undefined;
    try{
      if(editing&&!previous)throw new Error('这段回忆已不存在，请回到星图重新打开。');
      if(!editing&&previous)throw new Error('这段回忆已保存，请回到星图查看。');
      const photos=editing?previous!.photos.filter(photo=>retained.includes(urls.get(photo.id))):[];
      if(photos.length!==retained.length)throw new Error('原照片已变化，请重新打开回忆后编辑。');
      const next={...fields,slot:editing?previous!.slot:fields.slot,photos:[...photos,...added]};validatePhotos(next.photos,next.content);records.put(next);
    }catch(error){transaction.abort();throw error}
    await done;return{id:fields.id};
  }catch(error){throw friendly(error)}
}
async function mergeRecords(incoming:StoredMemory[]){
  for(const record of incoming){validateFields(record);validatePhotos(record.photos,record.content)}
  try{
    const db=await open(),transaction=db.transaction('memories','readwrite'),done=completed(transaction),records=transaction.objectStore('memories');void done.catch(()=>{});
    const existing=await request(records.getAll()) as StoredMemory[],ids=new Set(existing.map(record=>record.id)),slots=new Set(existing.map(record=>record.slot));let imported=0,skipped=0;
    try{for(const record of incoming){
      if(ids.has(record.id)){skipped++;continue}
      let slot=record.slot;if(slots.has(slot)){slot=0;while(slots.has(slot))slot++}
      if(slot>99999)throw new Error('星芒数量已达到上限，无法继续导入。');
      records.add({...record,slot});ids.add(record.id);slots.add(slot);imported++;
    }}catch(error){transaction.abort();throw error}
    await done;return{imported,skipped};
  }catch(error){throw friendly(error)}
}
function dataURL(blob:Blob){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('无法读取备份照片。'));reader.readAsDataURL(blob)})}
export async function exportLocalBackup(){
  const records=await stored(),memories=[];
  for(const record of records){const photos=[];for(const photo of record.photos)photos.push(await dataURL(photo.blob));memories.push({...record,photos})}
  return new Blob([JSON.stringify({format:'xingji-local-backup',version:1,exportedAt:new Date().toISOString(),memories})],{type:'application/json'});
}
export async function importLocalBackup(file:File){
  let backup;try{backup=JSON.parse(await file.text())}catch{throw new Error('无法读取备份，请选择星迹导出的 JSON 文件。')}
  if(!backup||backup.format!=='xingji-local-backup'||backup.version!==1||!Array.isArray(backup.memories)||backup.memories.length>100000)throw new Error('这不是支持的星迹备份文件。');
  const incoming:StoredMemory[]=[];
  for(const item of backup.memories){
    if(!item||!Array.isArray(item.photos)||item.photos.length>6)throw new Error('备份中的照片列表无效。');
    const record={id:item.id,slot:item.slot,occurredAt:item.occurredAt,content:item.content,photos:[] as StoredPhoto[]};validateFields(record);
    for(const photo of item.photos){
      if(typeof photo!=='string'||photo.length>Math.ceil(MAX_PHOTO_BYTES*4/3)+100||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(photo))throw new Error('备份中的照片无效。');
      const [header,encoded]=photo.split(',');let binary;try{binary=atob(encoded)}catch{throw new Error('备份中的照片编码损坏。')}
      record.photos.push({id:crypto.randomUUID(),blob:new Blob([Uint8Array.from(binary,char=>char.charCodeAt(0))],{type:header.slice(5,-7)})});
    }
    incoming.push(record);
  }
  return mergeRecords(incoming);
}
export async function importLegacyMemories(){
  const response=await fetch('/api/memories',{cache:'no-store'});if(!response.ok)throw new Error('暂时无法找回旧版回忆，请联网后再试。');
  const payload=await response.json() as {memories?:LocalMemory[]};if(!Array.isArray(payload.memories))throw new Error('旧版回忆无法读取。');
  const incoming:StoredMemory[]=[];
  for(const memory of payload.memories){
    const record={id:memory.id,slot:memory.slot,occurredAt:memory.occurredAt,content:memory.content,photos:[] as StoredPhoto[]};validateFields(record);
    if(!Array.isArray(memory.photos)||memory.photos.length>6)throw new Error('旧版照片列表无效。');
    for(const source of memory.photos){
      if(typeof source!=='string'||!/^\/api\/photos\/[a-zA-Z0-9-]+$/.test(source))throw new Error('旧版照片地址无效。');
      const photo=await fetch(source,{cache:'no-store'});if(!photo.ok)throw new Error('旧版照片未能全部下载，没有导入，请稍后重试。');
      const blob=await photo.blob();record.photos.push({id:crypto.randomUUID(),blob});
    }
    incoming.push(record);
  }
  return mergeRecords(incoming);
}
export async function localStorageInfo(){
  const db=await open();const count=await request(db.transaction('memories').objectStore('memories').count());
  const estimate=await navigator.storage?.estimate?.().catch(()=>({} as StorageEstimate));const persistent=await navigator.storage?.persisted?.().catch(()=>false);
  return{count,usage:estimate?.usage||0,quota:estimate?.quota||0,persistent:Boolean(persistent)};
}
export async function keepLocalStorage(){return Boolean(await navigator.storage?.persist?.().catch(()=>false))}
