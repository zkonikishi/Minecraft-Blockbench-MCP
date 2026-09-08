import { createRuntime } from './runtime.js';
import { type ToolRegistry, errorResult } from './registry.js';
const G=globalThis as any;
const ID='minecraft_blockbench_mcp';
// A plugin loaded again from a file must release its previous bridge and actions.
const previousDrain=G[`${ID}_cleanup`]?.();
let socket:WebSocket|null=null;
let runtime:ToolRegistry|null=null;
let draining:Promise<void>=Promise.resolve(previousDrain);
let generation=0;
let loaded=false;
const disposables:{delete:()=>void}[]=[];
function cleanup(){loaded=false;disconnect();for(const item of disposables.splice(0))item.delete();return draining;}
G[`${ID}_cleanup`]=cleanup;
const setting=(key:string)=>G.settings?.[`${ID}_${key}`]?.value;
function message(text:string){G.Blockbench?.showQuickMessage?.(text,4000);}
function disconnect(){
  generation++;
  if(runtime){runtime.stop();draining=runtime.drain();runtime=null;}
  socket?.close();socket=null;
}
async function connect(){
  disconnect();const ticket=generation;
  await draining;
  if(!loaded||ticket!==generation)return;
  const token=String(setting('token')||'');
  if(token.length<16){message('Set an MCP token of at least 16 characters in Settings first.');return;}
  const address=String(setting('relay')||'ws://127.0.0.1:39800/bridge');
  let url:URL;
  try{url=new URL(address);}catch{message('Invalid MCP bridge URL');return;}
  if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||url.search){message('Use ws://127.0.0.1:39800/bridge or an authenticated local WSS proxy.');return;}
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)){message('MCP bridge must be on loopback.');return;}
  try {
    const current=createRuntime({desktop:G.isApp===true,advanced:setting('advanced')===true});runtime=current;
    const ws=new WebSocket(url);socket=ws;
    ws.onopen=()=>ws.send(JSON.stringify({type:'hello',token,tools:current.list(),mode:G.isApp?'desktop':'web'}));
    ws.onmessage=async event=>{
      if(ticket!==generation)return;
      let data:any;
      try{data=JSON.parse(String(event.data));}catch{return;}
      if(!data||typeof data!=='object'||Array.isArray(data))return;
      if(data.type==='ready'){message('Minecraft Blockbench MCP connected');return;}
      if(data.type!=='call'||typeof data.id!=='string'||typeof data.name!=='string')return;
      const result=await current.call(data.name,data.arguments).catch(errorResult);
      if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'result',id:data.id,result}));
    };
    ws.onerror=()=>message('MCP connection failed. Check the relay, token and browser local-network permission.');
    ws.onclose=()=>{current.stop();if(socket===ws){socket=null;message('Minecraft Blockbench MCP disconnected');}};
  }catch(e){message(`MCP startup failed: ${e instanceof Error?e.message:String(e)}`);disconnect();}
}
G.Plugin.register(ID,{
  title:'Minecraft Blockbench MCP',author:'zkonikishi; Jason J. Gardner; SwagRee; sosadly',
  description:'Unified Minecraft creature authoring for BetterModel and ModelEngine. Desktop and Web.',
  icon:'smart_toy',version:'0.1.0-alpha.5',variant:'both',min_version:'5.1.0',
  onload(){
    loaded=true;
    for(const [key,options] of Object.entries({
      relay:{value:'ws://127.0.0.1:39800/bridge',type:'text',name:'Minecraft MCP bridge URL',description:'Local relay address. Reconnect after changing.'},
      token:{value:'',type:'password',name:'Minecraft MCP token',description:'Use the same secret token as your local relay. Reconnect after changing.'},
      advanced:{value:false,type:'toggle',name:'Minecraft MCP advanced tools',description:'Enable script execution and general UI/plugin operations. Reconnect after changing.'},
      autoconnect:{value:true,type:'toggle',name:'Minecraft MCP auto connect',description:'Connect to your configured loopback relay when the plugin loads.'},
    })) {
      const id=`${ID}_${key}`;
      if(!G.settings?.[id])new G.Setting(id,{category:'general',...options});
    }
    const add=(id:string,name:string,click:()=>void)=>{
      G.BarItems?.[id]?.delete();
      const action=new G.Action(id,{name,icon:'smart_toy',click});disposables.push(action);G.MenuBar.addAction(action,'tools');
    };
    add(`${ID}_connect`,'Connect Minecraft MCP',()=>{void connect();});
    add(`${ID}_disconnect`,'Disconnect Minecraft MCP',()=>{disconnect();message('Minecraft MCP stopped');});
    message('Minecraft MCP loaded. Configure token in Settings, then Tools → Connect Minecraft MCP.');
    if(setting('autoconnect')&&String(setting('token')||'').length>=16)void connect();
  },
  onunload(){cleanup();if(G[`${ID}_cleanup`]===cleanup)delete G[`${ID}_cleanup`];},
});
