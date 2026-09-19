#!/usr/bin/env node
import {mkdir,realpath,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);const value=k=>args[args.indexOf(k)+1];
if(args.includes('--help')||!args.includes('--root')){console.log('Install: node scripts/install.mjs --root /absolute/projects [--prefix /absolute/install-dir] [--demo] [--write] [--codex /absolute/codex]\nNo download or credential collection. Default Codex sandbox: read-only. --write permits project writes. Never use / or your entire home.');process.exit(args.includes('--help')?0:1);}
try{
const root=await realpath(value('--root'));if(root===os.homedir()||root===path.parse(root).root||!(await stat(root)).isDirectory())throw Error('Choose a specific project parent directory.');
const prefix=path.resolve(args.includes('--prefix')?value('--prefix'):path.join(os.homedir(),'.local','share','cos-codex-bridge'));
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const cli=path.join(source,'dist','cli.js');await stat(cli).catch(()=>{throw Error('Build first: npm ci && npm run build');});
await mkdir(prefix,{recursive:true,mode:0o700});const configFile=path.join(prefix,'config.json');
const config={version:1,mode:args.includes('--demo')?'demo':'codex',roots:[root],projects:{workspace:root},sandbox:args.includes('--write')?'workspace-write':'read-only',stateDir:path.join(prefix,'state'),codexBinary:args.includes('--codex')?value('--codex'):'codex'};
const {loadConfig}=await import('../dist/config.js');
await writeFile(configFile,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});await loadConfig(configFile);
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
const launcher=path.join(prefix,'cos-codex-bridge');await writeFile(launcher,`#!/bin/sh\nexec ${quote(process.execPath)} ${quote(cli)} --config ${quote(configFile)} "$@"\n`,{flag:'wx',mode:0o700});
const mcp={mcpServers:{'cos-codex-bridge':{command:process.execPath,args:[cli,'--config',configFile,'mcp']}}};await writeFile(path.join(prefix,'mcp-client.json'),JSON.stringify(mcp,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(`Installed local launcher: ${launcher}\nConfiguration: ${configFile}\nMCP snippet: ${path.join(prefix,'mcp-client.json')}\nKeep the source folder in place. No client settings were changed.`);
const check=spawnSync(process.execPath,[cli,'--config',configFile,'doctor'],{stdio:'inherit'});process.exitCode=check.status??1;
}catch(e){console.error(`Install failed: ${e.message}\nExisting configuration is never overwritten. Inspect a partial new prefix before retrying.`);process.exitCode=1;}
