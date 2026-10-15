import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {writeOfflineAssets} from './write-offline-assets.mjs';
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','vite.netlify.config.ts'],{stdio:'inherit'});
await writeOfflineAssets('netlify-dist');
await build({entryPoints:['netlify/api.ts'],outfile:'netlify/functions/star-api.mjs',bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',alias:{'@/lib/storage':path.resolve('netlify/storage.ts'),'@/lib/platform-sync':path.resolve('netlify/platform-sync.ts'),'@':path.resolve('.')},tsconfig:'tsconfig.json'});
