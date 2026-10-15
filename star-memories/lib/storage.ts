import { env } from 'cloudflare:workers';
export function storage(){if(!env.DB||!env.BUCKET)throw new Error('Storage binding unavailable');return {db:env.DB,bucket:env.BUCKET};}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
export function imageMime(bytes:Uint8Array){
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
