import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {startRelay} from '../relay/server.mjs';
const token='test-only-token-not-a-deployed-secret';
const catalogue=[{name:'test_tool',description:'mock host probe',inputSchema:{type:'object'}}];
test('SDK preserves exports exceeding the old 16 MiB bridge limit',async()=>{
 const relay=await startRelay({token,port:0});let ws,client;
 const payload='x'.repeat(17*1024*1024);
 try{
  ws=await editor(relay.port);
  ws.on('message',raw=>{const msg=JSON.parse(raw);if(msg.type==='call')ws.send(JSON.stringify({type:'result',id:msg.id,result:{content:[{type:'text',text:payload}]}}));});
  client=new Client({name:'large-export-test',version:'1'});
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${relay.port}/mcp`),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
  const result=await client.callTool({name:'test_tool',arguments:{}});assert.equal(result.content[0].text,payload);assert.equal(relay.connected(),true);
 }finally{await client?.close();ws?.terminate();await relay.close();}
});
test('malformed JSON shapes close only their unauthenticated socket',async()=>{
  const relay=await startRelay({token,port:0});
  try{for(const value of [null,[],42,{type:'hello',token:{},tools:[]}]){
    const ws=new WebSocket(`ws://127.0.0.1:${relay.port}/bridge`);await once(ws,'open');
    const closed=once(ws,'close');ws.send(JSON.stringify(value));assert.equal((await closed)[0],1008);
    assert.equal((await fetch(`http://127.0.0.1:${relay.port}/health`)).status,200);
  }}finally{await relay.close();}
});
async function editor(port,secret=token,origin='https://web.blockbench.net'){
  const ws=new WebSocket(`ws://127.0.0.1:${port}/bridge`,{origin});
  await once(ws,'open');const response=Promise.race([once(ws,'message'),once(ws,'close')]);ws.send(JSON.stringify({type:'hello',token:secret,tools:catalogue}));await response;return ws;
}
test('installed Electron file origin authenticates but still rejects a wrong token',async()=>{
  const relay=await startRelay({token,port:0});let ws;
  try{
    const bad=await editor(relay.port,'wrong','file://');assert.notEqual(bad.readyState,WebSocket.OPEN);assert.equal(relay.connected(),false);
    ws=await editor(relay.port,token,'file://');assert.equal(relay.connected(),true);
  }finally{ws?.terminate();await relay.close();}
});
test('real SDK initialize/list/call crosses authenticated HTTP + WebSocket and preserves image content',async()=>{
  const relay=await startRelay({token,port:0});let ws,client;
  try {
    ws=await editor(relay.port);
    ws.on('message',raw=>{const msg=JSON.parse(raw);if(msg.type==='call')ws.send(JSON.stringify({type:'result',id:msg.id,result:{content:[{type:'text',text:JSON.stringify(msg.arguments)},{type:'image',mimeType:'image/png',data:'aGVsbG8='}]}}));});
    client=new Client({name:'integration-test',version:'1'});
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${relay.port}/mcp`),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
    assert.equal((await client.listTools()).tools[0].name,'test_tool');
    const result=await client.callTool({name:'test_tool',arguments:{probe:42}});assert.equal(JSON.parse(result.content[0].text).probe,42);assert.equal(result.content[1].type,'image');
  }finally{await client?.close();ws?.terminate();await relay.close();}
});
test('HTTP auth, origin, invalid bridge token and second editor rejection',async()=>{
  const relay=await startRelay({token,port:0});let ws,second;
  try{
    const endpoint=`http://127.0.0.1:${relay.port}/mcp`;
    assert.equal((await fetch(endpoint,{method:'POST'})).status,401);
    assert.equal((await fetch(endpoint,{method:'POST',headers:{Origin:'https://evil.example',Authorization:`Bearer ${token}`}})).status,403);
    const bad=await editor(relay.port,'wrong');assert.notEqual(bad.readyState,WebSocket.OPEN);assert.equal(relay.connected(),false);
    ws=await editor(relay.port);second=await editor(relay.port);assert.notEqual(second.readyState,WebSocket.OPEN);assert.equal(relay.connected(),true);
  }finally{ws?.terminate();second?.terminate();await relay.close();}
});
test('disconnect while command pending resolves as error',async()=>{
  const relay=await startRelay({token,port:0});let ws,client;
  try{
    ws=await editor(relay.port);ws.on('message',raw=>{if(JSON.parse(raw).type==='call')ws.close();});
    client=new Client({name:'test',version:'1'});await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${relay.port}/mcp`),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
    assert.equal((await client.callTool({name:'test_tool'})).isError,true);
  }finally{await client?.close();ws?.terminate();await relay.close();}
});
