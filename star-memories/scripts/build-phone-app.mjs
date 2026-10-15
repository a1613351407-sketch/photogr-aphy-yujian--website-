import {spawnSync} from 'node:child_process';
import {writeOfflineAssets} from './write-offline-assets.mjs';
const result=spawnSync(process.execPath,['scripts/run-framework.mjs','build'],{stdio:'inherit'});
if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);
await writeOfflineAssets('dist/client');
