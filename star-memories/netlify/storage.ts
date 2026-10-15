import type {} from '@netlify/functions';
import {getDatabase} from '@netlify/database';
import {getStore, getDeployStore} from '@netlify/blobs';

// Keep the existing business rules while translating prepared D1 queries to Postgres.
function queryText(sql:string) {
 let position=0;
 return sql.replace(/\?/g,()=>'$'+(++position)).replace(/\bAS\s+(\w+)/gi,(_,name:string)=>`AS "${name}"`);
}
class Statement {
 constructor(readonly sql:string,readonly values:unknown[]=[]){}
 bind(...values:unknown[]){return new Statement(this.sql,values)}
 async all<T=Record<string,unknown>>(){
  const rows=await getDatabase().sql.unsafe(queryText(this.sql),this.values);
  return {results:rows as T[]};
 }
 async first<T=Record<string,unknown>>(){return (await this.all<T>()).results[0]??null}
 async run(){await this.all();return {success:true}}
}
export function storage(){
 const db={
  prepare:(sql:string)=>new Statement(sql),
  async batch(statements:Statement[]){
   const client=await getDatabase().pool.connect();
   try{
    await client.query('BEGIN');
    for(const statement of statements)await client.query(queryText(statement.sql),statement.values);
    await client.query('COMMIT');
   }catch(error){
    await client.query('ROLLBACK');
    if((error as {code?:string}).code==='23505')throw new Error('UNIQUE constraint');
    throw error;
   }finally{client.release()}
  },
 };
 // User photos must survive site redeploys, so all new writes use a site-scoped
 // store. Earlier builds accidentally used deploy-scoped stores; keep those
 // deploy IDs as a read-through migration path for photos already uploaded.
 const store=getStore({name:'star-photos',consistency:'strong'});
 const legacyStores=['6ab692da307bbc059fc900a1','6ab69604df791f3a03633b4b','6ab696a07ca665b5fa263ba5','6ab7955b5ccd4579ace61ea6']
  .map(deployID=>getDeployStore({name:'star-photos',deployID,consistency:'strong'}));
 const bucket={
  async put(key:string,bytes:Uint8Array,options?:{httpMetadata?:{contentType?:string}}){await store.set(key,Uint8Array.from(bytes).buffer as ArrayBuffer,{metadata:{contentType:options?.httpMetadata?.contentType||'application/octet-stream'}})},
  async get(key:string){
   let body:ArrayBuffer|null=await store.get(key,{type:'arrayBuffer'});
   if(!body)for(const legacy of legacyStores){
    try{body=await legacy.get(key,{type:'arrayBuffer'})}catch{body=null}
    if(body){await store.set(key,body);break}
   }
   return body?{body}:null;
  },
  async delete(keys:string|string[]){await Promise.all((Array.isArray(keys)?keys:[keys]).map(key=>store.delete(key)))},
 };
 return {db,bucket};
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin}
export function imageMime(bytes:Uint8Array){
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
