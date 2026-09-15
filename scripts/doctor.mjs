import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const report={initialized:false,editorConnected:false,ready:false};
const client=new Client({name:'minecraft-blockbench-doctor',version:'1'});
try{
 const token=process.env.MINECRAFT_BLOCKBENCH_TOKEN;
 if(!token||token.length<16||token==='REPLACE_WITH_YOUR_RANDOM_TOKEN')throw Error('Set a private random MINECRAFT_BLOCKBENCH_TOKEN in your env file');
 const url=new URL(process.env.MINECRAFT_BLOCKBENCH_URL||`http://127.0.0.1:${process.env.MINECRAFT_BLOCKBENCH_PORT||39800}/mcp`);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.protocol!=='http:'||url.username||url.password)throw Error('Doctor accepts only loopback HTTP endpoints without URL credentials');
 await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));report.initialized=true;
 const list=await client.listTools();report.toolCount=list.tools.length;
 const required=['mc_status','mc_visual_capture','mc_visual_animation','mc_animation_diagnose','mc_animation_chain'];
 report.missingTools=required.filter(name=>!list.tools.some(t=>t.name===name));
 if(!list.tools.some(t=>t.name==='mc_status'))throw Error('Editor bridge is disconnected: load plugin and choose Tools > Connect Minecraft MCP');
 const result=await client.callTool({name:'mc_status',arguments:{}},undefined,{timeout:15000});
 if(result.isError)throw Error('Editor status call failed; inspect the editor bridge');
 const status=JSON.parse(result.content.find(c=>c.type==='text')?.text);report.editorConnected=true;report.version=status.version;report.mode=status.mode;report.projectOpen=!!status.project;
 report.ready=report.missingTools.length===0;
 if(!report.ready)report.error='Editor plugin is outdated or required tools are missing';
}catch(error){report.error=error.message;}
finally{await client.close();}
console.log(JSON.stringify(report,null,2));if(!report.ready)process.exitCode=1;
