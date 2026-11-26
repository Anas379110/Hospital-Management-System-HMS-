import {spawnSync} from 'node:child_process';
import {cpSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
for(const dir of ['frontend','backend']){const result=spawnSync('npm',['run','build'],{cwd:join(root,dir),stdio:'inherit',env:{...process.env,npm_config_ignore_scripts:"true",npm_config_audit:"false",npm_config_fund:"false"}});if(result.status!==0)process.exit(result.status??1);}
mkdirSync(join(root,'backend/public'),{recursive:true});
cpSync(join(root,'frontend/dist-demo'),join(root,'backend/public'),{recursive:true});
