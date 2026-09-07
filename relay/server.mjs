import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import {readFile} from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListToolsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
const fail=message=>({isError:true,content:[{type:'text',text:message}]});
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}

/** A loopback MCP endpoint shared by the desktop and Web plugin. */
export async function startRelay({token,port=39800,requestTimeout=120000,pluginFile}={}) {
  if(typeof token!=='string'||token.length<16)throw new Error('MINECRAFT_BLOCKBENCH_TOKEN must be at least 16 characters');
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid loopback port');
  const origins=new Set(['https://web.blockbench.net','https://www.blockbench.net','https://blockbench.net','null']);
  const trustedOrigin=origin=>!origin||origins.has(origin)||/^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin);
  let bridge=null;
  let tools=[];
  const pending=new Map();
  const transports=new Set();
  const wsServer=new WebSocketServer({noServer:true,maxPayload:16*1024*1024});
  const rejectPending=message=>{for(const {resolve,timer} of pending.values()){clearTimeout(timer);resolve(fail(message));}pending.clear();};
  const invoke=(name,args)=>{
    if(!bridge||bridge.readyState!==WebSocket.OPEN)return Promise.resolve(fail('Blockbench disconnected. Load the plugin, then Tools → Connect Minecraft MCP.'));
    if(!tools.some(t=>t.name===name))return Promise.resolve(fail(`Unknown tool: ${name}`));
    if(pending.size>=64)return Promise.resolve(fail('Too many outstanding requests'));
    const id=randomUUID();
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{pending.delete(id);resolve(fail('Tool response timed out. The editor may still be executing; inspect its state before retrying.'));},requestTimeout);
      pending.set(id,{resolve,timer});
      try{bridge.send(JSON.stringify({type:'call',id,name,arguments:args??{}}));}
      catch{clearTimeout(timer);pending.delete(id);resolve(fail('Bridge send failed'));}
    });
  };
  const app=http.createServer(async(req,res)=>{
    const host=req.headers.host||'';
    if(!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)){res.writeHead(403).end();return;}
    if(!trustedOrigin(req.headers.origin)){res.writeHead(403).end();return;}
    if(req.url==='/minecraft_blockbench_mcp.js'&&req.method==='GET'&&pluginFile){
      try{const code=await readFile(pluginFile);res.writeHead(200,{'Content-Type':'application/javascript','Access-Control-Allow-Origin':req.headers.origin||'*','Cache-Control':'no-store'}).end(code);}catch{res.writeHead(404).end();}return;
    }
    if(req.url==='/health'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({service:'Minecraft Blockbench MCP',ok:true}));return;}
    if(req.url!=='/mcp'){res.writeHead(404).end();return;}
    if(!equal(req.headers.authorization,`Bearer ${token}`)){res.writeHead(401).end();return;}
    if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'}).end();return;}
    const server=new Server({name:'minecraft-blockbench-mcp',version:'0.1.0-alpha.2'},{capabilities:{tools:{}}});
    server.setRequestHandler(ListToolsRequestSchema,async()=>({tools}));
    server.setRequestHandler(CallToolRequestSchema,async request=>invoke(request.params.name,request.params.arguments));
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    transports.add(transport);
    res.on('close',()=>{transports.delete(transport);void server.close();});
    try{await server.connect(transport);await transport.handleRequest(req,res);}
    catch{if(!res.headersSent)res.writeHead(500).end();}
  });
  app.on('upgrade',(req,socket,head)=>{
    const host=req.headers.host||'';
    if(req.url!=='/bridge'||!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)||!trustedOrigin(req.headers.origin)){socket.destroy();return;}
    wsServer.handleUpgrade(req,socket,head,ws=>{
      let authenticated=false;
      const timer=setTimeout(()=>ws.close(1008,'Authentication timeout'),5000);
      ws.on('error',()=>{});
      ws.on('message',raw=>{
        let data;try{data=JSON.parse(raw.toString());}catch{ws.close(1008,'Invalid JSON');return;}
        if(!data||typeof data!=='object'||Array.isArray(data)){ws.close(1008,'Expected message object');return;}
        if(!authenticated){
          if(data.type!=='hello'||!equal(data.token,token)){ws.close(1008,'Authentication failed');return;}
          if(bridge){ws.close(1008,'Another Blockbench window is connected');return;}
          const catalogue=ListToolsResultSchema.safeParse({tools:data.tools});
          if(!catalogue.success||catalogue.data.tools.length>512||new Set(catalogue.data.tools.map(t=>t.name)).size!==catalogue.data.tools.length){ws.close(1008,'Invalid tool catalogue');return;}
          clearTimeout(timer);authenticated=true;bridge=ws;tools=catalogue.data.tools;ws.send(JSON.stringify({type:'ready'}));return;
        }
        if(data.type!=='result'||typeof data.id!=='string')return;
        const waiter=pending.get(data.id);if(!waiter)return;
        const result=CallToolResultSchema.safeParse(data.result);
        clearTimeout(waiter.timer);pending.delete(data.id);waiter.resolve(result.success?result.data:fail('Editor returned invalid MCP content'));
      });
      ws.on('close',()=>{clearTimeout(timer);if(bridge===ws){bridge=null;tools=[];rejectPending('Blockbench disconnected during execution; inspect state before retrying.');}});
    });
  });
  app.requestTimeout=150000;app.headersTimeout=15000;
  await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(port,'127.0.0.1',resolve);});
  return {port:app.address().port,connected:()=>!!bridge,
    async close(){rejectPending('Relay stopped');for(const ws of wsServer.clients)ws.terminate();for(const t of transports)await t.close();wsServer.close();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}};
}
