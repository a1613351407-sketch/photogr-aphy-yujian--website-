import {env} from 'cloudflare:workers';
import {getDatabase} from '@/db';
const encoder = new TextEncoder();
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function sameOrigin(request:Request){return request.headers.get('Origin')===new URL(request.url).origin;}
export async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function secret(){const s=env.STUDIO_SECRET;if(!s)throw new Error('Studio access is not configured');return s;}
async function key(){return crypto.subtle.importKey('raw',encoder.encode(secret()),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function checkPassword(password:string){const a=await digest(password);const b=await digest(secret());let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
export async function sessionToken(){const expiry=String(Date.now()+8*60*60*1000);const signature=await crypto.subtle.sign('HMAC',await key(),encoder.encode(expiry));return expiry+'.'+Array.from(new Uint8Array(signature)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function isStudio(request:Request){
 try{const token=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('studio_session='))?.slice(15);if(!token)return false;
 const [expiry,signature]=token.split('.');if(!/^\d{13}$/.test(expiry)||!signature||!/^[a-f0-9]{64}$/.test(signature)||Number(expiry)<Date.now()||Number(expiry)>Date.now()+8*60*60*1000)return false;
 return crypto.subtle.verify('HMAC',await key(),Uint8Array.from(signature.match(/.{2}/g)!,s=>parseInt(s,16)),encoder.encode(expiry));}catch{return false;}
}
export async function limit(request:Request,kind:string,max:number,windowMs:number){
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('oai-authenticated-user-id')||'unknown';
 const k=await digest(kind+':'+ip);const now=Date.now();
 const row=await getDatabase().prepare('INSERT INTO rate_limits (key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at < ? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at < ? THEN ? ELSE reset_at END RETURNING count').bind(k,now+windowMs,now,now,now+windowMs).first<{count:number}>();
 return !!row&&row.count<=max;
}
