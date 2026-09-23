import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, chmod, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../dist/config.js';
import { Bridge } from '../dist/bridge.js';
import { hash } from '../dist/store.js';
import { claudeCommand } from '../dist/claude-worker.js';

async function setup(){
 const temp=await mkdtemp(path.join(os.tmpdir(),'cos-claude-'));const root=path.join(temp,'projects');await mkdir(root);const a=path.join(root,'Alpha');const b=path.join(root,'Beta');await mkdir(a);await mkdir(b);
 const claudeConfigDir=path.join(temp,'claude-home');await mkdir(claudeConfigDir);const binary=path.join(temp,'fake-claude');
 await writeFile(binary,`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2);const value=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
const id=value('--session-id')||value('--resume');const cwd=process.cwd();const dir=path.join(process.env.CLAUDE_CONFIG_DIR,'projects',cwd.replace(/[^A-Za-z0-9]/g,'-'));
let prompt='';process.stdin.on('data',x=>prompt+=x);process.stdin.on('end',()=>{
 fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,id+'.jsonl');
 fs.appendFileSync(file,JSON.stringify({type:'user',cwd,sessionId:id,entrypoint:'sdk',message:{role:'user',content:prompt},timestamp:new Date().toISOString()})+'\\n');
 process.stdout.write(JSON.stringify({type:'system',subtype:'init',session_id:id})+'\\n');
 const finish=()=>{const output='DONE:'+prompt;fs.appendFileSync(file,JSON.stringify({type:'assistant',cwd,sessionId:id,message:{role:'assistant',content:[{type:'text',text:output}]},timestamp:new Date().toISOString()})+'\\n');process.stdout.write(JSON.stringify({type:'assistant',message:{content:[{type:'text',text:output}]}})+'\\n');process.stdout.write(JSON.stringify({type:'result',session_id:prompt==='FORK'?'00000000-0000-4000-8000-000000000001':id,is_error:false,result:output})+'\\n');};
 if(prompt==='WAIT')setTimeout(finish,5000);else finish();
});
`);await chmod(binary,0o700);
 const configFile=path.join(temp,'config.json');await writeFile(configFile,JSON.stringify({version:1,mode:'codex',roots:[root],projects:{Alpha:a,Beta:b},stateDir:path.join(temp,'state'),claudeBinary:binary,claudeConfigDir,jobTimeoutSeconds:30}));
 const config=await loadConfig(configFile);const bridge=new Bridge(config);await bridge.init();return {bridge,config,root,a,b,temp,claudeConfigDir};
}
async function done(bridge,id){for(let i=0;i<100;i++){const r=await bridge.execute('bridge_receipt',{receiptId:id});if(['completed','failed','cancelled','uncertain'].includes(r.state))return r;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Claude job did not finish');}

test('one MCP creates and resumes Claude Code CLI project sessions with exact receipts',async()=>{
 const {bridge,a}=await setup();const prompt='Build note\nالعربية\nend';const args={provider:'claude-code',project:'Alpha',prompt,requestId:'claude-exact-001'};
 const first=await bridge.execute('bridge_submit',args);assert.equal(first.sessionConfirmed,false);assert.equal(first.promptSha256,hash(prompt));
 const r=await done(bridge,first.id);assert.equal(r.state,'completed');assert.equal(r.sessionConfirmed,true);assert.equal(r.transmittedSha256,hash(prompt));assert.equal(r.output,'DONE:'+prompt);
 const found=await bridge.execute('bridge_sessions',{provider:'claude-code',project:'Alpha'});assert.equal(found.sessions.length,1);assert.equal(found.sessions[0].threadId,r.threadId);assert.equal(found.sessions[0].resumable,true);
 const read=await bridge.execute('bridge_sessions',{provider:'claude-code',action:'read',threadId:r.threadId,includeOutput:true});assert.match(read.output,/DONE:Build note/);
 const follow=await bridge.execute('bridge_submit',{provider:'claude-code',project:a,threadId:r.threadId,prompt:'Follow up',requestId:'claude-exact-002'});const followReceipt=await done(bridge,follow.id);assert.equal(followReceipt.state,'completed',JSON.stringify(followReceipt.error));
 assert.equal((await bridge.execute('bridge_submit',args)).id,first.id);
 await assert.rejects(bridge.execute('bridge_submit',{...args,prompt:'different'}),{code:'IDEMPOTENCY_CONFLICT'});
 await assert.rejects(bridge.execute('bridge_submit',{provider:'claude-code',project:'Beta',threadId:r.threadId,prompt:'wrong place',requestId:'claude-wrong-001'}),{code:'PROJECT_MISMATCH'});
});
test('Claude Desktop transcript can be seen but is not sent to through unsupported CLI continuation',async()=>{
 const {bridge,claudeConfigDir,a}=await setup();const id='68af6530-d753-4f75-bc35-e54fa5acc14c';const dir=path.join(claudeConfigDir,'projects','test-desktop');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,id+'.jsonl'),JSON.stringify({type:'user',cwd:a,sessionId:id,entrypoint:'claude-desktop',message:{role:'user',content:'private test'}})+'\n');
 const session=await bridge.execute('bridge_sessions',{provider:'claude-code',action:'read',threadId:id});assert.equal(session.resumable,false);
 await assert.rejects(bridge.execute('bridge_submit',{provider:'claude-code',project:'Alpha',threadId:id,prompt:'Do not fork',requestId:'claude-desktop-001'}),{code:'UNSUPPORTED_SESSION'});
});
test('Claude command uses restricted local execution and does not enable bypass',async()=>{
 const {config}=await setup();const command=claudeCommand(config,'68af6530-d753-4f75-bc35-e54fa5acc14c',false);assert.ok(command.includes('--restricted'));assert.ok(command.includes('--strict-mcp-config'));assert.ok(!command.includes('--dangerously-skip-permissions'));assert.ok(!command.includes('WebFetch'));const settings=JSON.parse(command[command.indexOf('--settings')+1]);assert.equal(settings.sandbox.allowUnsandboxedCommands,false);assert.equal(settings.sandbox.failIfUnavailable,true);assert.equal(settings.sandbox.network.strictAllowlist,true);assert.deepEqual(settings.sandbox.network.allowedDomains,[]);
});
test('Claude project creation is folder-backed; cancellation stops bridge-owned work',async()=>{
 const {bridge}=await setup();const created=await bridge.execute('bridge_projects',{provider:'claude-code',action:'create',parent:'Alpha',name:'Research'});assert.equal(created.claudeCodeProjectReady,true);assert.equal(created.desktopRegistered,false);
 const first=await bridge.execute('bridge_submit',{provider:'claude-code',project:'Beta',prompt:'WAIT',requestId:'claude-cancel-001'});await bridge.execute('bridge_cancel',{receiptId:first.id});const r=await done(bridge,first.id);assert.equal(r.state,'cancelled');
});
test('Claude artifacts are carried with a transmitted hash and a fork is never called complete',async()=>{
 const {bridge,config}=await setup();const artifact=await bridge.execute('bridge_artifact',{action:'write',project:'Alpha',name:'notes.txt',text:'évidence\nالعربية'});
 const first=await bridge.execute('bridge_submit',{provider:'claude-code',project:'Alpha',prompt:'Use the notes',artifacts:[artifact.path],requestId:'claude-artifact-001'});const r=await done(bridge,first.id);assert.equal(r.state,'completed');assert.match(r.output,/évidence/);assert.equal(r.artifacts[0].sha256,hash('évidence\nالعربية'));assert.notEqual(r.transmittedSha256,r.promptSha256);
 const fork=await bridge.execute('bridge_submit',{provider:'claude-code',project:'Alpha',prompt:'FORK',requestId:'claude-fork-001'});const f=await done(bridge,fork.id);assert.equal(f.state,'uncertain');assert.equal(f.error.code,'SESSION_MISMATCH');
});
