import { open, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { BridgeError, scoped, type Config } from './config.js';

const SESSION_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SESSIONS=5000;
export const newClaudeSessionId=()=>randomUUID();
export const claudeSessionId=(id:string)=>SESSION_ID.test(id);

function transcriptRoot(config:Config){return path.join(config.claudeConfigDir||process.env.CLAUDE_CONFIG_DIR||path.join(os.homedir(),'.claude'),'projects');}
async function transcriptFiles(config:Config):Promise<string[]>{
 const root=transcriptRoot(config);let dirs:string[];
 try{dirs=await readdir(root);}catch{return [];}
 const files:string[]=[];
 for(const dir of dirs){
  const folder=path.join(root,dir);if(!(await lstat(folder).catch(()=>null))?.isDirectory())continue;
  for(const name of await readdir(folder))if(SESSION_ID.test(name.slice(0,-6))&&name.endsWith('.jsonl')){
   const file=path.join(folder,name);if((await lstat(file).catch(()=>null))?.isFile())files.push(file);
   if(files.length>MAX_SESSIONS)throw new BridgeError('SESSION_LIMIT','Too many Claude transcripts to scan safely. Narrow the Claude config directory.');
  }
 }
 return files;
}
async function head(file:string){const f=await open(file,'r');try{const b=Buffer.alloc(256*1024);const {bytesRead}=await f.read(b,0,b.length,0);return b.subarray(0,bytesRead).toString('utf8');}finally{await f.close();}}
function messageText(message:any):string{
 const c=message?.content;
 if(typeof c==='string')return c;
 if(Array.isArray(c))return c.filter(x=>x?.type==='text'&&typeof x.text==='string').map(x=>x.text).join('\n');
 return '';
}
async function metadata(config:Config,file:string){
 let first:any;for(const line of (await head(file)).split('\n')){
  try{const item=JSON.parse(line);if(item.type==='user'&&item.cwd&&item.sessionId){first=item;break;}}catch{}
 }
 if(!first||!SESSION_ID.test(first.sessionId)||first.sessionId!==path.basename(file,'.jsonl'))return null;
 let cwd:string;try{cwd=await scoped(config,first.cwd);}catch{return null;}
 const entrypoint=String(first.entrypoint??'unknown');
 const st=await lstat(file);
 return {threadId:first.sessionId,cwd,provider:'claude-code' as const,entrypoint,resumable:['cli','sdk','sdk-cli'].includes(entrypoint),preview:messageText(first.message).slice(0,1000),updatedAt:st.mtime.toISOString(),status:'saved; live state unknown'};
}
export async function listClaudeSessions(config:Config,cwd?:string,query?:string,cursor?:string){
 const match=/^claude:(\d+)$/.exec(cursor??'claude:0');if(!match)throw new BridgeError('INVALID_CURSOR','Invalid Claude session cursor.');
 const offset=Number(match[1]);if(!Number.isSafeInteger(offset)||offset>MAX_SESSIONS)throw new BridgeError('INVALID_CURSOR','Invalid Claude session cursor.');
 const all=(await Promise.all((await transcriptFiles(config)).map(f=>metadata(config,f)))).filter((x):x is NonNullable<typeof x>=>x!==null).filter(x=>(!cwd||x.cwd===cwd)&&(!query||`${x.preview} ${x.cwd}`.toLowerCase().includes(query.toLowerCase())));
 all.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 return {data:all.slice(offset,offset+50),nextCursor:offset+50<all.length?`claude:${offset+50}`:null};
}
export async function readClaudeSession(config:Config,id:string,includeOutput=false){
 if(!SESSION_ID.test(id))throw new BridgeError('INVALID_ID','Claude session ID must be a UUID.');
 const files=await transcriptFiles(config);const file=files.find(f=>path.basename(f)===`${id}.jsonl`);
 if(!file)throw new BridgeError('NOT_FOUND','Claude session transcript not found.');
 const meta=await metadata(config,file);if(!meta)throw new BridgeError('OUTSIDE_ALLOWLIST','Claude session is outside allowed project roots or has invalid metadata.');
 if(!includeOutput)return meta;
 const f=await open(file,'r');let tail='';try{const st=await f.stat();const start=Math.max(0,st.size-8*1024*1024);const b=Buffer.alloc(st.size-start);let read=0;while(read<b.length){const chunk=await f.read(b,read,b.length-read,start+read);if(!chunk.bytesRead)break;read+=chunk.bytesRead;}tail=b.subarray(0,read).toString('utf8');if(start)tail=tail.slice(tail.indexOf('\n')+1);}finally{await f.close();}
 const messages:string[]=[];for(const line of tail.split('\n')){try{const item=JSON.parse(line);if(item.type==='assistant'){const text=messageText(item.message);if(text)messages.push(text);}}catch{}}
 const output=messages.slice(-10).join('\n').slice(-16000);
 return {...meta,output,outputTruncated:messages.join('\n').length>16000,note:'Saved Claude Code transcript. Live progress and Desktop sidebar state are not verified by this read.'};
}
export async function assertClaudeSession(config:Config,id:string,cwd:string){
 const session=await readClaudeSession(config,id);
 if(session.cwd!==cwd)throw new BridgeError('PROJECT_MISMATCH','Claude session belongs to a different project.');
 if(!session.resumable)throw new BridgeError('UNSUPPORTED_SESSION','This session belongs to another Claude surface; CLI continuation is not verified.');
 return session;
}
