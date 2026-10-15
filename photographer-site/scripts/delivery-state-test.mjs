import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const sql=new DatabaseSync(':memory:');
for(const file of ['0000_superb_roland_deschain.sql','0001_cute_mantis.sql','0002_colorful_war_machine.sql'])sql.exec(await readFile('drizzle/'+file,'utf8'));
const db={prepare(query){let args=[];return {bind(...a){args=a;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return sql.prepare(query).run(...args);}};}};
const image=new Uint8Array([137,80,78,71,0,255,2]);
const env={RESEND_API_KEY:'test-key',EMAIL_FROM:'Studio <test@example.com>',FEISHU_APP_ID:'app-test',FEISHU_APP_SECRET:'secret-test',FEISHU_RECEIVE_ID:'ou_test',FEISHU_RECEIVE_ID_TYPE:'open_id'};
globalThis.__deliveryTest={env,db,files:{async get(key){return key==='photo'?{arrayBuffer:async()=>image.buffer}:null;}}};
const stubs={name:'test-bindings',setup(b){b.onResolve({filter:/^(cloudflare:workers|@\/db)$/},a=>({path:a.path,namespace:'test-bindings'}));b.onLoad({filter:/.*/,namespace:'test-bindings'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__deliveryTest.env;export const waitUntil=()=>{};':'export const getDatabase=()=>globalThis.__deliveryTest.db;export const getFiles=()=>globalThis.__deliveryTest.files;'}));}};
await build({entryPoints:['lib/email.ts','lib/feishu.ts'],bundle:true,platform:'node',format:'esm',outdir:'outputs/delivery-test',plugins:[stubs],logLevel:'silent'});
const {deliverEmail}=await import('../outputs/delivery-test/email.js');const {deliverFeishu}=await import('../outputs/delivery-test/feishu.js');
let checks=0;const check=(name,value)=>{assert.ok(value,name);checks++;console.log('PASS '+name);};
const answers={styles:['fresh'],undecided:false,customStyle:'',purpose:'个人写真',location:'户外自然',retouch:'自然真实',makeup:'自己准备',date:'',budget:'',notes:'',referenceNotes:'',name:'测试客户',contact:'test@example.com'};
const photo={name:'参考.png',key:'photo',type:'image/png'};
function seed(id){sql.prepare('INSERT INTO surveys (id,name,contact,payload,photos,created_at,status) VALUES (?,?,?,?,?,?,?)').run(id,answers.name,answers.contact,JSON.stringify(answers),JSON.stringify([photo]),new Date().toISOString(),'new');sql.prepare('INSERT INTO email_deliveries (survey_id,state,updated_at) VALUES (?,?,?)').run(id,'pending',Date.now());for(const [suffix,key,type] of [['brief',null,'text/plain'],['photo','photo','image/png']])sql.prepare('INSERT INTO feishu_deliveries (id,survey_id,filename,content_type,source_key,state,updated_at) VALUES (?,?,?,?,?,?,?)').run(id+'-'+suffix,id,suffix+'.'+(key?'png':'txt'),type,key,'pending',Date.now());}
const messages=new Map();const files=new Map();let mailCalls=0;let messageCalls=0;let mode='success';let failPhoto=false;let uploaded=0;
globalThis.fetch=async(url,options)=>{
 if(url==='https://api.resend.com/emails'){mailCalls++;const payload=JSON.parse(options.body);assert.deepEqual(payload.to,['photographer@example.com']);if(mode==='reject')return Response.json({},{status:401});if(mode==='uncertain'){mode='limited';throw new Error('timeout');}if(mode==='limited')return Response.json({},{status:429});return Response.json({id:'mail-'+mailCalls});}
 assert.ok(String(url).startsWith('https://open.feishu.cn/'));
 if(url.includes('tenant_access_token'))return Response.json({code:0,tenant_access_token:'token'});
 if(url.endsWith('/files')){const name=options.body.get('file_name');const key='file-'+(++uploaded);files.set(key,name);return Response.json({code:0,data:{file_key:key}});}
 if(url.includes('/messages?')){messageCalls++;const body=JSON.parse(options.body);assert.equal(body.receive_id,'ou_test');const key=JSON.parse(body.content).file_key;if(failPhoto&&files.get(key).endsWith('.png'))return Response.json({code:230002});if(!messages.has(body.uuid))messages.set(body.uuid,'message-'+messages.size);return Response.json({code:0,data:{message_id:messages.get(body.uuid)}});}
 throw new Error('Unexpected network request');
};
seed('one');await Promise.all([deliverEmail('one'),deliverFeishu('one')]);
check('both email recipients accepted',sql.prepare('SELECT state FROM email_deliveries WHERE survey_id=?').get('one').state==='sent');
check('brief and photo accepted in private chat',sql.prepare("SELECT COUNT(*) n FROM feishu_deliveries WHERE survey_id=? AND state='sent'").get('one').n===2);
const before=[mailCalls,messageCalls];await Promise.all([deliverEmail('one'),deliverFeishu('one')]);check('completed deliveries not resent',mailCalls===before[0]&&messageCalls===before[1]);
seed('two');env.RESEND_API_KEY='';env.FEISHU_APP_SECRET='';await Promise.all([deliverEmail('two'),deliverFeishu('two')]);check('missing authorization keeps all pending',sql.prepare('SELECT state FROM email_deliveries WHERE survey_id=?').get('two').state==='pending'&&sql.prepare("SELECT COUNT(*) n FROM feishu_deliveries WHERE survey_id=? AND state='pending'").get('two').n===2);env.RESEND_API_KEY='test-key';env.FEISHU_APP_SECRET='secret-test';
mode='reject';await deliverEmail('two');const rejected=sql.prepare('SELECT * FROM email_deliveries WHERE survey_id=?').get('two');check('definite rejection allows later safe retry',rejected.state==='failed'&&rejected.first_attempt_at===null);mode='success';await deliverEmail('two');check('definite failure recovers after config fix',sql.prepare('SELECT state FROM email_deliveries WHERE survey_id=?').get('two').state==='sent');
failPhoto=true;await deliverFeishu('two');check('partial Feishu success preserved',sql.prepare("SELECT COUNT(*) n FROM feishu_deliveries WHERE survey_id=? AND state='sent'").get('two').n===1);const messageBefore=messageCalls;failPhoto=false;await deliverFeishu('two');check('only remaining photo retried',messageCalls===messageBefore+1&&sql.prepare("SELECT COUNT(*) n FROM feishu_deliveries WHERE survey_id=? AND state='sent'").get('two').n===2);
seed('three');mode='uncertain';await deliverEmail('three');const ambiguous=sql.prepare('SELECT * FROM email_deliveries WHERE survey_id=?').get('three');check('later rejection preserves earlier uncertainty',ambiguous.state==='uncertain'&&ambiguous.first_attempt_at!==null);sql.prepare('UPDATE email_deliveries SET first_attempt_at=? WHERE survey_id=?').run(Date.now()-24*3600000,'three');const calls=mailCalls;await deliverEmail('three');check('expired uncertain email is not duplicated',mailCalls===calls);
const received=messages.size;sql.prepare("UPDATE feishu_deliveries SET state='sending',updated_at=? WHERE id=?").run(Date.now()-90000,'one-photo');await deliverFeishu('one');check('interrupted Feishu send recovers with same UUID',messages.size===received&&sql.prepare('SELECT state FROM feishu_deliveries WHERE id=?').get('one-photo').state==='sent');
check('original customer record and photo references preserved',sql.prepare('SELECT COUNT(*) n FROM surveys').get().n===3&&JSON.parse(sql.prepare('SELECT photos FROM surveys WHERE id=?').get('two').photos)[0].key==='photo');
console.log(`${checks} durable delivery checks passed. In-memory database and mock transport only.`);
