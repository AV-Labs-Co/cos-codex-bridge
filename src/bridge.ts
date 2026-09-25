import {handoffConfig} from './handoff-policy.js';
import { readFile, mkdir, open, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { z } from 'zod';
import { BridgeError, type Config, project, scoped, inside, textLimit, MAX_PROMPT, MAX_ARTIFACT } from './config.js';
import { Store, hash, alive, type Receipt } from './store.js';
import { Backend } from './backend.js';
import { reconcileQueue } from './queue.js';
import { Desktop } from './desktop.js';
import { assertClaudeSession, listClaudeSessions, readClaudeSession, newClaudeSessionId } from './claude.js';
const provider=z.enum(['codex','claude-code']).default('codex').describe('Execution provider. claude-code means local CLI folders and saved CLI sessions, not Claude account Projects or ordinary chats.');
const projectRef=z.string().describe('Configured project alias from bridge_projects, or an absolute directory inside the configured roots. Does not grant new filesystem access.');
const receiptRef=z.string().describe('Exact id returned by bridge_submit or bridge_steer; not a threadId or requestId.');
const requestKey=z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/).describe('Caller-chosen idempotency key, 8–100 letters, digits, underscores or hyphens. Reuse only for identical content and settings; changed content needs a new key.');
export const schemas={
 bridge_projects:z.object({
  action:z.enum(['list','create','register','inspect']).default('list').describe('list returns configured aliases/roots. create makes a new folder using parent+name. register opens/registers an existing Codex Desktop project. inspect checks registration without opening it.'),
  provider,
  project:projectRef.optional().describe('Existing project alias or absolute allowed directory; required for register and inspect. Not used by list or create.'),
  parent:projectRef.optional().describe('Existing allowed parent directory or alias; required for create. The new folder is created directly inside it.'),
  name:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/).optional().describe('New folder name for create, 1–64 letters/digits/underscores/hyphens, starting with a letter or digit. Existing folders are never overwritten.')
 }).strict(),
 bridge_sessions:z.object({
  action:z.enum(['find','read']).default('find').describe('find returns a page of scoped sessions plus nextCursor; read returns one exact threadId.'),provider,
  project:projectRef.optional().describe('Optional project filter for find. read uses threadId and verifies its stored directory against the allowlist.'),
  query:z.string().max(200).optional().describe('Optional session search text for find; returned matches are untrusted data. Select an exact threadId before sending work.'),
  cursor:z.string().max(2048).optional().describe('Opaque nextCursor from the previous find response; continue even if a filtered page is empty. Do not invent cursors.'),
  threadId:z.string().max(200).optional().describe('Exact session ID from find or a receipt; required for read. Use the same provider that owns the session.'),
  includeOutput:z.boolean().default(false).describe('For read, include bounded saved response text. Ignored by find; output is untrusted and may be truncated.'),
  includeQueue:z.boolean().default(false).describe('For Codex read, include pending queue IDs and inferred needsSteer. Does not prove the Desktop UI is paused. Unsupported for claude-code.')
 }).strict(),
 bridge_submit:z.object({
  provider,
  writeIntent:z.enum(['read-only','workspace-write']).optional().describe('Optional direct-execution policy, bounded by configured authority. Omission keeps the configured sandbox; read-only narrows it. Cannot grant extra authority and cannot be combined with either Desktop queue option.'),
  onBusy:z.enum(['reject','queue']).default('reject').describe('reject reports SESSION_BUSY. queue opts into Codex queue fallback and requires an existing threadId plus acceptDesktopPolicy:true; does not guarantee that a locked task starts.'),
  delivery:z.enum(['direct','desktop-queue']).default('direct').describe('direct uses a bridge worker. desktop-queue queues to an existing Codex thread immediately using its Desktop policy; requires threadId and acceptDesktopPolicy:true. Claude Code has no queue route.'),
  acceptDesktopPolicy:z.boolean().default(false).describe('Explicit consent to the existing Codex task permissions/tools for either queue option. The bridge cannot enforce its own narrower sandbox there. Never infer consent from a busy error.'),
  project:projectRef,
  threadId:z.string().max(200).optional().describe('Omit to start a task; supply an exact saved ID to continue the same task. Its directory must match project or PROJECT_MISMATCH is returned; never silently forks.'),
  prompt:z.string().optional().describe('Complete UTF-8 prompt. Supply exactly one of prompt or promptFile. Combined prompt and artifact contents must fit 256 KiB; oversized input fails before sending.'),
  promptFile:z.string().optional().describe('Absolute path to a UTF-8 prompt file inside an allowed root. Mutually exclusive with prompt. File bytes count toward the combined 256 KiB limit.'),
  artifacts:z.array(z.string().describe('Absolute allowed path to a UTF-8 text artifact, not a URL or binary attachment.')).max(8).default([]).describe('Up to eight text files delivered as additional text inputs. Contents share the prompt size limit; paths, byte counts and hashes appear in the receipt.'),
  requestId:requestKey
 }).strict(),
 bridge_steer:z.object({
  threadId:z.string().min(1).describe('Exact existing Codex task that owns the queue item; must match the saved receipt when supplied.'),
  receiptId:receiptRef.optional().describe('Existing desktop-queue receipt to retry. Supply this OR queuedSubmissionId plus requestId to adopt an existing queue item.'),
  queuedSubmissionId:z.string().optional().describe('Exact pending ID from bridge_sessions read with includeQueue:true, or the CLI queue result. Required with requestId when receiptId is omitted. No new prompt is enqueued.'),
  requestId:requestKey.optional().describe('Stable 8–100 character idempotency key for adopting an existing queuedSubmissionId. Required when receiptId is omitted; reuse only for the same task and queue item.'),
  acceptDesktopPolicy:z.literal(true).describe('Required explicit consent to run under the existing Codex Desktop task policy. Does not bypass an active writer or guarantee unpause.')
 }).strict(),
 bridge_receipt:z.object({receiptId:receiptRef,includeOutput:z.boolean().default(true).describe('Include bounded saved output text. false omits output while retaining state and hashes; completion is not independent validation of generated work.')}).strict(),
 bridge_answer:z.object({
  receiptId:receiptRef,
  questionId:z.string().regex(/^[a-f0-9]{64}$/).describe('Exact pendingQuestions entry id from the receipt; the worker must still be waiting for it.'),
  answers:z.record(z.string().max(200),z.object({answers:z.array(z.string().max(8000)).max(20).describe('Answer strings for this individual question, up to 20 strings of at most 8,000 characters each.')}).strict()).describe('Map every nested question ID to {answers:["chosen answer"]}. Use IDs from pendingQuestions[].questions, not the outer questionId. No missing or extra IDs; this cannot approve permissions.')
 }).strict(),
 bridge_cancel:z.object({receiptId:receiptRef}).strict(),
 bridge_artifact:z.object({
  action:z.enum(['write','read']).describe('write creates a new file under project/.cos-bridge-artifacts; read retrieves an existing named file. Neither sends it to a model.'),project:projectRef,
  name:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/).describe('Artifact filename, not a path. Choose a fresh versioned name for writes; existing files are not replaced.'),
  text:z.string().optional().describe('UTF-8 contents required for write and unused for read. Size is bounded by doctor.artifactLimitBytes.')
 }).strict(),
 bridge_session_manage:z.object({
  threadId:z.string().min(1).max(200).describe('Exact allowed Codex task ID from bridge_sessions or a receipt. This tool does not manage Claude sessions.'),
  title:z.string().min(1).max(120).optional().describe('New stored task title, 1–120 characters. May be combined with pin and assignProject.'),
  pin:z.boolean().optional().describe('true moves into the existing Pinned section; false removes it. Omit to leave pinning unchanged.'),
  position:z.enum(['first','last']).default('first').describe('Position among pinned tasks when pin:true. Ignored for unpinning or when pin is omitted; other tasks keep relative order.'),
  assignProject:z.boolean().default(false).describe('Assign the task to the registered Desktop project matching its stored directory. Supply title, pin or assignProject:true. Metadata verification is not proof of sidebar rendering.')
 }).strict(),
 bridge_doctor:z.object({}).strict()
};
export type ToolName=keyof typeof schemas;
export class Bridge {
 store:Store;backend:Backend;
 constructor(public config:Config){this.store=new Store(config);this.backend=new Backend(config,this.store);}
 async init(){await this.store.init();}
 async execute(name:string,input:unknown):Promise<any>{
  if(!Object.hasOwn(schemas,name))throw new BridgeError('UNKNOWN_TOOL','Unknown bridge operation.');
  const args=schemas[name as ToolName].parse(input) as any;
  switch(name){
   case 'bridge_projects':return this.projects(args);
   case 'bridge_sessions':return this.sessions(args);
   case 'bridge_submit':return this.submit(args);
   case 'bridge_steer':return this.steer(args);
   case 'bridge_receipt':return this.receipt(args.receiptId,args.includeOutput);
   case 'bridge_answer':return this.answer(args);
   case 'bridge_cancel':return this.cancel(args.receiptId);
   case 'bridge_artifact':return this.artifact(args);
   case 'bridge_session_manage':return this.manageSession(args);
   case 'bridge_doctor':return this.doctor();
  }
 }
 async projects(args:any){
  if(['register','inspect'].includes(args.action)){if(!args.project)throw new BridgeError('INVALID_ARGUMENT','register/inspect requires project.');const cwd=await project(this.config,args.project);if(args.provider==='claude-code')return {path:cwd,provider:'claude-code',claudeCodeProjectReady:true,desktopRegistered:false,note:'Claude Code CLI uses this folder as project context. This does not register a Claude Desktop or cloud project; the first submission creates a resumable local CLI session.'};const d=new Desktop(this.config,this.backend);return args.action==='register'?d.register(cwd):d.resolve(cwd);}
  if(args.action==='list'){const items=[];for(const [name,p] of Object.entries(this.config.projects)){try{items.push({name,path:await project(this.config,p)});}catch{items.push({name,unavailable:true});}}
   return {mode:this.config.mode,provider:args.provider,roots:this.config.roots,projects:items,registration:args.provider==='claude-code'?'Folder-backed Claude Code CLI projects; Claude Desktop or cloud project registration is not available.':'Bridge aliases and workspace directories; not desktop sidebar registration.'};}
  if(!args.parent||!args.name)throw new BridgeError('INVALID_ARGUMENT','create requires parent and name.');
  const parent=await project(this.config,args.parent);const dest=path.join(parent,args.name);
  await mkdir(dest,{mode:0o700}).catch((e)=>{throw new BridgeError((e as NodeJS.ErrnoException).code==='EEXIST'?'ALREADY_EXISTS':'CREATE_FAILED','Project directory was not created; existing content is never overwritten.');});
  return {path:await scoped(this.config,dest),created:true,desktopRegistered:false,...(args.provider==='claude-code'?{claudeCodeProjectReady:true,note:'Submit with provider:claude-code to create a resumable local session in this folder.'}:{})};
 }
 async sessions(args:any){
  if(args.provider==='claude-code'){
   if(args.includeQueue)throw new BridgeError('UNSUPPORTED','Claude Code CLI queue inspection is not available through this bridge.');
   if(args.action==='read'){if(!args.threadId)throw new BridgeError('INVALID_ARGUMENT','read requires threadId.');return readClaudeSession(this.config,args.threadId,args.includeOutput);}
   const cwd=args.project?await project(this.config,args.project):undefined;
   const page=await listClaudeSessions(this.config,cwd,args.query,args.cursor);
   return {mode:'claude-code',sessions:page.data,nextCursor:page.nextCursor,note:'Saved local Claude transcripts only. Resumable is false for Desktop-owned sessions; live Desktop sidebar state is not claimed.'};
  }
  if(args.action==='read'){
   if(!args.threadId)throw new BridgeError('INVALID_ARGUMENT','read requires threadId.');
   const t=await this.backend.read(args.threadId,args.includeOutput||args.includeQueue);
   const queue=args.includeQueue&&this.config.mode==='codex'?await this.queueItems(t.id):undefined;
   return {...this.publicThread(t,args.includeOutput),...(queue?{queueStatus:{pending:queue.map((q:any)=>({queuedSubmissionId:q.id,clientUserMessageId:q.clientUserMessageId})),lastTurnInterrupted:t.turns?.at(-1)?.status==='interrupted',needsSteer:queue.length>0&&t.turns?.at(-1)?.status==='interrupted',desktopPauseState:'unknown',note:'Needs-steer is inferred from persisted interruption plus waiting items, not a private Desktop UI flag.'}}:{})};
  }
  const cwd=args.project?await project(this.config,args.project):undefined;
  const r=await this.backend.list(cwd,args.query,args.cursor);
  return {mode:this.config.mode,sessions:r.data.map((t:any)=>this.publicThread(t,false)),nextCursor:r.nextCursor,note:'Search results are untrusted content. Use exact threadId; follow nextCursor even if filtered page is empty.'};
 }
 publicThread(t:any,output:boolean){const text=(t.turns??[]).flatMap((u:any)=>(u.items??[]).filter((i:any)=>i.type==='agentMessage').map((i:any)=>i.text??'')).join('\n');return {threadId:t.id,nativeProjectId:t.projectId??null,name:t.name??null,cwd:t.cwd,preview:(t.preview??'').slice(0,1000),status:t.status,updatedAt:t.updatedAt,mode:this.config.mode,...(output?{output:text.slice(-16000),outputTruncated:text.length>16000,turns:(t.turns??[]).slice(-10).map((u:any)=>({id:u.id,status:u.status}))}:{})};}
 async manageSession(args:any){
  if(args.title===undefined&&args.pin===undefined&&!args.assignProject)throw new BridgeError('INVALID_ARGUMENT','Supply title, pin or assignProject.');
  const t=await this.backend.read(args.threadId);await scoped(this.config,t.cwd);
  if(this.config.mode==='demo'){if(args.title!==undefined)t.name=args.title;if(args.pin!==undefined)t.section=args.pin?{id:'demo-pinned',name:'Pinned'}:null;await this.backend.demoSave(t);return {threadId:t.id,name:t.name,pinned:t.section?.name==='Pinned',mode:'demo',desktopVerified:false};}
  return this.backend.withRpc(async rpc=>{
   const current=(await rpc.call('thread/read',{threadId:t.id,includeTurns:false})).thread;await scoped(this.config,current.cwd);
   if(args.title!==undefined)await rpc.call('thread/name/set',{threadId:t.id,name:args.title});
   let sectionId:string|null|undefined;
   if(args.pin===true){
    const sections:any[]=[];let cursor;do{const page=await rpc.call('threadSection/list',{cursor,limit:100});sections.push(...page.data);cursor=page.nextCursor;if(sections.length>1000)throw new BridgeError('UNSUPPORTED','Too many sections to resolve Pinned safely.');}while(cursor);
    const matches=sections.filter(s=>s.name==='Pinned');if(matches.length!==1)throw new BridgeError('UNSUPPORTED','Cannot uniquely resolve the existing Pinned section.');sectionId=matches[0].id;
    let beforeThreadId=null;if(args.position==='first'){const page=await rpc.call('thread/list',{sectionId,sortKey:'section_position',sortDirection:'asc',limit:2,modelProviders:[],sourceKinds:['cli','vscode','exec','appServer','unknown'],useStateDbOnly:true});beforeThreadId=page.data.find((x:any)=>x.id!==t.id)?.id??null;}
    await rpc.call('thread/section/move',{threadId:t.id,sectionId,beforeThreadId});
   }else if(args.pin===false){sectionId=null;await rpc.call('thread/section/move',{threadId:t.id,sectionId:null});}
   const verified=(await rpc.call('thread/read',{threadId:t.id,includeTurns:false})).thread;
   if(args.title!==undefined&&verified.name!==args.title)throw new BridgeError('VERIFY_FAILED','Title was not confirmed.');
   if(sectionId!==undefined&&(verified.section?.id??null)!==sectionId)throw new BridgeError('VERIFY_FAILED','Section change was not confirmed.');
   const assignment=args.assignProject?await new Desktop(this.config,this.backend).assign(t.cwd,t.id):undefined;
   return {assignment,threadId:t.id,name:verified.name,section:verified.section,pinned:verified.section?.name==='Pinned',mode:'codex',desktopVerified:false,note:'Stored Codex metadata verified; desktop rendering must be checked separately.'};
  });
 }
 async readText(file:string,max:number){const p=await scoped(this.config,file,false);const s=await stat(p);if(s.size>max)throw new BridgeError('SIZE_LIMIT',`File exceeds ${max} bytes.`);const b=await readFile(p);const text=new TextDecoder('utf-8',{fatal:true}).decode(b);textLimit(text,max,'File');return {path:p,text};}
 async submit(args:any){
  const queueRequested=args.onBusy==='queue'||args.delivery==='desktop-queue';
  const effective=handoffConfig(this.config,args.writeIntent,queueRequested);
  if(args.provider==='claude-code'&&this.config.mode==='demo')throw new BridgeError('UNSUPPORTED','Claude Code cannot run in the model-free Codex demo configuration.');
  if(args.provider==='claude-code'&&queueRequested)throw new BridgeError('UNSUPPORTED','Claude Code queue delivery is not implemented. Use a saved idle CLI session or wait for its current turn. Nothing was sent.');
  if(queueRequested&&(!args.threadId||!args.acceptDesktopPolicy||this.config.mode!=='codex'))throw new BridgeError('DESKTOP_POLICY_REQUIRED','Desktop queue requires an existing task, codex mode and acceptDesktopPolicy:true. Existing Desktop permissions apply.');
  if((args.prompt===undefined)===(args.promptFile===undefined))throw new BridgeError('INVALID_ARGUMENT','Provide exactly one of prompt or promptFile.');
  const cwd=await project(this.config,args.project);
  const prompt=args.prompt??(await this.readText(args.promptFile,MAX_PROMPT)).text;
  const bytes=textLimit(prompt,MAX_PROMPT,'Prompt');
  const artifacts=[];const input=[{type:'text',text:prompt}];let total=bytes;
  for(const file of args.artifacts){const a=await this.readText(file,MAX_PROMPT);total+=Buffer.byteLength(a.text);artifacts.push({path:a.path,bytes:Buffer.byteLength(a.text),sha256:hash(a.text)});input.push({type:'text',text:a.text});}
  if(total>MAX_PROMPT)throw new BridgeError('SIZE_LIMIT','Combined prompt and artifacts exceed 256 KiB. Nothing was sent.');
  const fingerprintFields={cwd,threadId:args.threadId??null,input,artifacts,onBusy:args.onBusy??'reject',delivery:args.delivery??'direct',acceptDesktopPolicy:args.acceptDesktopPolicy??false,mode:this.config.mode,sandbox:this.config.sandbox,model:this.config.model??null,...(args.writeIntent?{writeIntent:args.writeIntent}: {})};
  // Preserve the original Codex hash exactly so pre-upgrade request IDs still replay.
  const fingerprint=hash(JSON.stringify(args.provider==='codex'?fingerprintFields:{provider:'claude-code',...fingerprintFields,model:this.config.claudeModel??null}));
  const id=hash(args.requestId);const unlock=await this.store.lock('submit');
  try{
   let old:Receipt|undefined;try{old=await this.store.get(id);}catch(e){if(!(e instanceof BridgeError&&e.code==='NOT_FOUND'))throw e;}
   if(old){if(old.fingerprint!==fingerprint)throw new BridgeError('IDEMPOTENCY_CONFLICT','requestId already belongs to different content or settings.');return this.receipt(id,true);}
   if(args.threadId){if(args.provider==='claude-code')await assertClaudeSession(this.config,args.threadId,cwd);else{const t=await this.backend.read(args.threadId);if(await scoped(this.config,t.cwd)!==cwd)throw new BridgeError('PROJECT_MISMATCH','Thread belongs to a different project.');if(t.status?.type==='active'&&!queueRequested)throw new BridgeError('SESSION_BUSY','Codex reports this thread active.');}}
   const jobs=await this.store.all();
   const active=jobs.filter(r=>['busy','queued','preparing','accepted','steered','delivered','blocked'].includes(r.state)&&(alive(r.pid)||Date.now()-Date.parse(r.createdAt)<30000));
   if(active.length>=this.config.maxConcurrent)throw new BridgeError('CAPACITY','Concurrent job limit reached; poll existing receipts.');
   if(args.threadId&&active.some(r=>r.threadId===args.threadId))throw new BridgeError('SESSION_BUSY','A bridge job is already running for this thread.');
   const now=new Date().toISOString();const receipt:Receipt={id,key:args.requestId,fingerprint,mode:args.provider==='claude-code'?'claude-code':this.config.mode,provider:args.provider,writeIntent:args.writeIntent,effectiveSandbox:queueRequested?'desktop-policy':effective.sandbox,cwd,createdAt:now,updatedAt:now,state:'queued',promptBytes:bytes,promptSha256:hash(prompt),payloadSha256:hash(JSON.stringify(input)),artifacts,threadId:args.threadId??(args.provider==='claude-code'?newClaudeSessionId():undefined),...(args.provider==='claude-code'?{sessionConfirmed:false}:{})};
   await this.store.atomic(this.store.file('payloads',id),{provider:args.provider,writeIntent:args.writeIntent,input,onBusy:args.onBusy,delivery:args.delivery,existingThread:!!args.threadId,configFingerprint:hash(JSON.stringify(this.config))});
   await this.store.save(receipt);
   const worker=args.provider==='claude-code'?'./claude-worker.js':'./worker.js';
   const child=spawn(process.execPath,[fileURLToPath(new URL(worker,import.meta.url)),this.config.configPath,id],{detached:true,stdio:'ignore',env:process.env});
   child.on('error',()=>{});child.unref();
   return {...receipt,note:args.provider==='claude-code'?'Local Claude Code dispatch reserved a session ID but has not confirmed creation or completion. Poll bridge_receipt.':'Queued, not completed. Poll bridge_receipt. Reuse requestId only for the identical submission.'};
  }finally{await unlock();}
 }
 async receipt(id:string,includeOutput=true){let r=await this.store.get(id);await scoped(this.config,r.cwd);
  if(r.deliveryRoute==='desktop-queue'&&!alive(r.pid)&&!['completed','failed','cancelled'].includes(r.state)){const unlock=await this.store.lock(`queue:${id}`);try{r=await this.store.get(id);await this.backend.withRpc(rpc=>reconcileQueue(rpc,this.config,this.store,r));}finally{await unlock();}return {...r,...(includeOutput?{}:{output:undefined})};}
  if(['busy','queued','preparing','accepted','steered','delivered','blocked'].includes(r.state)&&!alive(r.pid)&&Date.now()-Date.parse(r.updatedAt)>30000){
   return {...r,state:'uncertain',error:{code:'WORKER_LOST',message:'Worker is no longer available. No automatic retry. Inspect the saved session before deciding what to send next.'},...(includeOutput?{}:{output:undefined})};
  }return {...r,...(includeOutput?{}:{output:undefined})};
 }
 async queueItems(threadId:string){return this.backend.withRpc(async rpc=>{let cursor;const data:any[]=[];let pages=0;do{const p=await rpc.call('thread/queue/list',{threadId,cursor,limit:100});data.push(...p.data);cursor=p.nextCursor;if(++pages>100)throw new BridgeError('QUEUE_LIMIT','Queue exceeds inspection limit.');}while(cursor);return data;});}
 async steer(args:any){
  if(!args.receiptId){
   if(!args.queuedSubmissionId||!args.requestId||this.config.mode!=='codex')throw new BridgeError('INVALID_ARGUMENT','Supply receiptId, or an exact queuedSubmissionId plus stable requestId in codex mode.');
   const t=await this.backend.read(args.threadId);const cwd=await scoped(this.config,t.cwd);
   const id=hash(args.requestId);const fingerprint=hash(JSON.stringify({action:'adopt-queue',threadId:t.id,queuedSubmissionId:args.queuedSubmissionId,cwd}));
   const unlock=await this.store.lock('submit');try{
    let old:Receipt|undefined;try{old=await this.store.get(id);}catch(e){if(!(e instanceof BridgeError&&e.code==='NOT_FOUND'))throw e;}
    if(old){if(old.fingerprint!==fingerprint)throw new BridgeError('IDEMPOTENCY_CONFLICT','requestId belongs to different queue recovery.');return this.receipt(id);}
    const active=(await this.store.all()).filter(x=>alive(x.pid)&&!['completed','failed','cancelled','uncertain'].includes(x.state));
    if(active.some(x=>x.threadId===t.id))throw new BridgeError('SESSION_BUSY','A bridge worker is already managing this task.');
    if(active.length>=this.config.maxConcurrent)throw new BridgeError('CAPACITY','Concurrent job limit reached.');
    const q=(await this.queueItems(t.id)).find((q:any)=>q.id===args.queuedSubmissionId);
    if(!q)throw new BridgeError('QUEUE_NOT_FOUND','Exact queue item is no longer waiting. Nothing was sent.');
    if(q.input.some((i:any)=>i.type!=='text'||typeof i.text!=='string'))throw new BridgeError('UNSUPPORTED','Only text queue items can be adopted in this version.');
    const prompt=q.input.map((i:any)=>i.text).join('');const bytes=textLimit(prompt,MAX_PROMPT,'Queued input');const now=new Date().toISOString();
    const adopted:Receipt={id,key:args.requestId,fingerprint,mode:this.config.mode,cwd,createdAt:now,updatedAt:now,state:'queued',threadId:t.id,deliveryRoute:'desktop-queue',queuedSubmissionId:q.id,queueClientMessageId:q.clientUserMessageId,promptBytes:bytes,promptSha256:hash(prompt),payloadSha256:hash(JSON.stringify(q.input)),artifacts:[],queueHistory:[{state:'queued',at:now,detail:'Existing exact queue item adopted; no new prompt submitted.'}]};
    await this.store.atomic(this.store.file('payloads',id),{input:q.input,existingThread:true,delivery:'desktop-queue',configFingerprint:hash(JSON.stringify(this.config))});await this.store.save(adopted);
    args.receiptId=id;
   }finally{await unlock();}
  }
  const r=await this.store.get(args.receiptId);await scoped(this.config,r.cwd);
  if(r.threadId!==args.threadId||r.deliveryRoute!=='desktop-queue'||!r.queuedSubmissionId)throw new BridgeError('QUEUE_MISMATCH','Steer requires the exact task and existing bridge queue receipt.');
  if(alive(r.pid))return {...r,note:'Queue monitor is active. No duplicate start sent.'};
  if(!['blocked','queued'].includes(r.state))return this.receipt(r.id);
  const release=await this.store.lock(`queue:${r.id}`);try{
   r.pid=undefined;r.state='preparing';await this.store.save(r);
   const child=spawn(process.execPath,[fileURLToPath(new URL('./worker.js',import.meta.url)),this.config.configPath,r.id,'steer'],{detached:true,stdio:'ignore',env:process.env});child.on('error',()=>{});child.unref();
   return {...r,note:'Recovery requested for the same queue item; poll receipt. Not yet steered.'};
  }finally{await release();}
 }
 async answer(args:any){const r=await this.store.get(args.receiptId);await scoped(this.config,r.cwd);const q=r.pendingQuestions?.find(q=>q.id===args.questionId);if(!q||!alive(r.pid)||!['preparing','accepted'].includes(r.state))throw new BridgeError('NO_PENDING_QUESTION','Question is no longer pending.');const ids=q.questions.map((q:any)=>q.id);if(Object.keys(args.answers).some(k=>!ids.includes(k))||ids.some((k:string)=>!Object.hasOwn(args.answers,k)))throw new BridgeError('INVALID_ARGUMENT','Answer every question using its exact ID.');textLimit(JSON.stringify(args.answers),MAX_PROMPT,'Answers');await this.store.atomic(this.store.file('answers',args.questionId),{answers:args.answers});return {receiptId:r.id,answerQueued:true,note:'Poll receipt until the pending question clears.'};}
 async cancel(id:string){const r=await this.store.get(id);await scoped(this.config,r.cwd);if(r.deliveryRoute==='desktop-queue')throw new BridgeError('UNSUPPORTED','Desktop queue cancellation is not implemented. This operation must not interrupt an unrelated Desktop turn.');if(['completed','failed','cancelled'].includes(r.state))return {receiptId:id,state:r.state,cancelRequested:false};
  await writeFile(path.join(this.config.stateDir,'locks',`${id}.cancel`),'cancel',{mode:0o600});return {receiptId:id,cancelRequested:true,note:'Cancellation requested; poll receipt to verify. Existing file changes are not rolled back.'};
 }
 async artifact(args:any){
  const cwd=await project(this.config,args.project);const dir=path.join(cwd,'.cos-bridge-artifacts');
  if(args.name==='.'||args.name==='..')throw new BridgeError('INVALID_ARGUMENT','Invalid artifact name.');
  if(args.action==='write'){
   if(args.text===undefined)throw new BridgeError('INVALID_ARGUMENT','write requires text.');textLimit(args.text,MAX_ARTIFACT,'Artifact');
   await mkdir(dir,{mode:0o700,recursive:true});
  }
  const actual=await scoped(this.config,dir);if(!inside(cwd,actual))throw new BridgeError('OUTSIDE_ALLOWLIST','Artifact directory escapes project.');
  const dest=path.join(actual,args.name);
  if(args.action==='write'){const f=await open(dest,'wx',0o600).catch(()=>{throw new BridgeError('ALREADY_EXISTS','Artifact exists or cannot be created. Choose a new versioned name.');});try{await f.writeFile(args.text);}finally{await f.close();}return {path:dest,bytes:Buffer.byteLength(args.text),sha256:hash(args.text),installed:false};}
  const r=await this.readText(dest,MAX_ARTIFACT);if(!inside(cwd,r.path))throw new BridgeError('OUTSIDE_ALLOWLIST','Artifact escapes project.');return {path:r.path,text:r.text,bytes:Buffer.byteLength(r.text),sha256:hash(r.text)};
 }
 doctor(){const v=spawnSync(this.config.codexBinary,['--version'],{encoding:'utf8',timeout:5000});const c=spawnSync(this.config.claudeBinary,['--version'],{encoding:'utf8',timeout:5000});const auth=c.status===0?spawnSync(this.config.claudeBinary,['auth','status'],{encoding:'utf8',timeout:5000}):null;let claudeAuthenticated=false;try{claudeAuthenticated=auth?.status===0&&JSON.parse(auth.stdout).loggedIn===true;}catch{}return {version:'0.2.0-beta.1',mode:this.config.mode,codexAvailable:v.status===0,codexVersion:v.status===0?v.stdout.trim():null,claudeCodeAvailable:c.status===0,claudeCodeVersion:c.status===0?c.stdout.trim():null,claudeCodeAuthenticated:claudeAuthenticated,claudeCodeReady:c.status===0&&claudeAuthenticated,claudeCodeCliProjects:true,claudeCodeDesktopProjectRegistration:false,claudeDesktopChats:false,claudeDesktopSessionControl:false,sandbox:this.config.sandbox,roots:this.config.roots,promptLimitBytes:MAX_PROMPT,artifactLimitBytes:MAX_ARTIFACT,maxConcurrent:this.config.maxConcurrent,transport:'stdio MCP / local JSON CLI',remoteEndpoint:false,chatgptChats:false,desktopProjectRegistration:this.config.mode==='codex'&&process.platform==='darwin',desktopRegistrationMethod:'codex app + exact-path registry verification',nativeProjectAssignment:this.config.mode==='codex',desktopLegacyAssignment:this.config.desktopLegacyAssignment,desktopLegacyAssignmentSupported:v.status===0&&v.stdout.trim()==='codex-cli 0.153.4',desktopVisibilityVerified:false,desktopQueue:true,desktopQueuePolicy:'explicit opt-in; existing Desktop policy',desktopOwnerAttachSupported:false,desktopPausedRecovery:'deferred-v0.1-known-limitation',interruptRecovery:"Known limitation (uncommon):\nIf a session already has an active writer and a steering prompt is sent, the prompt waits for a natural pause/stopping point. On a long autonomous run, the only human intervention needed is pressing Steer in that case.",publicationAllowed:false};}
}
export function failure(e:unknown){return {error:{code:e instanceof BridgeError?e.code:e instanceof z.ZodError?'INVALID_ARGUMENT':'INTERNAL',message:e instanceof z.ZodError?'Invalid arguments; inspect tool schema.':e instanceof Error?e.message:'Unexpected error.'}};}
