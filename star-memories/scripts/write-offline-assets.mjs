import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export async function writeOfflineAssets(directory){
  const assets=[];
  async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const target=path.join(folder,entry.name);if(entry.isDirectory())await walk(target);else if(/\.(js|css)$/.test(entry.name)){const relative=path.relative(directory,target).split(path.sep).join('/');if(/^(assets\/|_next\/static\/)/.test(relative))assets.push('/'+relative)}}}
  await walk(directory);assets.sort();if(!assets.length)throw new Error('The build contains no offline app assets.');
  const hash=createHash('sha256');
  for(const asset of [...assets,'/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable.png','/icons/apple-touch-icon.png','/images/deep-space-panorama.png']){hash.update(asset);hash.update(await readFile(path.join(directory,asset)))}
  try{hash.update(await readFile(path.join(directory,'index.html')))}catch{}
  const revision=hash.digest('hex').slice(0,20);await writeFile(path.join(directory,'offline-assets.json'),JSON.stringify({revision,assets}));
  const worker=await readFile('public/service-worker.js','utf8');if(!worker.includes('__BUILD_REVISION__'))throw new Error('Missing offline cache revision placeholder.');
  await writeFile(path.join(directory,'service-worker.js'),worker.replaceAll('__BUILD_REVISION__',revision));
  console.log(`Offline app assets: ${assets.length}; revision ${revision}`);
}
