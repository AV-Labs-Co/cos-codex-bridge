import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { BridgeError } from './config.js';
import { VERSION } from './version.js';
export class Rpc {
 private child?:ChildProcessWithoutNullStreams; private next=0; private pending=new Map<number,{resolve:(r:any)=>void;reject:(e:Error)=>void;timer:NodeJS.Timeout}>(); private buffer=''; private decoder=new StringDecoder('utf8');
 onEvent:(method:string,params:any)=>void=()=>{};
 onRequest:(id:number|string,method:string,params:any)=>void=(id)=>this.respond(id,{decision:'decline'});
 onExit:()=>void=()=>{};
 async start(binary:string,args:string[]=[]){
  this.child=spawn(binary,['app-server',...args],{stdio:['pipe','pipe','pipe'],env:process.env});
  this.child.stderr.on('data',()=>{}); // Never emit inherited diagnostic content or credentials.
  this.child.stdout.on('data',(chunk:Buffer)=>{this.buffer+=this.decoder.write(chunk);if(this.buffer.length>32*1024*1024){this.fail(new BridgeError('PROTOCOL','Codex response exceeded 32 MiB.'));this.close();return;}
   let pos;while((pos=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,pos);this.buffer=this.buffer.slice(pos+1);try{this.receive(JSON.parse(line));}catch{this.fail(new BridgeError('PROTOCOL','Invalid Codex protocol message.'));}}
  });
  this.child.on('error',()=>this.fail(new BridgeError('CODEX_UNAVAILABLE','Cannot start Codex. Install CLI or choose explicit demo mode.')));
  this.child.on('exit',()=>{this.fail(new BridgeError('CODEX_EXITED','Codex process exited. Check receipt before retrying.'));this.onExit();});
  this.child.stdin.on('error',()=>this.fail(new BridgeError('CODEX_EXITED','Codex input closed.')));
  const r=await this.call('initialize',{clientInfo:{name:'cos-codex-bridge',version:VERSION},capabilities:{experimentalApi:true}});
  this.write({method:'initialized',params:{}});return r;
 }
 private receive(m:any){if(m.id!==undefined&&m.method){this.onRequest(m.id,m.method,m.params);return;}
  if(m.id!==undefined){const p=this.pending.get(m.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(new BridgeError(/already has an active writer/i.test(String(m.error.message))?'SESSION_BUSY':'CODEX_RPC',String(m.error.message).slice(0,500))):p.resolve(m.result);}
  else if(m.method)this.onEvent(m.method,m.params);
 }
 private write(m:unknown){if(!this.child?.stdin.writable)throw new BridgeError('CODEX_EXITED','Codex is not connected.');this.child.stdin.write(JSON.stringify(m)+'\n');}
 call(method:string,params:unknown={},timeout=30000):Promise<any>{return new Promise((resolve,reject)=>{const id=++this.next;const timer=setTimeout(()=>{this.pending.delete(id);reject(new BridgeError('TIMEOUT',`${method} timed out. Delivery may be uncertain; inspect receipt.`));},timeout);this.pending.set(id,{resolve,reject,timer});try{this.write({id,method,params});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});}
 respond(id:number|string,result:unknown){try{this.write({id,result});}catch{}}
 reject(id:number|string){try{this.write({id,error:{code:-32601,message:'Unavailable through this bridge; use the owner Codex UI.'}});}catch{}}
 private fail(e:Error){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e);}this.pending.clear();}
 close(){this.child?.kill('SIGTERM');this.fail(new BridgeError('CLOSED','Connection closed.'));}
}
