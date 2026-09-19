import {readFile, realpath, lstat, writeFile, rename, unlink, mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {BridgeError, scoped, type Config} from './config.js';
import {Backend} from './backend.js';
import {hash} from './store.js';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
export class Desktop {
 constructor(public config:Config, public backend:Backend){}
 get statePath(){return path.join(process.env.CODEX_HOME??path.join(os.homedir(),'.codex'),'.codex-global-state.json');}
 async state():Promise<any>{
  try{const s=await lstat(this.statePath);if(s.isSymbolicLink()||!s.isFile()||s.size>16*1024*1024)throw new Error();const value=JSON.parse(await readFile(this.statePath,'utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw new BridgeError('DESKTOP_STATE_UNREADABLE','Desktop registry cannot be safely read. No state file was modified.');}
 }
 async resolve(cwd:string){
  await scoped(this.config,cwd);const s=await this.state();const matches=[];
  for(const p of Object.values(s['local-projects']??{}) as any[]){if(!p||!Array.isArray(p.rootPaths))continue;for(const root of p.rootPaths){if(typeof root==='string'&&await realpath(root).catch(()=>null)===cwd){matches.push(p);break;}}}
  if(matches.length>1)throw new BridgeError('AMBIGUOUS_PROJECT','Multiple saved desktop projects match this exact directory.');
  const p=matches[0];return {path:cwd,projectId:p?.id??null,desktopRegistered:!!p,desktopVerified:false};
 }
 async open(cwd:string){
  await scoped(this.config,cwd);
  if(process.platform!=='darwin')throw new BridgeError('UNSUPPORTED_PLATFORM','Desktop registration is currently tested only on macOS.');
  try{await exec(this.config.codexBinary,['app',cwd],{timeout:15000,maxBuffer:1024*1024});}
  catch{throw new BridgeError('DESKTOP_OPEN_FAILED','codex app did not confirm a successful launch request. Inspect the desktop before retrying.');}
 }
 async register(cwd:string){
  await scoped(this.config,cwd);
  if(this.config.mode==='demo')return {path:cwd,projectId:null,desktopRegistered:false,desktopVerified:false,mode:'demo',note:'Demo never opens or registers desktop projects.'};
  await this.open(cwd);
  let result=await this.resolve(cwd);
  for(let i=0;!result.desktopRegistered&&i<20;i++){await new Promise(r=>setTimeout(r,250));result=await this.resolve(cwd);}
  return {...result,openRequested:true,mode:'codex',note:result.desktopRegistered?'Exact directory found in desktop registry. Visual rendering requires a separate check.':'Launch requested but registration not yet confirmed. Recheck before creating desktop work.'};
 }
 async nativeProject(cwd:string):Promise<{projectId:string|null;nativeProjectId:string|null;desktopRegistered:boolean;desktopVerified:boolean;path:string}>{
  const registration=await this.resolve(cwd);
  if(!registration.desktopRegistered)return {...registration,nativeProjectId:null};
  return this.backend.withRpc(async rpc=>{
   const matches:any[]=[];let cursor=null;let count=0;
   do{const page=await rpc.call('project/list',{cursor,limit:100});for(const p of page.data??[]){for(const root of p.roots??[]){if(await realpath(root.path).catch(()=>null)===cwd){matches.push(p);break;}}}cursor=page.nextCursor;if(++count>100)throw new BridgeError('PROJECT_LOOKUP_LIMIT','Too many native projects to resolve safely.');}while(cursor);
   if(matches.length>1)throw new BridgeError('AMBIGUOUS_PROJECT','Multiple native projects match this directory.');
   const p=matches[0]??(await rpc.call('project/create',{name:path.basename(cwd),roots:[{path:cwd}],idempotencyKey:hash(`desktop-project:${cwd}`)})).project;
   return {...registration,nativeProjectId:p.id};
  });
 }
 async legacyAssign(cwd:string,threadId:string,projectId:string){
  if(!this.config.desktopLegacyAssignment)return {legacyDesktopAssignment:false,compatibilityEnabled:false};
  const release=await this.backend.store.lock('desktop-assignment');let temp:string|undefined;
  try{
   const version=await exec(this.config.codexBinary,['--version'],{timeout:5000});
   if(version.stdout.trim()!=='codex-cli 0.153.4')throw new BridgeError('DESKTOP_VERSION_UNSUPPORTED','Private sidebar adapter is gated to tested Codex 0.153.4. Native assignment remains available.');
   const registration=await this.resolve(cwd);if(registration.projectId!==projectId)throw new BridgeError('DESKTOP_CONFLICT','Desktop project changed before assignment.');
   const stat=await lstat(this.statePath);if(stat.isSymbolicLink()||!stat.isFile())throw new BridgeError('DESKTOP_STATE_UNREADABLE','Unsafe desktop state file.');
   const original=await readFile(this.statePath,'utf8');const state=JSON.parse(original);
   const target=state['local-projects']?.[projectId];
   if(!Array.isArray(target?.rootPaths)||!(await Promise.all(target.rootPaths.map((p:string)=>realpath(p).catch(()=>null)))).includes(cwd))throw new BridgeError('DESKTOP_CONFLICT','Project roots changed before assignment.');
   for(const key of ['thread-project-assignments','sidebar-project-thread-orders']){if(state[key]!==undefined&&(!state[key]||typeof state[key]!=='object'||Array.isArray(state[key])))throw new BridgeError('DESKTOP_SCHEMA_CHANGED','Unsupported desktop assignment schema.');state[key]??={};}
   const assignment=state['thread-project-assignments'][threadId];
   if(assignment&&(assignment.projectKind!=='local'||assignment.projectId!==projectId))throw new BridgeError('DESKTOP_CONFLICT','Task already belongs to another desktop project; refusing to move it.');
   const order=state['sidebar-project-thread-orders'][projectId]??{threadIds:[]};
   if(!Array.isArray(order.threadIds)||order.threadIds.some((id:unknown)=>typeof id!=='string'))throw new BridgeError('DESKTOP_SCHEMA_CHANGED','Unsupported desktop project order schema.');
   if(assignment&&order.threadIds.includes(threadId))return {legacyDesktopAssignment:true,compatibilityEnabled:true,changed:false};
   state['thread-project-assignments'][threadId]={projectKind:'local',projectId};
   state['sidebar-project-thread-orders'][projectId]={...order,threadIds:[threadId,...order.threadIds.filter((id:string)=>id!==threadId)]};
   const backupDir=path.join(this.config.stateDir,'desktop-backups');await mkdir(backupDir,{recursive:true,mode:0o700});
   const bs=await lstat(backupDir);if(bs.isSymbolicLink()||!bs.isDirectory()||(bs.mode&0o077)!==0)throw new BridgeError('CONFIG','Desktop backup directory must be private.');
   const backupPath=path.join(backupDir,`${Date.now()}-${randomUUID()}.json`);await writeFile(backupPath,original,{flag:'wx',mode:0o600});
   temp=`${this.statePath}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(state),{flag:'wx',mode:0o600});
   // Desktop does not share this bridge lock. Detect intervening writes, never merge stale snapshots.
   const latest=await lstat(this.statePath);
   if(latest.isSymbolicLink()||latest.ino!==stat.ino||await readFile(this.statePath,'utf8')!==original)throw new BridgeError('DESKTOP_CONFLICT','Desktop changed during assignment. Backup kept; no replacement attempted.');
   await rename(temp,this.statePath);temp=undefined;
   const verified=await this.state();
   if(verified['thread-project-assignments']?.[threadId]?.projectId!==projectId||!verified['sidebar-project-thread-orders']?.[projectId]?.threadIds?.includes(threadId))throw new BridgeError('DESKTOP_ASSIGNMENT_LOST','Desktop assignment did not survive read-back. Native delivery is independent.');
   return {legacyDesktopAssignment:true,compatibilityEnabled:true,changed:true,backupPath,note:'Atomic replacement and pre-write conflict check cannot prevent a later Desktop overwrite. Verify again after refresh.'};
  }finally{if(temp)await unlink(temp).catch(()=>{});await release();}
 }
 async assign(cwd:string,threadId:string){
  await scoped(this.config,cwd);const registered=await this.resolve(cwd);
  if(!registered.desktopRegistered)return {...registered,threadId,threadAssigned:false,note:'Directory has no registered desktop project. Call bridge_projects register first.'};
  const thread=await this.backend.read(threadId);
  if(await scoped(this.config,thread.cwd)!==cwd)throw new BridgeError('PROJECT_MISMATCH','Cannot assign a task to a different directory.');
  const p=await this.nativeProject(cwd);
  if(!p.nativeProjectId)return {...p,threadId,threadAssigned:false,note:'Directory has no registered desktop project. Call bridge_projects register first.'};
  await this.backend.withRpc(async rpc=>{
   await rpc.call('thread/metadata/update',{threadId,projectId:p.nativeProjectId});
   const t=(await rpc.call('thread/read',{threadId,includeTurns:false})).thread;
   if(t.projectId!==p.nativeProjectId)throw new BridgeError('ASSIGNMENT_UNVERIFIED','Native project assignment was not confirmed.');
  });
  let compatibility:any;try{compatibility=await this.legacyAssign(cwd,threadId,p.projectId!);}catch(e){compatibility={legacyDesktopAssignment:false,error:{code:e instanceof BridgeError?e.code:'DESKTOP_ASSIGNMENT_FAILED',message:e instanceof Error?e.message:'Desktop assignment failed'}};}
  const s=await this.state();const legacy=s['thread-project-assignments']?.[threadId];
  return {...p,threadId,threadAssigned:true,assignmentMethod:'native-project-api',compatibility,legacyDesktopAssignment:legacy?.projectKind==='local'&&legacy.projectId===p.projectId,note:'Native membership verified. Legacy assignment and visible desktop rendering are separate evidence fields.'};
 }
}
