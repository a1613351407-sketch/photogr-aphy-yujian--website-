import {storage} from '@/lib/storage';

const COOKIE_NAME = 'star_session';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const HASH_ITERATIONS = 210_000;

export type Account = {id:string;username:string};

function cookieToken(request:Request){
 const cookie=request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith(COOKIE_NAME+'='));
 const token=cookie?.slice(COOKIE_NAME.length+1);
 return token&&TOKEN_PATTERN.test(token)?token:null;
}

export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')}
export async function sha256(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('')}
export function sessionCookie(request:Request,token:string){
 const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
 return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}
export function clearSessionCookie(request:Request){
 const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
 return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
export async function currentAccount(request:Request):Promise<Account|null>{
 const token=cookieToken(request);if(!token)return null;
 const hash=await sha256(token);
 const {db}=storage();
 const row=await db.prepare('SELECT a.id,a.username FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').bind(hash,new Date().toISOString()).first<Account>();
 return row||null;
}
export async function revokeSession(request:Request){
 const token=cookieToken(request);if(!token)return;
 const {db}=storage();await db.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await sha256(token)).run();
}
export async function makeSession(accountId:string){
 const token=randomToken(),now=new Date(),expires=new Date(now.getTime()+SESSION_SECONDS*1000);
 const {db}=storage();await db.prepare('INSERT INTO account_sessions (token_hash,account_id,created_at,expires_at) VALUES (?,?,?,?)').bind(await sha256(token),accountId,now.toISOString(),expires.toISOString()).run();
 return token;
}
export async function hashPassword(password:string){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const hash=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:HASH_ITERATIONS,hash:'SHA-256'},key,256));
 return `pbkdf2_sha256$${HASH_ITERATIONS}$${Array.from(salt,byte=>byte.toString(16).padStart(2,'0')).join('')}$${Array.from(hash,byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}
export async function verifyPassword(password:string,stored:string){
 const [method,count,saltHex,hashHex]=stored.split('$');
 if(method!=='pbkdf2_sha256'||!Number.isInteger(Number(count))||Number(count)<100_000||Number(count)>1_000_000||!saltHex||!hashHex||saltHex.length!==32||hashHex.length!==64)return false;
 const salt=Uint8Array.from(saltHex.match(/../g)??[],byte=>parseInt(byte,16));
 const expected=Uint8Array.from(hashHex.match(/../g)??[],byte=>parseInt(byte,16));
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:Number(count),hash:'SHA-256'},key,256));
 let difference=0;for(let i=0;i<actual.length;i++)difference|=actual[i]^expected[i];return difference===0;
}
export async function rateLimited(request:Request,action:string,limit:number){
 const {db}=storage();
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-nf-client-connection-ip')||'local';
 const key=await sha256(action+':'+ip);
 const now=new Date(),windowStart=new Date(now.getTime()-15*60_000).toISOString();
 const row=await db.prepare('SELECT count,window_start AS windowStart FROM auth_attempts WHERE key=?').bind(key).first<{count:number;windowStart:string}>();
 if(!row||row.windowStart<windowStart){await db.prepare('INSERT INTO auth_attempts (key,count,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,window_start=excluded.window_start').bind(key,now.toISOString()).run();return false}
 if(row.count>=limit)return true;
 await db.prepare('UPDATE auth_attempts SET count=count+1 WHERE key=?').bind(key).run();return false;
}
