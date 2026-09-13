import {parentPort,workerData} from 'node:worker_threads';
import fs from 'node:fs';
import vm from 'node:vm';
// Pinned trusted parser. Only its virtual filesystem receives model input.
const base=new URL('../../../vendor/ysmparser/',import.meta.url);
let context;let stage="init";
try {
 context=vm.createContext({console:{log(){},error(){}},WebAssembly,TextDecoder,TextEncoder,setTimeout,clearTimeout,performance,URL});
 vm.runInContext(fs.readFileSync(new URL('YSMParser.js',base),'utf8'),context,{timeout:10000});
 const m=await context.YSMParserModule({noInitialRun:true,wasmBinary:fs.readFileSync(new URL('YSMParser.wasm',base)),print(){},printErr(){}});
 const F=m.FS;F.mkdir('/input');F.mkdir('/output');F.writeFile('/input/model.ysm',new Uint8Array(workerData));
 stage='parse';const code=m.callMain(['-i','/input','-o','/output']);
 const files=[];let total=0;
 function walk(dir){for(const name of F.readdir(dir).filter(n=>n!=='.'&&n!=='..')){const path=dir+'/'+name,stat=F.stat(path);if(F.isDir(stat.mode))walk(path);else{total+=stat.size;if(total>128*1024*1024||files.length>=2048)throw Error('Extracted assets exceed limit');files.push({path:path.slice('/output/model/'.length),data:Buffer.from(F.readFile(path)).toString('base64')});}}}
 stage='read output';walk('/output');if(code||!files.length)throw Error(`Parser failed (${code}); unsupported or malformed YSM`);
 parentPort.postMessage({files});
}catch(e){parentPort.postMessage({error:stage+': '+String(e.message||JSON.stringify(e))+String(e.stack||'')});}
