import {mkdir,lstat,readdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
export async function stageRelease(output,build=resolve(root,'dist')){
 output=resolve(output);build=resolve(build);
 // Never stage within a source subtree that this operation copies.
 if(!relative(root,output).startsWith('..'))throw Error('Release staging directory must be outside the repository');
 await mkdir(output);const manifest=[];
 async function copy(source,destination){
  const stat=await lstat(source);if(stat.isSymbolicLink())throw Error(`Symlinks are not allowed in release sources: ${relative(root,source)}`);
  if(stat.isDirectory()){await mkdir(destination);for(const name of (await readdir(source)).sort())await copy(join(source,name),join(destination,name));return;}
  if(!stat.isFile())throw Error('Unsupported release file type');
  await copyFile(source,destination);const bytes=await readFile(destination);manifest.push({path:relative(output,destination).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 for(const name of ['package.json','package-lock.json','.env.example','README.md','LICENSE','THIRD_PARTY_NOTICES.md','relay','scripts','docs'])await copy(join(root,name),join(output,name));
 await mkdir(join(output,'src'));await copy(join(root,'src/converters'),join(output,'src/converters'));
 await mkdir(join(output,'vendor'));await copy(join(root,'vendor/ysmparser'),join(output,'vendor/ysmparser'));
 await mkdir(join(output,'dist'));await copy(join(build,'minecraft_blockbench_mcp.js'),join(output,'dist/minecraft_blockbench_mcp.js'));
 await writeFile(join(output,'manifest.json'),JSON.stringify({version:JSON.parse(await readFile(join(root,'package.json'),'utf8')).version,files:manifest},null,2),{flag:'wx'});
 return {output,files:manifest.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length<3)throw Error('Usage: node scripts/stage-release.mjs NEW_EXTERNAL_DIRECTORY [BUILD_DIRECTORY]');
 console.log(JSON.stringify(await stageRelease(process.argv[2],process.argv[3])));
}
