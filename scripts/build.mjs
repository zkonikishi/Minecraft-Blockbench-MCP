import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { bundleOptions, root } from './bundle-options.mjs';
const output = resolve(process.env.BLOCKBENCH_BUILD_DIR || resolve(root,'dist'));
mkdirSync(output,{recursive:true});
const file=resolve(output,'minecraft_blockbench_mcp.js');
// GPL-3.0 section 5(a) requires modified versions to carry prominent notices
// stating that they were changed. scripts/bundle-options.mjs rewrites vendored
// sources in memory at build time, so the bundle says so explicitly.
const banner='/*! Minecraft Blockbench MCP | GPL-3.0-only\n'
 +' * MODIFIED BUILD. Bundles code from Jason J. Gardner (GPL-3.0-only), SwagRee (MIT)\n'
 +' * and sosadly (MIT). The vendored sources are adapted at build time; the unmodified\n'
 +' * upstream snapshots, their SHA-256 hashes and the exact local changes are recorded in\n'
 +' * upstream-lock.json, scripts/bundle-options.mjs and src/.\n'
 +' * See THIRD_PARTY_NOTICES.md: https://github.com/zkonikishi/Minecraft-Blockbench-MCP */';
await build({...bundleOptions(),entryPoints:[resolve(root,'src/main.ts')],format:'iife',outfile:file,
  banner:{js:banner}});
for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md'])writeFileSync(resolve(output,name),readFileSync(resolve(root,name)));
const licenses=resolve(output,'licenses');mkdirSync(licenses,{recursive:true});
writeFileSync(resolve(licenses,'sosadly-MIT.txt'),readFileSync(resolve(root,'vendor/sosadly/LICENSE')));
const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
const inventory=[];
for(const [path,entry] of Object.entries(lock.packages)){
  if(!path||!existsSync(resolve(root,path,'package.json')))continue;
  const pkg=JSON.parse(readFileSync(resolve(root,path,'package.json'),'utf8'));
  inventory.push({name:pkg.name,version:pkg.version,license:pkg.license});
  for(const name of readdirSync(resolve(root,path)).filter(n=>/^(license|licence|copying|notice)(\.|$)/i.test(n))){
    try{writeFileSync(resolve(licenses,`${pkg.name.replace(/[^a-z0-9_-]/gi,'_')}-${name}`),readFileSync(resolve(root,path,name)));}catch{}
  }
}
writeFileSync(resolve(licenses,'dependency-inventory.json'),JSON.stringify(inventory,null,2));
writeFileSync(resolve(output,'SHA256SUMS'),`${createHash('sha256').update(readFileSync(file)).digest('hex')}  minecraft_blockbench_mcp.js\n`);
console.log(`Built ${file}`);
