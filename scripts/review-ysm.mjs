import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {collectReview,reviewHtml} from './ysm-review-lib.mjs';
const args=process.argv.slice(2),confirm=args.includes('--confirm-new-project');
const paths=args.filter(a=>a!=='--confirm-new-project');
if(!confirm||paths.length!==2)throw Error('Usage: node scripts/review-ysm.mjs MODEL.bbmodel NEW_OUTPUT_DIRECTORY --confirm-new-project (creates a new editor tab; keep editor idle)');
const source=await readFile(resolve(paths[0]));
if(source.length>64*1024*1024)throw Error('Model exceeds 64 MiB');
const model=JSON.parse(source),output=resolve(paths[1]);
await mkdir(output); // Exclusive: never overwrite an existing evidence directory.
const report={createdAt:new Date().toISOString(),sha256:createHash('sha256').update(source).digest('hex'),captureComplete:false,visualVerified:false,clientVerified:false,images:[]};
const client=new Client({name:'ysm-visual-review',version:'1'});
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(process.env.MINECRAFT_BLOCKBENCH_URL||'http://127.0.0.1:39800/mcp'),{requestInit:{headers:{Authorization:`Bearer ${process.env.MINECRAFT_BLOCKBENCH_TOKEN||''}`}}}));
  await collectReview({model,report,call:(name,args)=>client.callTool({name,arguments:args},undefined,{timeout:120000}),saveImage:(name,bytes)=>writeFile(join(output,name),bytes,{flag:'wx'})});
}catch(error){report.error=error.message;}
finally {
  await writeFile(join(output,'review.json'),JSON.stringify(report,null,2),{flag:'wx'});
  await writeFile(join(output,'index.html'),reviewHtml(report),{flag:'wx'});
  await client.close();
}
console.log(JSON.stringify({output,captureComplete:report.captureComplete,images:report.images.length,error:report.error,cleanupError:report.cleanupError}));
if(!report.captureComplete||report.cleanupError)process.exitCode=1;
