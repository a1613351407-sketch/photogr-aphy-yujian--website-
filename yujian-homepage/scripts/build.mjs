import {cp, mkdir, rm} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await rm(new URL('out/', root), {recursive:true, force:true});
await mkdir(new URL('out/', root), {recursive:true});
await cp(new URL('public/', root), new URL('out/', root), {recursive:true});
console.log('Built static site in out/');
