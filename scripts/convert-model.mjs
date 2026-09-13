import fs from 'node:fs/promises';
import path from 'node:path';
import {recoverYsm,identifyYsm} from '../src/converters/ysm/index.mjs';
const args=process.argv.slice(2);
if(args.length<2){console.error('Usage: node scripts/convert-model.mjs input.ysm NEW_OUTPUT_DIRECTORY [texture/path.png]\n       node scripts/convert-model.mjs --identify input.ysm');process.exitCode=1;}
else try {
 if(args[0]==='--identify')console.log(JSON.stringify(identifyYsm(await fs.readFile(args[1])),null,2));
 else {
  const input=path.resolve(args[0]),output=path.resolve(args[1]);
  const bytes=await fs.readFile(input);const result=await recoverYsm(bytes,{texture:args[2]});
  // Exclusive root creation: never overwrite an existing model/output tree.
  await fs.mkdir(output,{recursive:false});
  for(const file of result.assets){const dest=path.resolve(output,'assets',file.path);if(!dest.startsWith(output+path.sep))throw Error('Unsafe output path');await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,Buffer.from(file.data,'base64'),{flag:'wx'});}
  for(const file of result.models)await fs.writeFile(path.join(output,file.filename),JSON.stringify(file.model,null,2),{flag:'wx'});
  await fs.writeFile(path.join(output,'recovery-report.json'),JSON.stringify(result.report,null,2),{flag:'wx'});
  console.log(JSON.stringify({output,...result.report},null,2));
 }
}catch(e){console.error(e.message);process.exitCode=1;}
