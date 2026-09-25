import {BridgeError,type Config} from './config.js';
export type WriteIntent='read-only'|'workspace-write';
/** A handoff may narrow configured authority; it can never expand it. */
export function handoffConfig(config:Config,intent?:WriteIntent,queue=false):Config {
 if(intent!==undefined&&!['read-only','workspace-write'].includes(intent))throw new BridgeError('INVALID_ARGUMENT','Invalid writeIntent.');
 if(intent&&queue)throw new BridgeError('WRITE_INTENT_UNSUPPORTED','Desktop queue uses Desktop permissions and cannot enforce per-call writeIntent. Use direct delivery with onBusy:reject. Nothing was sent.');
 if(intent==='workspace-write'&&config.sandbox!=='workspace-write')throw new BridgeError('WRITE_NOT_ALLOWED','This bridge configuration does not authorize workspace writes. Nothing was sent.');
 return intent?{...config,sandbox:intent}:config;
}
