import {readFile} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
if(!process.argv[2])throw Error('Pass a staged release directory with npm ci --omit=dev completed');
const root=resolve(process.argv[2]);
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
// Files a release must carry: the bundle, the distributed licenses/checksums that
// build.mjs emits into dist/, and the third-party notices the bundle relies on.
const required=[
 'package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md','README.md',
 'relay/server.mjs','relay/cli.mjs','relay/ysm-tools.mjs',
 'dist/minecraft_blockbench_mcp.js','dist/LICENSE','dist/THIRD_PARTY_NOTICES.md','dist/SHA256SUMS',
 'dist/licenses/sosadly-MIT.txt','dist/licenses/dependency-inventory.json',
 'vendor/ysmparser/LICENSE.txt','vendor/ysmparser/provenance.json',
];
for(const path of required){
 if(!manifest.files.some(file=>file.path===path))throw Error(`Release is missing required file: ${path}`);
}
for(const file of manifest.files){
 const segments=file.path.split('/');
 // `.env.example` is a documented, secret-free template; every other `.env*` is a credential file.
 const secret=segments.some(s=>/^\.env(\..+)?$/.test(s)&&s!=='.env.example');
 if(segments.some(s=>s===''||s==='.'||s==='..')||secret||file.path.includes('\\')||isAbsolute(file.path))throw Error(`Unsafe manifest path: ${file.path}`);
 const full=resolve(root,file.path);
 const escape=relative(root,full);
 if(escape.startsWith('..'+sep)||escape==='..'||isAbsolute(escape))throw Error(`Manifest path escapes the release directory: ${file.path}`);
 const bytes=await readFile(full);assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
}
// SHA256SUMS must describe the bundle that was actually staged.
const bundle=await readFile(join(root,'dist/minecraft_blockbench_mcp.js'));
const sums=(await readFile(join(root,'dist/SHA256SUMS'),'utf8')).trim();
assert.equal(sums,`${createHash('sha256').update(bundle).digest('hex')}  minecraft_blockbench_mcp.js`);
const staged=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
assert.equal(staged.version,manifest.version);
const load=p=>import(pathToFileURL(join(root,p)).href);
const {startRelay}=await load('relay/server.mjs');
const {Client}=await load('node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
const {StreamableHTTPClientTransport}=await load('node_modules/@modelcontextprotocol/sdk/dist/esm/client/streamableHttp.js');
const token=randomBytes(32).toString('hex'),relay=await startRelay({token,port:0}),client=new Client({name:'release-verification',version:'1'});
try{
 await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${relay.port}/mcp`),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
 const list=await client.listTools();assert.ok(list.tools.some(t=>t.name==='mc_ysm_inspect'));
 const header=Buffer.from([89,83,71,80,0,0,0,2]);const result=await client.callTool({name:'mc_ysm_inspect',arguments:{data:header.toString('base64')}});assert.ok(!result.isError);
 console.log(JSON.stringify({filesVerified:manifest.files.length,licensesStaged:true,checksumsVerified:true,isolatedInitialize:true,offlineToolCall:true,editorVerified:false}));
}finally{await client.close();await relay.close();}
