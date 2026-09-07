import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
if(!process.argv.includes('--confirm-disposable'))throw new Error('Live smoke creates a new test project. Pass --confirm-disposable after connecting your test editor.');
const client=new Client({name:'minecraft-blockbench-live-smoke',version:'1'});
const token=process.env.MINECRAFT_BLOCKBENCH_TOKEN;
if(!token)throw new Error('Set MINECRAFT_BLOCKBENCH_TOKEN');
const output=resolve(process.env.BLOCKBENCH_TEST_DIR||'.test-output','live');mkdirSync(output,{recursive:true});
const evidence=[];
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(process.env.MINECRAFT_BLOCKBENCH_URL||'http://127.0.0.1:39800/mcp'),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
  async function call(name,args={}) {
    const result=await client.callTool({name,arguments:args});
    evidence.push({name,result});if(result.isError)throw new Error(`${name}: ${JSON.stringify(result.content)}`);
    const text=result.content.find(c=>c.type==='text')?.text;try{return JSON.parse(text);}catch{return text;}
  }
  const catalogue=await client.listTools();if(!catalogue.tools.some(t=>t.name==='mc_create_project'))throw new Error('Test editor not connected');
  writeFileSync(resolve(output,'catalogue.json'),JSON.stringify(catalogue,null,2));
  await call('mc_status');
  await call('mc_create_project',{name:'mcp_smoke_dragon',target:'both',texture_size:128});
  await call('mc_scaffold_creature',{archetype:'dragon'});
  await call('mc_create_animation_set',{target:'both'});
  await call('studio_get_project_info');
  await call('craft_ensure_texture',{name:'smoke_dragon',width:128,height:128,fill:'#387c68'});
  await call('craft_pack_box_uv',{mode:'face',auto_resize:true});
  await call('anim_add_keyframes',{animation:'idle',keyframes:[
    {bone:'body',channel:'position',time:0,value:[0,0,0],interpolation:'linear'},
    {bone:'body',channel:'position',time:0.5,value:[0,0.5,0],interpolation:'linear'},
    {bone:'body',channel:'position',time:1,value:[0,0,0],interpolation:'linear'}
  ]});
  await call('anim_list_animations');
  await call('craft_capture_views',{views:['iso'],max_edge:512,format:'png'});
  const preview=evidence.at(-1).result.content.find(c=>c.type==='image');
  if(!preview)throw new Error('Preview image missing');
  writeFileSync(resolve(output,'preview.png'),Buffer.from(preview.data,'base64'));
  await call('mc_audit_model',{target:'both'});
  const exported=await call('mc_export_bbmodel',{target:'both'});
  if(!exported.model?.elements?.length||!exported.model?.animations?.length)throw new Error('Export missing geometry or animation slots');
  if(!exported.model.textures?.some(t=>t.source?.startsWith('data:image/png;base64,')))throw new Error('Embedded PNG missing');
  const idle=exported.model.animations.find(a=>a.name==='idle');
  if(!Object.values(idle?.animators||{}).some(a=>a.keyframes?.length>=3))throw new Error('Authored keyframes missing');
  writeFileSync(resolve(output,'mcp_smoke_dragon.bbmodel'),JSON.stringify(exported.model,null,2));
  console.log(`Live editor pipeline passed. Static blockout only; engine runtime acceptance remains separate. ${output}`);
}finally{writeFileSync(resolve(output,'evidence.json'),JSON.stringify(evidence,null,2));await client.close();}
