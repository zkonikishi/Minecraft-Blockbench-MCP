import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const code=readFileSync(resolve(process.env.BLOCKBENCH_TEST_DIR,'plugin.js'),'utf8');
const settle=()=>new Promise(ok=>setImmediate(ok));
function host(autoconnect=true){
 const sockets=[],actions=new Map(),settings={minecraft_blockbench_mcp_token:{value:'test-token-never-a-real-secret'},minecraft_blockbench_mcp_autoconnect:{value:autoconnect}};
 const context=vm.createContext({console,URL,setTimeout,clearTimeout,TextEncoder,TextDecoder,settings,BarItems:{},Blockbench:{showQuickMessage(){}},MenuBar:{addAction(){}},Plugin:{register(_id,definition){context.plugin=definition;}},
 Setting:class{constructor(id,options){settings[id]={...options};}},
 Action:class{constructor(id,options){this.id=id;this.click=options.click;actions.set(id,this);context.BarItems[id]=this;}delete(){actions.delete(this.id);delete context.BarItems[this.id];}},
 WebSocket:class{static OPEN=1;constructor(url){this.url=url;sockets.push(this);}close(){this.closed=true;}},
 });return {context,sockets,actions,settings};
}
test('plugin load auto-connects once and unload releases socket while retaining credentials',async()=>{
 const h=host();vm.runInContext(code,h.context);h.context.plugin.onload();await settle();assert.equal(h.sockets.length,1);assert.equal(h.actions.size,2);h.context.plugin.onunload();assert(h.sockets[0].closed);assert.equal(h.actions.size,0);assert(h.settings.minecraft_blockbench_mcp_token.value);
});
test('plugin replacement releases old instance and leaves one action pair',async()=>{
 const h=host();vm.runInContext(code,h.context);h.context.plugin.onload();await settle();vm.runInContext(code,h.context);h.context.plugin.onload();await settle();assert.equal(h.sockets.length,2);assert(h.sockets[0].closed);assert(!h.sockets[1].closed);assert.equal(h.actions.size,2);h.context.plugin.onunload();
});
test('disabled auto-connect does not open a socket and immediate unload cancels pending connect',async()=>{
 const h=host(false);vm.runInContext(code,h.context);h.context.plugin.onload();await settle();assert.equal(h.sockets.length,0);h.settings.minecraft_blockbench_mcp_autoconnect.value=true;h.context.plugin.onload();h.context.plugin.onunload();await settle();assert.equal(h.sockets.length,0);
});
