import { scoped, BridgeError, type Config } from './config.js';
import { type Receipt, Store } from './store.js';
import { Rpc } from './rpc.js';

export async function queueEvent(store:Store,r:Receipt,state:Receipt['state'],detail:string){
 r.state=state;r.queueHistory??=[];r.queueHistory.push({state,at:new Date().toISOString(),detail});await store.save(r);
}
// Only the stable client ID or the queue/start returned turn ID establishes delivery.
export function deliveredTurn(thread:any,r:Receipt){return (thread.turns??[]).find((t:any)=>(!!r.turnId&&t.id===r.turnId)||(t.items??[]).some((i:any)=>i.type==='userMessage'&&i.clientId===(r.queueClientMessageId??r.id)));}
export async function inspectQueue(rpc:Rpc,config:Config,r:Receipt){
 const thread=(await rpc.call('thread/read',{threadId:r.threadId,includeTurns:true})).thread;
 if(await scoped(config,thread.cwd)!==r.cwd)throw new BridgeError('PROJECT_MISMATCH','Queued task scope changed.');
 const turn=deliveredTurn(thread,r);let cursor;let waiting=false;let pages=0;
 do{const page=await rpc.call('thread/queue/list',{threadId:r.threadId,cursor,limit:100});waiting||=page.data.some((q:any)=>q.id===r.queuedSubmissionId||q.clientUserMessageId===(r.queueClientMessageId??r.id));cursor=page.nextCursor;if(++pages>100)throw new BridgeError('QUEUE_LIMIT','Queue inspection exceeded its bounded page limit.');}while(cursor);
 return {thread,turn,waiting,lastTurnInterrupted:thread.turns?.at(-1)?.status==='interrupted'};
}
export async function reconcileQueue(rpc:Rpc,config:Config,store:Store,r:Receipt){
 const view=await inspectQueue(rpc,config,r);
 r.queueObservation={waiting:view.waiting,lastTurnInterrupted:view.lastTurnInterrupted,needsSteer:view.waiting&&view.lastTurnInterrupted,desktopVerified:false};
 if(view.waiting||view.turn)r.queueMissingSince=undefined;
 if(view.turn){
  r.turnId=view.turn.id;
  if(!r.queueHistory?.some(e=>e.state==='delivered'))await queueEvent(store,r,'delivered','Matching client message or queue/start turn observed.');
  const status=view.turn.status;
  r.output=(view.turn.items??[]).filter((i:any)=>i.type==='agentMessage').map((i:any)=>i.text??'').join('\n').slice(-16000);
  if(['completed','failed','interrupted'].includes(status)){
   const state=status==='completed'?'completed':status==='interrupted'?'cancelled':'failed';
   if(state!==r.state)await queueEvent(store,r,state,`Observed turn status: ${status}.`);
  }
 }else if(!view.waiting&&r.queuedSubmissionId){
  r.queueMissingSince??=Date.now();
  if(Date.now()-r.queueMissingSince>30000&&r.state!=='uncertain')await queueEvent(store,r,'uncertain','Queue item absent for 30 seconds, but matching turn not observable. Never automatically resend.');
 }
 await store.save(r);return view;
}
export async function runQueue(config:Config,store:Store,r:Receipt,input:any[],resumeOnly=false,rpc:Rpc=new Rpc()){
 try{
  await rpc.start(config.codexBinary);
  const thread=(await rpc.call('thread/read',{threadId:r.threadId,includeTurns:false})).thread;
  if(await scoped(config,thread.cwd)!==r.cwd)throw new BridgeError('PROJECT_MISMATCH','Queued task scope changed.');
  r.deliveryRoute='desktop-queue';
  if(!resumeOnly){
   // Save intent before the only enqueue attempt. A lost response is never retried.
   await queueEvent(store,r,'busy','Direct input unavailable or explicit desktop queue requested.');
   await queueEvent(store,r,'preparing','Queue add dispatching; a lost acknowledgement is uncertain.');
   const added=await rpc.call('thread/queue/add',{threadId:r.threadId,input,clientUserMessageId:r.id});
   r.queuedSubmissionId=added.queuedSubmission.id;
   await queueEvent(store,r,'queued','Codex durably accepted the queue item. This is not delivery.');
  }
  const before=await reconcileQueue(rpc,config,store,r);
  if(!before.turn&&before.waiting&&r.ownerRecovery&&['dispatching','uncertain','acknowledged'].includes(r.ownerRecovery.state)){
   await queueEvent(store,r,'uncertain','Prior owner start may have been dispatched. Observe only; never resend.');return;
  }
  if(!before.turn&&before.waiting){
   // Do not change policies or steal ownership from the Desktop writer.
   try{
    await rpc.call('thread/resume',{threadId:r.threadId});
    const view=await reconcileQueue(rpc,config,store,r);
    if(!view.turn&&view.waiting){
     await queueEvent(store,r,'preparing','Starting this exact queue item; no fork or new prompt.');
     const started=await rpc.call('thread/queue/start',{threadId:r.threadId,queuedSubmissionId:r.queuedSubmissionId});
     r.turnId=started.turn.id;await queueEvent(store,r,'steered','Queue/start acknowledged with a turn ID. Completion is pending.');
    }
   }catch(e){
    if(e instanceof BridgeError&&e.code==='SESSION_BUSY')await queueEvent(store,r,'blocked','Desktop owns the writer; this connection cannot unpause it. The queue item remains pending.');
    else throw e;
   }
  }
  const deadline=Date.now()+config.jobTimeoutSeconds*1000;
  while(Date.now()<deadline){
   await reconcileQueue(rpc,config,store,r);
   if(['completed','failed','cancelled','uncertain','blocked'].includes(r.state))return;
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(r.state!=='blocked')await queueEvent(store,r,r.state==='delivered'?'uncertain':'blocked','Monitoring window ended. Inspect the existing item; never resend automatically.');
 }catch(e){r.error={code:e instanceof BridgeError?e.code:'QUEUE_ERROR',message:e instanceof Error?e.message:'Queue operation failed.'};await queueEvent(store,r,'uncertain','Queue operation not fully confirmed. No automatic retry.');}
 finally{rpc.close();}
}
