// Optional Web-editor acceptance harness.
//
// Drives a real Chromium-based browser against a Blockbench Web editor, installs the
// built plugin, and checks the four things the Web release gate asks for: connection,
// automatic reconnect, visual capture, and the full authoring workflow. It turns a gate
// that otherwise needs a human in a browser into one command.
//
//   MINECRAFT_BLOCKBENCH_TOKEN=<token> node scripts/web-acceptance.mjs
//
// Requires `npm i playwright-core` (not a project dependency) and a Chromium-based
// browser. Environment: MCP_ACCEPTANCE_EDITOR_URL (default https://web.blockbench.net),
// MCP_ACCEPTANCE_BROWSER (default msedge, then chrome, then a bundled chromium),
// MINECRAFT_BLOCKBENCH_PORT (default 39800).
//
// The relay is started by this script and a restart is performed mid-run to exercise the
// plugin's own reconnect backoff. Evidence is written to BLOCKBENCH_TEST_DIR/workflow-live.
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const token=process.env.MINECRAFT_BLOCKBENCH_TOKEN;
if(!token||token.length<16||token==='REPLACE_WITH_YOUR_RANDOM_TOKEN')throw Error('Set MINECRAFT_BLOCKBENCH_TOKEN to the relay token before running the Web acceptance');
const port=Number(process.env.MINECRAFT_BLOCKBENCH_PORT||39800);
const editorUrl=process.env.MCP_ACCEPTANCE_EDITOR_URL||'https://web.blockbench.net';
const pluginFile=resolve(root,'dist/minecraft_blockbench_mcp.js');
let chromium;
try{({chromium}=await import('playwright-core'));}
catch{throw Error('Web acceptance needs playwright-core. Install it locally with "npm i playwright-core" and a Chromium-based browser. This is not a project dependency because CI has no editor.');}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const summary={editor:editorUrl,port,connected:false,reconnected:false,workflowExit:null};
let relay=null,browser=null;
try{
 relay=await startRelayOnPort();
 browser=await launch();
 const page=await browser.newPage();
 const problems=[];
 page.on('pageerror',error=>problems.push(String(error).slice(0,200)));
 await page.goto(editorUrl,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.Blockbench?.setup_successful===true,null,{timeout:60000});
 await page.evaluate(source=>{
  const id='minecraft_blockbench_mcp';
  if(window[`${id}_cleanup`])return;            // a local host bootstrap may have loaded it
  const plugin=new Plugin(id);
  Plugins.registered[id]=plugin;
  try{Plugins.all.safePush(plugin);}catch{}
  plugin.source='file';
  try{plugin.tags.safePush('Local');}catch{}
  const script=document.createElement('script');
  script.textContent=source;
  document.head.append(script);
 },readFileSync(pluginFile,'utf8'));
 await page.waitForFunction(()=>!!window[`minecraft_blockbench_mcp_cleanup`],null,{timeout:15000});
 await page.evaluate(value=>{
  const entry=(window.settings||{})['minecraft_blockbench_mcp_token'];
  if(!entry)throw new Error('The plugin did not register its settings; check the console output above.');
  entry.value=value;
  if(typeof entry.onChange==='function')entry.onChange();
 },token);

 for(let i=0;i<20&&!summary.connected;i++){await sleep(1000);summary.connected=await editorAttached();}
 if(!summary.connected)throw Error(`The editor never connected to the relay at 127.0.0.1:${port}. ${problems.slice(-3).join(' | ')}`);
 summary.status=await status();

 // Restarting the relay must be recovered from by the plugin alone.
 await relay.close();relay=null;
 await sleep(1500);
 relay=await startRelayOnPort();
 const started=Date.now();
 for(let i=0;i<30&&!summary.reconnected;i++){await sleep(1000);summary.reconnected=await editorAttached();}
 summary.reconnectSeconds=Math.round((Date.now()-started)/1000);
 if(!summary.reconnected)throw Error('The editor did not reconnect after the relay restarted');

 console.log('running scripts/live-workflow.mjs against the connected editor\n'+'-'.repeat(64));
 summary.workflowExit=await new Promise(resolveClose=>{
  const child=spawn(process.execPath,['scripts/live-workflow.mjs','--confirm-disposable'],{cwd:root,stdio:['ignore','inherit','inherit'],
   env:{...process.env,MINECRAFT_BLOCKBENCH_TOKEN:token,MINECRAFT_BLOCKBENCH_URL:`http://127.0.0.1:${port}/mcp`,BLOCKBENCH_TEST_DIR:process.env.BLOCKBENCH_TEST_DIR||resolve(root,'.test-output')}});
  child.on('close',resolveClose);
 });
 console.log('-'.repeat(64));
 summary.visualCapture=summary.workflowExit===0;
 console.log(JSON.stringify(summary,null,2));
 process.exitCode=summary.workflowExit===0?0:1;
}finally{
 await browser?.close();
 await relay?.close();
}

async function startRelayOnPort(){
 const {startRelay}=await import(new URL('../relay/server.mjs',import.meta.url).href);
 return await startRelay({token,port,pluginFile});
}
async function launch(){
 for(const channel of [process.env.MCP_ACCEPTANCE_BROWSER, 'msedge','chrome'].filter(Boolean)){
  try{return await chromium.launch({channel,headless:true});}catch{}
 }
 return await chromium.launch({headless:true});
}
async function editorAttached(){
 const client=await mcpClient();
 if(!client)return false;
 try{
  const list=await client.listTools();
  return list.tools.some(tool=>tool.name==='mc_status');
 }catch{return false;}
 finally{try{await client.close();}catch{}}
}
async function status(){
 const client=await mcpClient();
 try{
  const result=await client.callTool({name:'mc_status',arguments:{}},undefined,{timeout:15000});
  const parsed=JSON.parse(result.content.find(content=>content.type==='text').text);
  return {mode:parsed.mode,version:parsed.version,toolCount:parsed.toolCount};
 }finally{try{await client.close();}catch{}}
}
async function mcpClient(){
 try{
  const {Client}=await import('@modelcontextprotocol/sdk/client/index.js');
  const {StreamableHTTPClientTransport}=await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client=new Client({name:'web-acceptance',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
  return client;
 }catch{return null;}
}
