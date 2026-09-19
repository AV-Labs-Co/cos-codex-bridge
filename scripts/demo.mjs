import {mkdtemp,mkdir,writeFile,realpath} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {loadConfig} from '../dist/config.js';import {Bridge} from '../dist/bridge.js';
const base=await realpath(await mkdtemp(path.join(os.tmpdir(),'cos-demo-')));const root=path.join(base,'projects');await mkdir(root);const file=path.join(base,'config.json');await writeFile(file,JSON.stringify({version:1,mode:'demo',roots:[root],projects:{Website:root},stateDir:path.join(base,'state')}));const bridge=new Bridge(await loadConfig(file));await bridge.init();
const r=await bridge.execute('bridge_submit',{project:'Website',prompt:'Research → plan → build. العربية 🧭\nKeep the entire prompt intact.',requestId:'demo-first-prompt'});console.log('DEMO ONLY — no Codex account, model or code execution\n',JSON.stringify(r,null,2));
for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,100));const receipt=await bridge.execute('bridge_receipt',{receiptId:r.id});if(['completed','failed','uncertain'].includes(receipt.state)){console.log(JSON.stringify(receipt,null,2));if(receipt.state!=='completed')process.exitCode=1;break;}}
console.log('Demo files:',base);
