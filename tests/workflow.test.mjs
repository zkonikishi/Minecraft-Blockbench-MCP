import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtime,modelFixture} from './helpers.mjs';
const {shiftTime,squareBounds,validateScript,collectionModel,auditModel,createRuntime}=runtime;
test('CEM import strips nested textures, rejects external geometry before mutation and retains old project on failure',async()=>{
 const keys=['Project','Formats','Format','Codecs','Outliner','Group','Texture'];const saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const old={uuid:'old',select(){globalThis.Project=this;}};let calls=0,received;
 const model={texture:'https://external/skin.png',textureSize:[64,64],models:[{part:'head',texture:'D:/secret.png',translate:[0,-24,0],boxes:[{coordinates:[-4,24,-4,8,8,8],textureOffset:[0,0]}],submodels:[{id:'child',texture:'file:///secret',boxes:[]}]}]};
 try{
  Object.assign(globalThis,{Project:old,Formats:{optifine_entity:{}},Format:{id:'optifine_entity'},Codecs:{optifine_entity:{load(m,f){calls++;received=m;assert.deepEqual(f,{path:'',no_file:true});globalThis.Project={uuid:'new'};}}}});
  const r=createRuntime();
  for(const bad of [{models:[]},{models:[{part:'head',model:'outside.jpm'}]},{models:[{part:'head',submodel:{}}]},{models:[{part:'head',boxes:[{coordinates:[0,0,0,-1,1,1]}]}]},{models:[{part:'head',mirrorTexture:3}]}]){assert((await r.call('mc_import_cem',{model:bad})).isError);assert.equal(calls,0);assert.equal(globalThis.Project,old);}
  const before=structuredClone(model),res=await r.call('mc_import_cem',{model,name:'zombie'});assert(!res.isError,JSON.stringify(res));assert.equal(calls,1);assert.deepEqual(model,before);assert.equal(received.texture,undefined);assert.equal(received.models[0].texture,undefined);assert.equal(received.models[0].submodels[0].texture,undefined);assert.deepEqual(received.models[0].boxes,model.models[0].boxes);assert.equal(JSON.parse(res.content[0].text).removedTextures,3);
  globalThis.Project=old;globalThis.Codecs.optifine_entity.load=()=>{globalThis.Project={uuid:'partial'};throw Error('parse failed');};assert((await r.call('mc_import_cem',{model})).isError);assert.equal(globalThis.Project,old);
 }finally{for(const k of keys){if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k];}}
});
test('loop phases preserve explicit endpoint with no shift and wrap offsets',()=>{
 assert.equal(shiftTime(1,1,0),1);assert.equal(shiftTime(.75,1,.5),.25);assert.equal(shiftTime(.5,1,.5),0);assert.throws(()=>shiftTime(0,0,.5));
});
test('ModelEngine square hitbox expansion encloses offset rectangle without changing height',()=>{
 const r=squareBounds([3,2,-8],[9,20,8]);assert.deepEqual(r,{from:[-2,2,-8],to:[14,20,8]});
});
test('instruction writer accepts documented commands but rejects JS, empty and malformed lines',()=>{
 assert.equal(validateScript(' mm:attack{power=2}\r\npartvis{part=head;visible=false} '),'mm:attack{power=2}\npartvis{part=head;visible=false}');
 for(const text of ['', 'alert(1)', 'mm:foo\nfetch(secret)', 'partvis{', 'unknown{x=1}'])assert.throws(()=>validateScript(text));
});
test('collection export preserves ancestor transforms, filters unrelated geometry and tracks, and does not mutate source',()=>{
 const m=modelFixture();m.outliner[0].rotation=[0,30,0];m.outliner[0].children.push({uuid:'child',name:'head',children:['head-cube']});m.elements.push({...structuredClone(m.elements[0]),uuid:'head-cube'});
 m.animations[0].animators.child={type:'bone',keyframes:[]};m.animations[0].animators.effects={type:'effect',keyframes:[{time:0}]};
 const before=structuredClone(m),part=collectionModel(m,['child']);assert.deepEqual(m,before);assert.deepEqual(part.outliner[0].rotation,[0,30,0]);assert.equal(part.elements.length,1);assert.equal(part.elements[0].uuid,'head-cube');assert(!part.animations[0].animators.effects);assert(part.animations[0].animators['bone-id']);assert.throws(()=>collectionModel(m,['missing']));
});
test('IK references, unsupported elements, effect timing and texture wrap have separate diagnostics',()=>{
 const m=modelFixture();m.elements.push({uuid:'control',type:'null_object',ik_source:'bone-id',ik_target:'missing'});m.outliner.push('control');
 m.animations[0].animators.control={type:'null_object',keyframes:[{time:0,channel:'position'}]};m.animations[0].animators.effects={type:'effect',keyframes:[{time:2}]};m.textures[0].wrap_mode='repeat';
 const r=auditModel(m,'bettermodel'),codes=r.findings.map(f=>f.code);assert(codes.includes('IK_REFERENCE'));assert(codes.includes('KEYFRAME_TIME'));assert(codes.includes('TEXTURE_WRAP'));assert(!codes.includes('ANIMATOR_BONE'));assert(!codes.includes('ELEMENT_PORTABILITY'));
});
test('JSON import validates before creating a project and passes UUIDs and keys unchanged to native codec',async()=>{
 const keys=['Project','Formats','Format','Codecs','Outliner','Texture','Animation'];const saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let calls=0,received;
 const old={uuid:'old',select(){globalThis.Project=this;}};
 const model={meta:{model_format:'free'},elements:[{uuid:'cube'}],outliner:['cube'],textures:[{uuid:'texture',source:'data:image/png;base64,aGVsbG8=',path:'D:/should-not-read.png'}],animations:[{uuid:'anim',animators:{bone:{keyframes:[{uuid:'key',time:.25,data_points:[{x:1}]}]}}}]};
 try{
  Object.assign(globalThis,{Project:old,Formats:{free:{}},Format:{id:'free'},Codecs:{project:{load(m,f){calls++;received=m;assert.equal(f.no_file,true);globalThis.Project={uuid:'new',name:'test'};}}}});
  const runtime=createRuntime();
  assert((await runtime.call('mc_import_bbmodel',{model:{...model,textures:[{source:'https://external/image.png'}]}})).isError);assert.equal(calls,0);assert.equal(globalThis.Project,old);
  const result=await runtime.call('mc_import_bbmodel',{model,name:'test'});assert(!result.isError,JSON.stringify(result));assert.equal(calls,1);assert.deepEqual(received.animations,model.animations);assert.equal(received.elements[0].uuid,'cube');assert.equal(received.textures[0].path,undefined);assert(model.textures[0].path);
  globalThis.Project=old;globalThis.Codecs.project.load=()=>{globalThis.Project={uuid:'partial'};throw Error('parse failed');};assert((await runtime.call('mc_import_bbmodel',{model})).isError);assert.equal(globalThis.Project,old);
 }finally{for(const k of keys){if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k];}}
});
test('explicit disabled faces survive adapter, native-style serialization, both variants and JSON import',async()=>{
 const {applyFaces}=await import(new URL('faces.mjs',new URL(`file:///${process.env.BLOCKBENCH_TEST_DIR.replaceAll('\\','/')}/`)));
 const names=['Project','Texture','Codecs','Formats','Format','Outliner','Animation'];const saved=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
 try{
  globalThis.Texture={all:[{uuid:'skin-uuid',name:'skin'}]};globalThis.Project={uuid:'old'};
  const cube={faces:{north:{texture:false},south:{texture:false},east:{texture:false},west:{texture:'skin-uuid'}}};
  applyFaces(cube,{north:{texture:null},south:{texture:false},east:{texture:'skin'},west:{uv:[0,0,1,1]}});
  assert.equal(cube.faces.north.texture,null);assert.equal(cube.faces.south.texture,false);assert.equal(cube.faces.east.texture,'skin-uuid');assert.equal(cube.faces.west.texture,'skin-uuid');
  // Native Face.getSaveCopy preserves null, omits false, indexes actual textures.
  const faces=Object.fromEntries(Object.entries(cube.faces).map(([k,f])=>[k,{uv:[0,0,1,1],texture:f.texture===null?null:f.texture===false?undefined:0}]));
  const model={meta:{model_format:'free'},name:'face_test',elements:[{uuid:'cube',from:[0,0,0],to:[1,1,1],faces}],outliner:['cube'],textures:[],animations:[]};
  globalThis.Codecs={project:{compile:()=>JSON.parse(JSON.stringify(model)),load(m){globalThis.Project={uuid:'imported',name:'face_test'};assert.equal(m.elements[0].faces.north.texture,null);assert(!Object.hasOwn(m.elements[0].faces.south,'texture'));assert.equal(m.elements[0].faces.east.texture,0);}}};
  globalThis.Formats={free:{}};globalThis.Format={id:'free'};globalThis.Outliner={elements:[]};globalThis.Animation={all:[]};
  const runtime=createRuntime();const result=await runtime.call('mc_export_engine_variants',{});assert(!result.isError,JSON.stringify(result));
  for(const variant of JSON.parse(result.content[0].text).variants){assert.equal(variant.model.elements[0].faces.north.texture,null);assert(!Object.hasOwn(variant.model.elements[0].faces.south,'texture'));assert(!(await runtime.call('mc_import_bbmodel',{model:variant.model})).isError);}
 }finally{for(const k of names){if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k];}}
});
test('capture fits posed world vertices and excludes hidden hitbox and hidden scene parents',async()=>{
 const {framingPreset}=await import(new URL('framing.mjs',new URL(`file:///${process.env.BLOCKBENCH_TEST_DIR.replaceAll('\\','/')}/`)));
 const saved=globalThis.Cube;let updates=0;
 const make=(offset,visible=true)=>({visibility:visible,parent:'root',mesh:{visible:true,parent:null,geometry:{attributes:{position:{count:2,getX:i=>i?1:-1,getY:i=>i?2:-2,getZ:i=>i?1:-1}}},matrixWorld:{elements:[0,2,0,0,-3,0,0,0,0,0,4,0,offset,20,30,1]},updateWorldMatrix(){updates++;}}});
 try{
  const body=make(200),hitbox=make(10000,false),hidden=make(-10000);hidden.mesh.parent={visible:false};
  const collapsed=make(30000);collapsed.mesh.matrixWorld.elements=[1e-5,0,0,0,0,1e-5,0,0,0,0,1e-5,0,0,308.4,16.704,1];
  globalThis.Cube={all:[body,hitbox,hidden,collapsed]};const frame=framingPreset('iso');assert.deepEqual(frame.preset.target,[200,20,30]);assert(frame.span<30);assert.equal(updates,2);
  body.mesh.matrixWorld.elements[12]=500;assert.deepEqual(framingPreset('iso').preset.target,[500,20,30]);
 }finally{if(saved===undefined)delete globalThis.Cube;else globalThis.Cube=saved;}
});
test('workflow schemas reject incomplete types and excessive batches before touching editor',async()=>{
 const r=createRuntime();for(const [name,args] of [['mc_transform_keyframes',{animation:'walk',node:'head',keys:[{time:-1,channel:'rotation',value:[0,0,0]}]}],['mc_texture_workflow',{texture:'skin',fps:0}],['mc_bounding_box',{name:'bad',from:[0,0,0],to:[1,1,'x']}],['mc_control_node',{name:'node',kind:'script',position:[0,0,0]}]])assert((await r.call(name,args)).isError,name);
});
test('keyframe conflict, invalid duration and IK mismatch do not start Undo',async()=>{
 const saved={Project:globalThis.Project,Group:globalThis.Group,Outliner:globalThis.Outliner,Animation:globalThis.Animation,Undo:globalThis.Undo};let edits=0;
 globalThis.Project={};globalThis.Group={all:[{name:'head',uuid:'bone'}]};globalThis.Outliner={elements:[]};globalThis.Undo={initEdit(){edits++;}};
 globalThis.Animation={all:[{name:'walk',uuid:'clip',length:1,animators:{bone:{keyframes:[{time:0,channel:'rotation'}]}}}]};
 try{const r=createRuntime();for(const time of [0,2])assert((await r.call('mc_transform_keyframes',{animation:'walk',node:'head',keys:[{time,channel:'rotation',value:[1,0,0]}]})).isError);assert.equal(edits,0);}finally{Object.assign(globalThis,saved);}
});
