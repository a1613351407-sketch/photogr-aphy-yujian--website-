import './build.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../out/index.html',import.meta.url);
let html=await readFile(file,'utf8');
for(const [old,url] of Object.entries({'yujian-photo-studio.a1613351407.chatgpt.site':'yujian-questionnaire.netlify.app','jingqu-wuhan-0913.a1613351407.chatgpt.site':'yujian-scenery.netlify.app','xingji-memory-atlas.a1613351407.chatgpt.site':'yujian-stars.netlify.app'}))html=html.replaceAll(old,url);
await writeFile(file,html);
