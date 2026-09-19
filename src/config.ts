import { readFile, realpath, stat, lstat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
export const MAX_PROMPT = 256 * 1024;
export const MAX_ARTIFACT = 1024 * 1024;
export class BridgeError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export const ConfigSchema = z.object({
  version: z.literal(1), mode: z.enum(['codex','demo']).default('codex'),
  roots: z.array(z.string()).min(1).max(20),
  projects: z.record(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/),z.string()).default({}),
  sandbox: z.enum(['read-only','workspace-write']).default('read-only'),
  codexBinary: z.string().default('codex'), model: z.string().optional(),
  desktopLegacyAssignment:z.boolean().default(false),
  stateDir: z.string().optional(), maxConcurrent: z.number().int().min(1).max(8).default(2),
  jobTimeoutSeconds: z.number().int().min(30).max(7200).default(1800)
}).strict();
export type Config = z.infer<typeof ConfigSchema> & { configPath: string; stateDir: string };
export async function loadConfig(file: string): Promise<Config> {
  const configPath=await realpath(file);
  const raw=ConfigSchema.parse(JSON.parse(await readFile(configPath,'utf8')));
  const roots=await Promise.all(raw.roots.map(async p=>{
    if(!path.isAbsolute(p))throw new BridgeError('CONFIG','Roots must be absolute.');
    const r=await realpath(p);
    if(r===path.parse(r).root || r===os.homedir())throw new BridgeError('CONFIG','Allow individual project parents, not / or your home directory.');
    if(!(await stat(r)).isDirectory())throw new BridgeError('CONFIG','Root is not a directory.');
    return r;
  }));
  const stateDir=raw.stateDir??path.join(os.homedir(),'.local','state','cos-codex-bridge');
  if(!path.isAbsolute(stateDir))throw new BridgeError('CONFIG','stateDir must be absolute.');
  await mkdir(stateDir,{recursive:true,mode:0o700});
  const state=await lstat(stateDir);
  if(state.isSymbolicLink() || !state.isDirectory() || (state.mode & 0o077)!==0)throw new BridgeError('CONFIG','State directory must be a private, non-symlink directory (chmod 700).');
  const canonicalState=await realpath(stateDir);
  if(roots.some(r=>inside(r,canonicalState)||inside(canonicalState,r)||inside(r,configPath)))throw new BridgeError('CONFIG','Keep configuration and state outside allowed project roots.');
  return {...raw,roots,configPath,stateDir:canonicalState};
}
export function inside(root:string,target:string):boolean {
  const rel=path.relative(root,target);
  return rel==='' || (!rel.startsWith(`..${path.sep}`)&&rel!=='..'&&!path.isAbsolute(rel));
}
export async function scoped(config:Config,input:string,directory=true):Promise<string> {
  if(!path.isAbsolute(input))throw new BridgeError('OUTSIDE_ALLOWLIST','Use an absolute path or configured project alias.');
  const resolved=await realpath(input).catch(()=>{throw new BridgeError('NOT_FOUND','Path does not exist.');});
  if(!config.roots.some(r=>inside(r,resolved)))throw new BridgeError('OUTSIDE_ALLOWLIST','Path is outside configured workspace roots.');
  const s=await stat(resolved);
  if(directory ? !s.isDirectory():!s.isFile())throw new BridgeError('INVALID_PATH',directory?'Expected a directory.':'Expected a regular file.');
  return resolved;
}
export async function project(config:Config,name:string):Promise<string>{return scoped(config,config.projects[name]??name);}
export function textLimit(text:string,max:number,label:string):number {
  if(text!==Buffer.from(text,'utf8').toString('utf8'))throw new BridgeError('INVALID_TEXT',`${label} contains invalid Unicode.`);
  const bytes=Buffer.byteLength(text);
  if(!bytes||bytes>max)throw new BridgeError('SIZE_LIMIT',`${label} must contain 1–${max} UTF-8 bytes; received ${bytes}. Nothing was sent.`);
  return bytes;
}
