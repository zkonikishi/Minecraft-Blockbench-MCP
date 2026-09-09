import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function installPack(manifest,resources,apply=false){
 if(manifest?.schemaVersion!==1||manifest.target!=='CraftEngine'||!/^[a-z0-9_-]{1,64}$/.test(manifest.pack))throw Error('Invalid CraftEngine manifest');
 if(!Array.isArray(manifest.files)||manifest.files.length<2||manifest.files.length>1000)throw Error('Invalid files list');
 const seen=new Set();let total=0;
 for(const file of manifest.files){
  if(typeof file.path!=='string'||!(/^(pack\.yml|configuration\/[a-z0-9_-]+\.yml|blueprint\/[a-z0-9_-]+\.bbmodel)$/.test(file.path)))throw Error('Unsupported or unsafe manifest path');
  if(seen.has(file.path.toLowerCase()))throw Error('Duplicate manifest path');seen.add(file.path.toLowerCase());
  if(file.encoding!=='utf8'||typeof file.content!=='string')throw Error('Expected UTF-8 content');
  total+=Buffer.byteLength(file.content);if(total>128*1024*1024)throw Error('Manifest too large');
  JSON.parse(file.content); // Generated YAML uses the JSON subset; reject arbitrary text.
 }
 if(!seen.has('pack.yml')||![...seen].some(p=>p.startsWith('configuration/')))throw Error('Missing pack metadata/configuration');
 const root=fs.realpathSync(resources),target=path.join(root,manifest.pack);
 if(fs.existsSync(target))throw Error(`Destination already exists; review or choose another pack: ${target}`);
 const report={apply,target,files:manifest.files.map(f=>f.path),bytes:total};
 if(!apply)return report;
 // Stage outside resources; CE never observes an incomplete content directory.
 const staging=fs.mkdtempSync(path.join(path.dirname(root),'.mcp-pack-'));
 try{
  for(const file of manifest.files){const output=path.join(staging,...file.path.split('/'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,file.content,{flag:'wx'});}
  if(fs.existsSync(target))throw Error('Destination appeared during staging');
  fs.renameSync(staging,target);
 }catch(error){
  // Deliberately retain staging for inspection; never recursively delete a calculated path.
  throw Error(`${error.message}; inspect staging: ${staging}`);
 }
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [manifestFile,resources,...flags]=process.argv.slice(2);
 if(!manifestFile||!resources||flags.some(f=>f!=='--apply'))throw Error('Usage: node scripts/install-craftengine-pack.mjs MANIFEST.json CE_RESOURCES_DIR [--apply]');
 console.log(JSON.stringify(installPack(JSON.parse(fs.readFileSync(manifestFile,'utf8')),resources,flags.includes('--apply')),null,2));
}
