import { lstat, mkdir, readFile, writeFile, rename, open, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { BridgeError, type Config } from './config.js';
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const alive=(pid?:number)=>{if(!pid)return false;try{process.kill(pid,0);return true;}catch(e){return (e as NodeJS.ErrnoException).code==='EPERM';}};
export type Receipt={id:string;key:string;fingerprint:string;mode:string;provider?:'codex'|'claude-code';cwd:string;createdAt:string;updatedAt:string;state:'busy'|'blocked'|'steered'|'delivered'|'queued'|'preparing'|'accepted'|'completed'|'failed'|'cancelled'|'uncertain';promptBytes:number;promptSha256:string;payloadSha256:string;transmittedSha256?:string;sessionConfirmed?:boolean;artifacts:Array<{path:string;bytes:number;sha256:string}>;threadId?:string;turnId?:string;pid?:number;error?:{code:string;message:string};output?:string;outputTruncated?:boolean;approvalsDenied?:number;pendingQuestions?:Array<{id:string;questions:any[]}>;desktop?:Record<string,unknown>;cancelRequested?:boolean;deliveryRoute?:'desktop-queue';queueMissingSince?:number;queuedSubmissionId?:string;queueClientMessageId?:string;queueHistory?:Array<{state:string;at:string;detail:string}>;ownerRecovery?:{state:"dispatching"|"acknowledged"|"blocked"|"uncertain";at:string;code?:string;turnId?:string;fieldVerified:false};queueObservation?:Record<string,unknown>};
export class Store {
 constructor(public config:Config){}
 async init(){for(const d of ['receipts','payloads','locks','demo','answers']){const dir=path.join(this.config.stateDir,d);await mkdir(dir,{recursive:true,mode:0o700});const s=await lstat(dir);if(s.isSymbolicLink()||!s.isDirectory()||(s.mode&0o077)!==0)throw new BridgeError('CONFIG','State subdirectories must be private and not symlinks.');}}
 file(kind:string,id:string){if(!/^[a-f0-9-]{16,64}$/.test(id))throw new BridgeError('INVALID_ID','Invalid receipt identifier.');return path.join(this.config.stateDir,kind,`${id}.json`);}
 async atomic(file:string,value:unknown){const temp=`${file}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});await rename(temp,file);}
 async save(r:Receipt){r.updatedAt=new Date().toISOString();await this.atomic(this.file('receipts',r.id),r);}
 async get(id:string):Promise<Receipt>{try{return JSON.parse(await readFile(this.file('receipts',id),'utf8'));}catch(e){if(e instanceof BridgeError)throw e;throw new BridgeError('NOT_FOUND','Receipt not found.');}}
 async all():Promise<Receipt[]>{const files=(await readdir(path.join(this.config.stateDir,'receipts'))).filter(f=>f.endsWith('.json'));return Promise.all(files.map(f=>this.get(f.slice(0,-5))));}
 async lock(name:string){const file=path.join(this.config.stateDir,'locks',`${hash(name)}.lock`);
  for(let attempt=0;attempt<2;attempt++){
   try{const f=await open(file,'wx',0o600);await f.writeFile(JSON.stringify({pid:process.pid}));await f.close();return async()=>{await unlink(file).catch(()=>{});};}
   catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
    let owner:{pid:number};try{owner=JSON.parse(await readFile(file,'utf8'));}catch{throw new BridgeError('BUSY','Another process is acquiring the lock; retry shortly.');}
    if(alive(owner.pid))throw new BridgeError('BUSY','Another bridge operation owns this session.');
    await unlink(file).catch(()=>{});
   }
  }throw new BridgeError('BUSY','Could not acquire lock.');
 }
}
