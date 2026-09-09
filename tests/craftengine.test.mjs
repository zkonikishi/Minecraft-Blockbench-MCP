import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {runtime,content} from './helpers.mjs';
import {installPack} from '../scripts/install-craftengine-pack.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function model(){return {meta:{format_version:'4.10',model_format:'java_block'},resolution:{width:16,height:16},elements:[{uuid:'cube',type:'cube',from:[0,0,0],to:[16,16,16],box_uv:false,faces:Object.fromEntries(['north','south','east','west','up','down'].map(f=>[f,{uv:[0,0,16,16],texture:0}]))}],outliner:['cube'],textures:[{id:'0',uuid:'tex',name:'skin.png',source:png,path:'D:/private/skin.png'}]};}
const args={namespace:'mcp_ce',id:'test_cube',pack:'mcp_ce_acceptance'};
test('CE manifest preserves source, embeds native blueprint and makes matching item/furniture references',async()=>{
 const m=model(),before=structuredClone(m),r=await runtime.createRuntime().call('mc_craftengine_export',{...args,model:m,furniture:true,hitbox:{width:1,height:1},translation:[0,.5,0]});assert(!r.isError,JSON.stringify(r));
 const data=content(r);assert.deepEqual(m,before);const conf=JSON.parse(data.files.find(f=>f.path.startsWith('configuration/')).content);assert.equal(conf.items['mcp_ce:test_cube'].model.blueprint,'test_cube');assert.equal(conf.furniture['mcp_ce:test_cube'].variants.ground.elements[0].item,'mcp_ce:test_cube');assert.equal(conf.furniture['mcp_ce:test_cube'].variants.ground.elements[0].translation,'0,0.5,0');const bp=JSON.parse(data.files.find(f=>f.path.startsWith('blueprint/')).content);assert(!bp.textures[0].path);assert.equal(bp.textures[0].source,png);
 fs.writeFileSync(path.join(process.env.BLOCKBENCH_TEST_DIR,'ce-acceptance-manifest.json'),JSON.stringify(data,null,2));
});
test('CE rejects lossy animated/generic/mesh/group-rotation/box-UV and missing texture exports',async()=>{
 const r=runtime.createRuntime();
 const changes=[m=>m.meta.model_format='free',m=>m.animations=[{name:'walk'}],m=>m.elements[0].type='mesh',m=>m.elements[0].box_uv=true,m=>m.groups=[{rotation:[0,45,0]}],m=>m.textures[0].source='file:///texture.png',m=>m.elements[0].faces.north.texture=false,m=>m.elements[0].faces.north.texture=9];
 for(const change of changes){const m=model();change(m);assert((await r.call('mc_craftengine_export',{...args,model:m})).isError);}
});
test('CE engine furniture uses correct renderer and exposes pack dependency without claiming model included',async()=>{
 for(const [renderer,type] of [['bettermodel','better_model'],['modelengine','model_engine']]){
  const r=await runtime.createRuntime().call('mc_craftengine_export',{...args,renderer,engine_model:'dragon',furniture:true});assert(!r.isError);const data=content(r),conf=JSON.parse(data.files.find(f=>f.path.startsWith('configuration/')).content);assert(!data.files.some(f=>f.path.startsWith('blueprint/')));assert.equal(conf.furniture['mcp_ce:test_cube'].variants.ground.elements[0].type,type);assert.equal(data.dependencies[0].model,'dragon');
 }
});
test('CE rejects legacy lossy rotations and empty exports but retains modern multi-axis rotation',async()=>{
 const r=runtime.createRuntime(),m=model();m.java_block_version='1.9.0';m.elements[0].rotation=[30,45,0];
 assert((await r.call('mc_craftengine_export',{...args,model:m})).isError);
 m.java_block_version='1.21.11';assert(!(await r.call('mc_craftengine_export',{...args,model:m})).isError);
 m.elements[0].export=false;assert((await r.call('mc_craftengine_export',{...args,model:m})).isError);
});
test('CE invalid identifiers and incomplete engine references fail before editor access',async()=>{
 const r=runtime.createRuntime();for(const extra of [{id:'../bad'},{namespace:'bad:ns'},{renderer:'modelengine'},{renderer:'modelengine',furniture:true,engine_model:'dragon',model:model()},{hitbox:{width:1,height:1}}])assert((await r.call('mc_craftengine_export',{...args,...extra})).isError);
});
test('CE pack plan preserves existing merge paths, deduplicates and rejects traversal',async()=>{
 const r=runtime.createRuntime(),result=content(await r.call('mc_craftengine_pack_plan',{existing_folders:['MythicMobs/generation/resource_pack'],add_folders:['ModelEngine/resource pack','MythicMobs/generation/resource_pack']}));assert.deepEqual(result.patch['resource-pack']['merge-external-folders'],['MythicMobs/generation/resource_pack','ModelEngine/resource pack']);assert(!('delivery' in result.patch['resource-pack']));assert.equal(result.validatedOnDisk,false);assert((await r.call('mc_craftengine_pack_plan',{add_folders:['../secret']})).isError);
});
test('CE installer dry run is non-mutating; apply writes exact bytes and rejects collisions/traversal',async()=>{
 const resources=fs.mkdtempSync(path.join(process.env.BLOCKBENCH_TEST_DIR,'ce-resources-'));
 const manifest=content(await runtime.createRuntime().call('mc_craftengine_export',{...args,model:model()}));
 const dry=installPack(manifest,resources);assert(!fs.existsSync(dry.target));installPack(manifest,resources,true);
 for(const file of manifest.files)assert.equal(fs.readFileSync(path.join(dry.target,file.path),'utf8'),file.content);
 assert.throws(()=>installPack(manifest,resources,true),/already exists/);
 assert.throws(()=>installPack({...manifest,pack:'other',files:[...manifest.files,{path:'../config.yml',encoding:'utf8',content:'{}'}]},resources,true),/unsafe/);
 assert.throws(()=>installPack({...manifest,pack:'other',files:[...manifest.files,manifest.files[0]]},resources,true),/Duplicate/);
});
