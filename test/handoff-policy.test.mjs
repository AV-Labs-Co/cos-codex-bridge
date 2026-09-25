import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {Bridge} from '../dist/bridge.js';import {loadConfig} from '../dist/config.js';
import {handoffConfig} from '../dist/handoff-policy.js';import {claudeCommand} from '../dist/claude-worker.js';
async function setup(sandbox='workspace-write',mode='demo',broaden=false){
 const base=await realpath(await mkdtemp(path.join(os.tmpdir(),'cos-handoff-')));const root=path.join(base,'project');await mkdir(root);const log=path.join(base,'rpc.jsonl');const binary=path.join(base,'fake-codex');
 await writeFile(binary,`#!/usr/bin/env node
const fs=require('fs');const rl=require('readline').createInterface({input:process.stdin});const send=o=>process.stdout.write(JSON.stringify(o)+'\\n');rl.on('line',line=>{const m=JSON.parse(line);fs.appendFileSync(${JSON.stringify(log)},line+'\\n');if(m.method==='initialize')send({id:m.id,result:{}});if(m.method==='config/read')send({id:m.id,result:{config:{}}});if(m.method==='thread/read')send({id:m.id,result:{thread:{id:'test-policy',cwd:${JSON.stringify(root)},status:{type:'idle'}}}});if(['thread/start','thread/resume'].includes(m.method)){const p=m.params;send({id:m.id,result:{thread:{id:'test-policy',cwd:p.cwd},cwd:p.cwd,approvalPolicy:'on-request',sandbox:{type:${broaden}?'workspaceWrite':p.sandbox==='read-only'?'readOnly':'workspaceWrite',networkAccess:false,writableRoots:[],excludeTmpdirEnvVar:true,excludeSlashTmp:true}}});}if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'turn-policy'}}});send({method:'turn/completed',params:{threadId:'test-policy',turn:{id:'turn-policy',status:'completed'}}});}if(m.id&&m.method&&!['initialize','config/read','thread/read','thread/start','thread/resume','turn/start'].includes(m.method))send({id:m.id,error:{code:-32601,message:'fixture unsupported'}});});`,{mode:0o700});
 const file=path.join(base,'config.json');await writeFile(file,JSON.stringify({version:1,mode,roots:[root],stateDir:path.join(base,'state'),sandbox,codexBinary:binary}));const config=await loadConfig(file);const b=new Bridge(config);await b.init();return {b,config,root,log};
}
async function done(b,id){for(let i=0;i<100;i++){const r=await b.execute('bridge_receipt',{receiptId:id});if(['completed','failed','uncertain'].includes(r.state))return r;await new Promise(r=>setTimeout(r,50));}throw Error('fixture timed out');}
test('handoff cannot expand configuration or pretend to constrain Desktop delivery',async()=>{const {b,root}=await setup('read-only');for(const extra of [{writeIntent:'workspace-write'},{writeIntent:'read-only',onBusy:'queue',acceptDesktopPolicy:true,threadId:'x'},{writeIntent:'read-only',delivery:'desktop-queue',acceptDesktopPolicy:true,threadId:'x'}])await assert.rejects(b.execute('bridge_submit',{project:root,prompt:'test',requestId:'policy-denied-01',...extra}),{code:extra.writeIntent==='workspace-write'?'WRITE_NOT_ALLOWED':'WRITE_INTENT_UNSUPPORTED'});assert.equal((await b.store.all()).length,0);});
test('direct Codex worker applies narrower authority at thread and turn dispatch',async()=>{const {b,root,log}=await setup('workspace-write','codex');const r=await b.execute('bridge_submit',{project:root,prompt:'read only',requestId:'policy-rpc-test-01',writeIntent:'read-only'});assert.equal(r.effectiveSandbox,'read-only');assert.equal((await done(b,r.id)).state,'completed');const calls=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(calls.find(x=>x.method==='thread/start').params.sandbox,'read-only');assert.deepEqual(calls.find(x=>x.method==='turn/start').params.sandboxPolicy,{type:'readOnly',networkAccess:false});});
test('Claude read-only handoff removes write and shell tools under writable configuration',async()=>{const {config}=await setup();const args=claudeCommand(handoffConfig(config,'read-only'),'session',false);assert.equal(args[args.indexOf('--tools')+1],'Read,Glob,Grep');assert.equal(args[args.indexOf('--permission-mode')+1],'plan');});
test('restart preserves authority, hashes and completed result without duplicate turn',async()=>{const {b,config,root}=await setup();const args={project:root,prompt:'Exact مرحبا',requestId:'policy-restart-01',writeIntent:'read-only'};const first=await b.execute('bridge_submit',args);const end=await done(b,first.id);const restarted=new Bridge(config);await restarted.init();const replay=await restarted.execute('bridge_submit',args);assert.equal(replay.state,'completed');for(const key of ['id','threadId','promptSha256','payloadSha256','writeIntent','effectiveSandbox'])assert.equal(replay[key],end[key]);assert.equal((await restarted.backend.demoRead(end.threadId)).turns.length,1);await assert.rejects(restarted.execute('bridge_submit',{...args,writeIntent:'workspace-write'}),{code:'IDEMPOTENCY_CONFLICT'});});
test('lost worker keeps uncertain execution and never automatically resends on replay',async()=>{const {b,config,root}=await setup();const args={project:root,prompt:'uncertain fixture',requestId:'policy-uncertain-01',writeIntent:'read-only'};const first=await b.execute('bridge_submit',args);await done(b,first.id);const saved=await b.store.get(first.id);saved.state='accepted';delete saved.pid;await b.store.save(saved);const file=b.store.file('receipts',first.id);const stale=JSON.parse(await readFile(file,'utf8'));stale.updatedAt='2000-01-01T00:00:00Z';await writeFile(file,JSON.stringify(stale));const restarted=new Bridge(config);await restarted.init();const replay=await restarted.execute('bridge_submit',args);assert.equal(replay.state,'uncertain');assert.equal((await restarted.backend.demoRead(replay.threadId)).turns.length,1);assert.equal(replay.payloadSha256,first.payloadSha256);});

test('same-task follow-up applies read-only policy again at resume and turn dispatch',async()=>{
 const {b,root,log}=await setup('workspace-write','codex');
 const first=await b.execute('bridge_submit',{project:root,prompt:'review',requestId:'policy-resume-first',writeIntent:'read-only'});
 const completed=await done(b,first.id);assert.equal(completed.state,'completed');
 const followup=await b.execute('bridge_submit',{project:root,threadId:completed.threadId,prompt:'review again',requestId:'policy-resume-second',writeIntent:'read-only'});
 assert.equal((await done(b,followup.id)).state,'completed');
 const calls=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(calls.find(x=>x.method==='thread/resume').params.sandbox,'read-only');
 const turns=calls.filter(x=>x.method==='turn/start');assert.equal(turns.length,2);
 for(const t of turns)assert.deepEqual(t.params.sandboxPolicy,{type:'readOnly',networkAccess:false});
});
test('provider returning broader permissions is refused before any prompt dispatch',async()=>{
 const {b,root,log}=await setup('workspace-write','codex',true);
 const r=await b.execute('bridge_submit',{project:root,prompt:'must not send',requestId:'policy-broader-refusal',writeIntent:'read-only'});
 const result=await done(b,r.id);assert.equal(result.state,'failed');assert.equal(result.error.code,'POLICY_MISMATCH');
 const calls=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(calls.some(x=>x.method==='turn/start'),false);
});
