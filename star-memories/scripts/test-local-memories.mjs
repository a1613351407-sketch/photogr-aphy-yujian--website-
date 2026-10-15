import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';

const directory=await mkdtemp(join(tmpdir(),'xingji-local-test-'));
try{
  const output=join(directory,'storage.mjs');await build({entryPoints:['lib/local-memories.ts'],outfile:output,bundle:true,platform:'node',format:'esm'});
  const deviceA=new IDBFactory();globalThis.indexedDB=deviceA;
  globalThis.FileReader=class{readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;this.onload?.()}).catch(error=>this.onerror?.(error))}};
  const originalFetch=globalThis.fetch;let networkWrites=0;
  globalThis.fetch=(input,...rest)=>{if(String(input).startsWith('blob:'))return originalFetch(input,...rest);networkWrites++;throw new Error('Network is unavailable during local storage tests')};
  const appA=await import(pathToFileURL(output)+'?deviceA');
  const photoBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/aIYQAAAAASUVORK5CYII=','base64');
  const memoryId=crypto.randomUUID();const form=new FormData();form.set('id',memoryId);form.set('slot','0');form.set('occurredAt','2026-10-08T12:00');form.set('content','留在这台手机里的回忆');form.append('photos',new File([photoBytes],'test.png',{type:'image/png'}));
  await appA.saveLocalMemory(form,false);let records=await appA.listLocalMemories();assert.equal(records.length,1);assert.equal(records[0].content,'留在这台手机里的回忆');assert.match(records[0].photos[0],/^blob:/);assert.deepEqual(Buffer.from(await (await originalFetch(records[0].photos[0])).arrayBuffer()),photoBytes);
  const reloaded=await import(pathToFileURL(output)+'?deviceAReload');records=await reloaded.listLocalMemories();assert.equal(records[0].id,memoryId);assert.deepEqual(Buffer.from(await (await originalFetch(records[0].photos[0])).arrayBuffer()),photoBytes);
  const edited=new FormData();edited.set('id',memoryId);edited.set('slot','99');edited.set('occurredAt','2024-03-16T08:00');edited.set('content','离线编辑后仍保留原照片');edited.set('retainedPhotos',JSON.stringify(records[0].photos));await reloaded.saveLocalMemory(edited,true);records=await reloaded.listLocalMemories();assert.equal(records[0].slot,0);assert.equal(records[0].photos.length,1);assert.equal(records[0].occurredAt,'2024-03-16T08:00');
  const collision=new FormData();collision.set('id',crypto.randomUUID());collision.set('slot','0');collision.set('occurredAt','2026-10-08T12:00');collision.set('content','不能覆盖原回忆');await assert.rejects(reloaded.saveLocalMemory(collision,false),/已经被点亮/);assert.equal((await reloaded.listLocalMemories()).length,1);
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('storage full','QuotaExceededError')};await assert.rejects(reloaded.saveLocalMemory(edited,true),/存储空间不足/);IDBObjectStore.prototype.put=put;assert.equal((await reloaded.listLocalMemories())[0].content,'离线编辑后仍保留原照片');
  const backup=await reloaded.exportLocalBackup(),data=JSON.parse(await backup.text());assert.equal(data.memories.length,1);assert.match(data.memories[0].photos[0],/^data:image\/png;base64,/);
  globalThis.indexedDB=new IDBFactory();const appB=await import(pathToFileURL(output)+'?deviceB');assert.equal((await appB.listLocalMemories()).length,0,'A different device cannot see another device’s records');
  const backupFile=new File([backup],'backup.json',{type:'application/json'});assert.deepEqual(await appB.importLocalBackup(backupFile),{imported:1,skipped:0});assert.deepEqual(await appB.importLocalBackup(backupFile),{imported:0,skipped:1});assert.deepEqual(Buffer.from(await (await originalFetch((await appB.listLocalMemories())[0].photos[0])).arrayBuffer()),photoBytes);
  const more={...data,memories:[{...data.memories[0],id:crypto.randomUUID(),content:'另一段回忆'}]};await appB.importLocalBackup(new File([JSON.stringify(more)],'more.json'));records=await appB.listLocalMemories();assert.equal(records.length,2);assert.equal(new Set(records.map(record=>record.slot)).size,2);
  const broken={...data,memories:[{...data.memories[0],id:crypto.randomUUID()},{...data.memories[0],id:crypto.randomUUID(),photos:['data:text/html;base64,SGk=']}]};await assert.rejects(appB.importLocalBackup(new File([JSON.stringify(broken)],'broken.json')),/照片无效/);assert.equal((await appB.listLocalMemories()).length,2);
  const add=IDBObjectStore.prototype.add;let writes=0;IDBObjectStore.prototype.add=function(value){if(++writes===2)throw new DOMException('storage full','QuotaExceededError');return add.call(this,value)};
  const batch={...data,memories:[{...data.memories[0],id:crypto.randomUUID()},{...data.memories[0],id:crypto.randomUUID()}]};await assert.rejects(appB.importLocalBackup(new File([JSON.stringify(batch)],'batch.json')),/存储空间不足/);IDBObjectStore.prototype.add=add;assert.equal((await appB.listLocalMemories()).length,2,'An interrupted import is rolled back entirely');
  assert.equal(networkWrites,0,'Saving, editing, exporting and importing never require network access');
  console.log(JSON.stringify({ok:true,checks:['offline photo and text storage','reload durability','photo-preserving edits','duplicate slot protection','quota failure keeps original memory','backup roundtrip','device isolation','idempotent imports','slot collision reassignment','invalid import rejection','atomic import rollback','zero network requests']}));
}finally{await rm(directory,{recursive:true,force:true})}
