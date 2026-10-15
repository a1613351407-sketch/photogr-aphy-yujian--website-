import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/feishu-provider.ts'],bundle:true,platform:'node',format:'esm',outdir:'outputs/feishu-test',logLevel:'silent'});
const {getFeishuToken,uploadFeishuFile,sendFeishuFile,FeishuError}=await import('../outputs/feishu-test/feishu-provider.js');
let count=0;const check=(name,truth)=>{assert.ok(truth,name);console.log('PASS '+name);count++;};
let capture;
const mock=(body)=>async(url,options)=>{capture={url,options};return Response.json(body);};
check('tenant token response',await getFeishuToken('app-test','secret-test',mock({code:0,tenant_access_token:'tenant-test'}))==='tenant-test');
check('token credentials sent only to Feishu',capture.url==='https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'&&JSON.parse(capture.options.body).app_id==='app-test');
const bytes=new Uint8Array([137,80,78,71,0,255,2,3]);
check('file key returned',await uploadFeishuFile('tenant-test','参考照片.png',new Blob([bytes],{type:'image/png'}),mock({code:0,data:{file_key:'file-test'}}))==='file-test');
check('file endpoint and bearer token',capture.url==='https://open.feishu.cn/open-apis/im/v1/files'&&capture.options.headers.Authorization==='Bearer tenant-test');
check('file multipart fields',capture.options.body.get('file_type')==='stream'&&capture.options.body.get('file_name')==='参考照片.png');
check('reference file bytes preserved',Buffer.from(await capture.options.body.get('file').arrayBuffer()).equals(Buffer.from(bytes)));
const uuid='12345678-1234-4234-8234-123456789abc';
check('private message ID returned',await sendFeishuFile('tenant-test','open_id','ou_test','file-test',uuid,mock({code:0,data:{message_id:'om_test'}}))==='om_test');
const sent=JSON.parse(capture.options.body);
check('private recipient used',capture.url.endsWith('receive_id_type=open_id')&&sent.receive_id==='ou_test');
check('file message content',sent.msg_type==='file'&&JSON.parse(sent.content).file_key==='file-test');
check('stable dedupe UUID passed',sent.uuid===uuid);
const initial=capture.options.body;await sendFeishuFile('tenant-test','open_id','ou_test','file-test',uuid,mock({code:0,data:{message_id:'om_test'}}));check('retry body identical',capture.options.body===initial);
try{await sendFeishuFile('x','open_id','ou_test','f',uuid,async()=>{throw new Error('timeout')});assert.fail();}catch(e){check('timeout result uncertain',e instanceof FeishuError&&e.uncertain);}
try{await sendFeishuFile('x','open_id','ou_test','f',uuid,mock({code:230002}));assert.fail();}catch(e){check('explicit recipient rejection not fake success',e instanceof FeishuError&&!e.uncertain);}
try{await uploadFeishuFile('x','a.txt',new Blob(['x']),mock({code:0,data:{}}));assert.fail();}catch(e){check('missing upload receipt rejected',e instanceof FeishuError);}
console.log(`${count} Feishu contract checks passed. Mock transport only; no messages sent.`);
