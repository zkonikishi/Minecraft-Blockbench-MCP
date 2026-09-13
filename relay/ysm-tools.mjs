import {identifyYsm,recoverYsm} from '../src/converters/ysm/index.mjs';
let recovering=false;
export const ysmTools=['mc_ysm_inspect','mc_ysm_recover'].map(name=>({name,description:name==='mc_ysm_inspect'?'Identify a supplied YSM container offline; no editor or Minecraft needed.':'Recover a supplied YSM container offline to editable bbmodel JSON plus original assets and an explicit loss report. No editor import or disk writes. Controllers/runtime semantics are not reconstructed. Optional import uses mc_import_bbmodel separately.',inputSchema:{type:'object',properties:{data:{type:'string',description:'Base64 encoded .ysm bytes (maximum 32 MiB decoded).',maxLength:44739244},texture:{type:'string',maxLength:512}},required:['data'],additionalProperties:false}}));
export async function callYsm(name,args){
 try {
  if(!args||typeof args.data!=='string'||args.data.length>44739244||!args.data.length||Buffer.from(args.data,'base64').toString('base64')!==args.data)throw Error('Expected valid base64 YSM data, max 32 MiB');
  if(Object.keys(args).some(k=>!['data','texture'].includes(k))||(args.texture!==undefined&&(typeof args.texture!=='string'||args.texture.length>512)))throw Error('Invalid YSM arguments');
  const bytes=Buffer.from(args.data,'base64');
  let result;
  if(name==='mc_ysm_inspect')result=identifyYsm(bytes);
  else {if(recovering)throw Error('YSM recovery busy; wait for the current conversion');recovering=true;try{result=await recoverYsm(bytes,{texture:args.texture});}finally{recovering=false;}}
  return {content:[{type:'text',text:JSON.stringify(result)}]};
 }catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
}
