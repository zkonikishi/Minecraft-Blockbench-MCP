import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {jsonResult} from './visual-review-lib.mjs';
import {frameTimes,playerHtml} from './animation-review-lib.mjs';
const args=process.argv.slice(2);
if(args.length!==3||args[2]!=='--confirm-preview')throw Error('Usage: node --env-file=.env scripts/review-animation.mjs ANIMATION NEW_DIRECTORY --confirm-preview. Pause animation playback and keep editor idle.');
const output=resolve(args[1]);await mkdir(output);
const report={animation:args[0],captureComplete:false,visualVerified:false,clientVerified:false,times:[],frames:[]};
const client=new Client({name:'animation-review',version:'1'});
const call=(name,args={})=>client.callTool({name,arguments:args},undefined,{timeout:120000});
try{
 await client.connect(new StreamableHTTPClientTransport(new URL(process.env.MINECRAFT_BLOCKBENCH_URL||'http://127.0.0.1:39800/mcp'),{requestInit:{headers:{Authorization:`Bearer ${process.env.MINECRAFT_BLOCKBENCH_TOKEN||''}`}}}));
 const project=jsonResult(await call('mc_status')).project?.uuid;if(!project)throw Error('Open a project first');
 const guard=async()=>{if(jsonResult(await call('mc_status')).project?.uuid!==project)throw Error('Project changed; stopped without retry');};
 report.project=project;report.diagnostics=jsonResult(await call('mc_animation_diagnose',{animation:args[0]}));
 report.times=frameTimes(report.diagnostics.length);report.effectiveFps=(report.times.length-1)/report.diagnostics.length;
 await guard();report.frame=jsonResult(await call('mc_visual_detail',{views:['iso'],max_edge:256})).frame;
 for(let offset=0;offset<report.times.length;offset+=8){
   await guard();const times=report.times.slice(offset,offset+8);
   const result=await call('mc_visual_animation',{animation:args[0],times,views:['iso'],max_edge:256,frame:report.frame});
   if(result.isError)jsonResult(result);await guard();
   const images=result.content.filter(c=>c.type==='image');if(images.length!==times.length)throw Error('Incomplete frame batch');
   for(const img of images){const bytes=Buffer.from(img.data,'base64');if(img.mimeType!=='image/png'||!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('Invalid PNG frame');const name=`frame-${String(report.frames.length).padStart(4,'0')}.png`;await writeFile(join(output,name),bytes,{flag:'wx'});report.frames.push(name);}
 }
 report.captureComplete=true;
}catch(e){report.error=e.message;process.exitCode=1;}
finally{await writeFile(join(output,'review.json'),JSON.stringify(report,null,2),{flag:'wx'});await writeFile(join(output,'index.html'),playerHtml(report),{flag:'wx'});await client.close();}
console.log(JSON.stringify({output,frames:report.frames.length,captureComplete:report.captureComplete,error:report.error}));
