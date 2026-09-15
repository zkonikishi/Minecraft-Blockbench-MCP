import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Pass a staged release directory with npm ci --omit=dev completed');
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
for(const file of manifest.files){
 if(file.path.split('/').some(s=>s==='..'||s==='.env')||file.path.includes('\\')||file.path.startsWith('/'))throw Error('Unsafe manifest path');
 const bytes=await readFile(join(root,file.path));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
}
const load=p=>import(pathToFileURL(join(root,p)).href);
const {startRelay}=await load('relay/server.mjs');
const {Client}=await load('node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
const {StreamableHTTPClientTransport}=await load('node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js');
const token=randomBytes(32).toString('hex'),relay=await startRelay({token,port:0}),client=new Client({name:'release-verification',version:'1'});
try{
 await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${relay.port}/mcp`),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
 const list=await client.listTools();assert.ok(list.tools.some(t=>t.name==='mc_ysm_inspect'));
 const header=Buffer.from([89,83,71,80,0,0,0,2]);const result=await client.callTool({name:'mc_ysm_inspect',arguments:{data:header.toString('base64')}});assert.ok(!result.isError);
 console.log(JSON.stringify({filesVerified:manifest.files.length,isolatedInitialize:true,offlineToolCall:true,editorVerified:false}));
}finally{await client.close();await relay.close();}
