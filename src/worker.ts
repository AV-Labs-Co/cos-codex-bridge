import { readFile, access, unlink } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, BridgeError, scoped } from './config.js';
import { Store, hash, type Receipt } from './store.js';
import { Backend, POLICY, safeOverrides, verifySandbox, sandboxPolicy } from './backend.js';
import { Rpc } from './rpc.js';
import { runQueue } from './queue.js';
import { Desktop } from './desktop.js';
import { failure } from './bridge.js';
export async function work(configPath:string,id:string,steerOnly=false){
 const config=await loadConfig(configPath);const store=new Store(config);await store.init();let r=await store.get(id);const backend=new Backend(config,store);
 let release:(()=>Promise<void>)|undefined;let rpc:Rpc|undefined;let timer:NodeJS.Timeout|undefined;let watchdog:NodeJS.Timeout|undefined;
 let progress:NodeJS.Timeout|undefined;const questions=new Map<string,string|number>();let polling=false;
 let saveQueue=Promise.resolve();const save=()=>{saveQueue=saveQueue.then(()=>store.save(r));return saveQueue;};
 let finish:()=>void=()=>{};const done=new Promise<void>(resolve=>{finish=resolve;});let sent=false;let terminating=false;
 async function stop(reason:string){if(terminating)return;terminating=true;
  if(r.deliveryRoute==='desktop-queue'){r.state='uncertain';r.error={code:'QUEUE_MONITOR_STOPPED',message:'Queue execution may continue. Read the task; do not resend.'};await save();return;}
  if(rpc&&r.threadId&&r.turnId){try{await rpc.call('turn/interrupt',{threadId:r.threadId,turnId:r.turnId},5000);r.state='cancelled';r.error={code:reason,message:'Execution interrupted. Inspect workspace for partial changes.'};}catch{r.state='uncertain';r.error={code:'CANCEL_UNCERTAIN',message:'Could not confirm interrupt; inspect session.'};}}
  else{r.state=sent?'uncertain':'cancelled';r.error={code:reason,message:'Worker stopped; inspect receipt before retrying.'};}
  await save();finish();
 }
 const signal=()=>{void stop('WORKER_STOPPED');};process.on('SIGTERM',signal);process.on('SIGINT',signal);
 try{
  r.pid=process.pid;r.state='preparing';await save();await scoped(config,r.cwd);
  const payload=JSON.parse(await readFile(store.file('payloads',id),'utf8'));
  if(payload.configFingerprint!==hash(JSON.stringify(config))||hash(JSON.stringify(payload.input))!==r.payloadSha256)throw new BridgeError('INTEGRITY','Configuration or payload changed after receipt creation.');
  if(steerOnly||payload.delivery==='desktop-queue'){release=await store.lock(`thread:${r.threadId}`);await runQueue(config,store,r,payload.input,steerOnly);return;}
  if(r.threadId)release=await store.lock(`thread:${r.threadId}`);
  const cancelFile=path.join(config.stateDir,'locks',`${id}.cancel`);
  timer=setInterval(()=>{access(cancelFile).then(()=>stop('CANCELLED_BY_CALLER')).catch(()=>{});if(!polling){polling=true;void (async()=>{for(const [id,requestId] of questions){const f=store.file('answers',id);try{const answer=JSON.parse(await readFile(f,'utf8'));rpc?.respond(requestId,answer);questions.delete(id);r.pendingQuestions=r.pendingQuestions?.filter(q=>q.id!==id);await unlink(f);await save();}catch{}}})().finally(()=>{polling=false;});}},300);
  progress=setInterval(()=>{void save();},1000);
  watchdog=setTimeout(()=>{void stop('JOB_TIMEOUT');},config.jobTimeoutSeconds*1000);
  if(config.mode==='demo'){
   const t=r.threadId?await backend.demoRead(r.threadId):await backend.demoStart(r.cwd);
   r.threadId=t.id;r.turnId=crypto.randomUUID();if(!release)release=await store.lock(`thread:${t.id}`);
   r.state='accepted';await save();await new Promise(resolve=>setTimeout(resolve,350));
   if(terminating)return;
   const output=`DEMO ONLY · Received ${r.promptBytes} prompt bytes and ${r.artifacts.length} artifact(s). No model ran and no code was executed. Previous turns: ${t.turns.length}.`;
   t.turns.push({id:r.turnId,status:'completed',items:[{type:'userMessage',content:payload.input},{type:'agentMessage',text:output}]});await backend.demoSave(t);
   r.output=output;r.state='completed';await save();return;
  }
  rpc=new Rpc();
  rpc.onRequest=(requestId,method,params)=>{
   if(method==='item/tool/requestUserInput'){const id=hash(`${r.id}:${requestId}`);questions.set(id,requestId);r.pendingQuestions??=[];r.pendingQuestions.push({id,questions:params.questions});void save();return;}
   r.approvalsDenied=(r.approvalsDenied??0)+1;
   if(method.includes('requestApproval'))rpc!.respond(requestId,{decision:'decline'});
   else rpc!.reject(requestId);
   void save();
  };
  rpc.onExit=()=>{if(!['completed','failed','cancelled','uncertain'].includes(r.state)){r.state=sent?'uncertain':'failed';r.error={code:'CODEX_EXITED',message:'Codex exited before completion was verified.'};void save().then(finish);}};
  rpc.onEvent=(method,p)=>{
   if(p?.threadId&&r.threadId&&p.threadId!==r.threadId)return;
   if(method==='item/agentMessage/delta'){const text=(r.output??'')+(p.delta??'');r.outputTruncated=(r.outputTruncated??false)||text.length>16000;r.output=text.slice(-16000);}
   if(method==='turn/completed'){
    r.turnId=p.turn?.id??r.turnId;
    const status=p.turn?.status;
    r.state=status==='completed'?'completed':status==='interrupted'?'cancelled':'failed';
    if(p.turn?.error)r.error={code:'TURN_FAILED',message:String(p.turn.error.message??'Codex turn failed.').slice(0,500)};
    void save().then(finish);
   }
  };
  await rpc.start(config.codexBinary);
  const overrides=await safeOverrides(rpc,r.cwd);
  const common={cwd:r.cwd,approvalPolicy:'on-request',sandbox:config.sandbox==='read-only'?'read-only':'workspace-write',developerInstructions:POLICY,config:overrides,...(config.model?{model:config.model}:{})};
  let started;
  if(r.threadId){
   const meta=(await rpc.call('thread/read',{threadId:r.threadId,includeTurns:false})).thread;
   if(await scoped(config,meta.cwd)!==r.cwd)throw new BridgeError('PROJECT_MISMATCH','Stored thread scope changed.');
   if(meta.status?.type==='active')throw new BridgeError('SESSION_BUSY','Session became active before dispatch.');
   started=await rpc.call('thread/resume',{threadId:r.threadId,...common});
  }else started=await rpc.call('thread/start',common);
  verifySandbox(started,config,r.cwd);
  r.threadId=started.thread.id;
  if(!payload.existingThread)r.desktop={state:'pending',threadAssigned:false,desktopVerified:false};
  if(!release)release=await store.lock(`thread:${r.threadId}`);
  await save();
  if(terminating)return;
  // Mark before dispatch: a lost response must never cause an automatic resend.
  r.state='preparing';await save();sent=true;
  const turn=await rpc.call('turn/start',{threadId:r.threadId,input:payload.input,approvalPolicy:'on-request',sandboxPolicy:sandboxPolicy(config)});
  r.turnId=turn.turn.id;
  if(r.state==='preparing')r.state='accepted';await save();
  await done;
  if(!payload.existingThread&&r.threadId){
   try{
    const desktop=new Desktop(config,backend);r.desktop=await desktop.assign(r.cwd,r.threadId);
    if(r.desktop.legacyDesktopAssignment){try{await desktop.open(r.cwd);r.desktop.refreshRequested=true;const state=await desktop.state();r.desktop.legacyDesktopAssignment=state['thread-project-assignments']?.[r.threadId]?.projectId===r.desktop.projectId;}catch(e){r.desktop.refreshError=failure(e).error;}}
   }catch(e){r.desktop={threadAssigned:false,desktopVerified:false,error:failure(e).error};}
   await save();
  }
 }catch(e){if(!terminating){
  const payload=JSON.parse(await readFile(store.file('payloads',id),'utf8'));
  if(!sent&&e instanceof BridgeError&&e.code==='SESSION_BUSY'&&payload.onBusy==='queue'){if(timer)clearInterval(timer);if(progress)clearInterval(progress);if(watchdog)clearTimeout(watchdog);if(rpc){rpc.onExit=()=>{};rpc.close();}await runQueue(config,store,r,payload.input);return;}
  r.state=e instanceof BridgeError&&e.code==='SESSION_BUSY'?'failed':sent?'uncertain':'failed';r.error=failure(e).error;await save();}}
 finally{if(progress)clearInterval(progress);if(timer)clearInterval(timer);if(watchdog)clearTimeout(watchdog);rpc?.close();await saveQueue;await release?.();await unlink(path.join(config.stateDir,'locks',`${id}.cancel`)).catch(()=>{});process.off('SIGTERM',signal);process.off('SIGINT',signal);}
}
if(process.argv[2]&&process.argv[3])work(process.argv[2],process.argv[3],process.argv[4]==='steer').catch(()=>{process.exitCode=1;});
