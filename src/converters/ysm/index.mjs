import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {convertAssets} from './model.mjs';
export function identifyYsm(bytes){
 const b=Buffer.from(bytes);if(b.length<8)return {supported:false,format:'unknown'};
 const magic=b.subarray(0,4).toString('hex');
 const version=b.readUInt32BE(4);
 return {format:magic==='59534750'?'YSGP':b.subarray(0,7).toString('hex')==='efbbbf59534750'?'BOM-v3':'unknown',containerVersion:magic==='59534750'?version:null,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
}
export async function recoverYsm(bytes,{texture}={}){
 const b=Buffer.from(bytes);if(!b.length||b.length>32*1024*1024)throw Error('YSM input must be 1 byte to 32 MiB');
 const files=await new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:b,execArgv:[],resourceLimits:{maxOldGenerationSizeMb:256}});
  const timer=setTimeout(()=>{void worker.terminate();reject(Error('YSM parser exceeded 30 second limit'));},30000);
  const finish=(err,result)=>{clearTimeout(timer);void worker.terminate();err?reject(err):resolve(result);};
  worker.once('message',m=>finish(m.error?Error(m.error):null,m.files));worker.once('error',e=>finish(e));worker.once('exit',code=>{if(code)finish(Error(`Parser worker exited ${code}`));});
 });
 for(const f of files)if(!f.path||f.path.includes('..')||f.path.startsWith('/')||/[\\:\x00]/.test(f.path))throw Error('Unsafe extracted asset path');
 const result=convertAssets(files,{texture});
 return {...result,assets:files,report:{...result.report,input:identifyYsm(b),parser:'OpenYSM/YSMParser v0.3.5',clientVerified:false,lossless:false}};
}
