// Isolated installed-Electron acceptance. Requires Blockbench --userData <test profile> --remote-debugging-port=39803.
import {writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {startRelay} from '../relay/server.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const output=process.env.BLOCKBENCH_TEST_DIR;
const plugin=process.env.MINECRAFT_BLOCKBENCH_PLUGIN_FILE;
if(!process.argv.includes('--confirm-isolated-desktop'))throw Error('Launch an isolated test profile and pass --confirm-isolated-desktop; this creates a disposable model.');
if(!output||!plugin)throw Error('Set BLOCKBENCH_TEST_DIR and MINECRAFT_BLOCKBENCH_PLUGIN_FILE');
const token=randomBytes(32).toString('hex');
const relay=await startRelay({port:39802,token,pluginFile:plugin});
const targets=await(await fetch('http://127.0.0.1:39803/json/list')).json();
const target=targets.find(t=>t.url.startsWith('file:')&&t.title.includes('Blockbench'));
if(!target)throw Error('No installed Blockbench test target');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});
let id=0;const pending=new Map();ws.on('message',b=>{const m=JSON.parse(String(b));if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}});
const send=(method,params={})=>new Promise((r,j)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);j(Error('Desktop protocol timeout'))},30000);pending.set(n,m=>{clearTimeout(timer);m.error?j(Error(JSON.stringify(m.error))):r(m.result)});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
const client=new Client({name:'installed-desktop-acceptance',version:'1'});
const report={};
try {
 report.events=[];ws.on('message',b=>{const m=JSON.parse(String(b));if(m.method==='Runtime.exceptionThrown'||m.method==='Runtime.consoleAPICalled')report.events.push(m.params)});await send('Runtime.enable');
 report.network=[];ws.on('message',b=>{const m=JSON.parse(String(b));if(m.method==='Network.webSocketWillSendHandshakeRequest')report.network.push({origin:m.params.request.headers.Origin});if(m.method==='Network.webSocketFrameError')report.network.push({error:m.params.errorMessage})});await send('Network.enable');
 report.application=await evaluate('({version:Blockbench.version,isApp})');
 if(!report.application.isApp)throw Error('Not the installed desktop application');
 await evaluate(`globalThis.acceptanceMessages=[];globalThis.acceptanceOriginalMessage??=Blockbench.showQuickMessage;Blockbench.showQuickMessage=function(...args){acceptanceMessages.push(String(args[0]));return acceptanceOriginalMessage.apply(this,args)}`);
 await evaluate(`new Plugin().loadFromFile({path:${JSON.stringify(plugin)},name:'minecraft_blockbench_mcp.js',content:''},false)`);
 await evaluate(`settings.minecraft_blockbench_mcp_token.value=${JSON.stringify(token)};settings.minecraft_blockbench_mcp_relay.value='ws://127.0.0.1:39802/bridge';BarItems.minecraft_blockbench_mcp_connect.trigger();true`);
 await new Promise(r=>setTimeout(r,5000));
 report.messages=await evaluate('acceptanceMessages');
 await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:39802/mcp'),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
 report.tools=(await client.listTools()).tools.length;
 for(const name of ['mc_status','mc_workflow_capabilities']){report[name]=await client.callTool({name,arguments:{}});if(report[name].isError)throw Error(`${name} failed`)}
 const child=spawn(process.execPath,['scripts/live-workflow.mjs','--confirm-disposable'],{cwd:new URL('..',import.meta.url),env:{...process.env,MINECRAFT_BLOCKBENCH_URL:'http://127.0.0.1:39802/mcp',MINECRAFT_BLOCKBENCH_TOKEN:token},stdio:['ignore','pipe','pipe'],windowsHide:true});
 report.workflowLog='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>report.workflowLog+=String(b));
 report.workflowExit=await new Promise((r,j)=>{child.once('exit',r);child.once('error',j)});if(report.workflowExit!==0)throw Error('Desktop workflow failed');
 report.accepted=true;
}catch(e){report.error=String(e);process.exitCode=1}
finally{await evaluate('if(globalThis.acceptanceOriginalMessage){Blockbench.showQuickMessage=acceptanceOriginalMessage;delete globalThis.acceptanceOriginalMessage;delete globalThis.acceptanceMessages}').catch(()=>{});await writeFile(`${output}/desktop.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({application:report.application,tools:report.tools,workflowExit:report.workflowExit,accepted:report.accepted,error:report.error}));await client.close();ws.close();await relay.close()}
