import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtime,content} from './helpers.mjs';
const {ToolRegistry,createRuntime}=runtime;
const tool=(name,execute)=>({name,description:name,inputSchema:{type:'object'},execute});
test('three real provider inventories merge without collisions; default workflows and web restrictions',()=>{
  const r=createRuntime({desktop:false});const names=r.list().map(t=>t.name);
  for(const name of ['craft_apply_geometry_batch','craft_paint_face_grid','studio_place_cube','anim_create_animation','mc_audit_model','mc_export_bbmodel'])assert(names.includes(name),name);
  assert.equal(new Set(names).size,names.length);
  assert(names.length>100);
  assert(!names.includes('anim_execute_script'));assert(!names.includes('craft_save_project'));
  assert(!names.includes('anim_load_project'));
  const full=createRuntime({desktop:true,advanced:true});assert(full.list().length>names.length);assert(full.definitions.has('anim_execute_script'));
});
test('actual provider read handlers execute, and invalid schemas fail before editor access',async()=>{
  globalThis.Project=null;globalThis.Formats={free:{id:'free',name:'Generic Model'}};
  const r=createRuntime({desktop:false});
  const bad=await r.call('anim_add_cube',{name:'bad',from:'invalid',to:[1,1,1]});assert.equal(bad.isError,true);assert.match(bad.content[0].text,/array/);
  const invalidCraft=await r.call('craft_apply_geometry_batch',{unexpected:true});assert.equal(invalidCraft.isError,true);
  const craft=await r.call('craft_get_guide',{});assert(!craft.isError);
  const anim=await r.call('anim_get_guide',{});assert(!anim.isError);
  const studio=await r.call('studio_get_project_info',{});assert(studio.content.length>0);
});
test('one lane serializes async calls from different families',async()=>{
  const r=new ToolRegistry(()=>null);let release;const gate=new Promise(ok=>release=ok);const events=[];
  r.add(tool('studio_slow',async()=>{events.push('start');await gate;events.push('end');return 'done';}));
  r.add(tool('craft_fast',()=>{events.push('fast');return 'done';}));
  const a=r.call('studio_slow');const b=r.call('craft_fast');await Promise.resolve();assert.deepEqual(events,['start']);release();await Promise.all([a,b]);assert.deepEqual(events,['start','end','fast']);
});
test('queued call rejects project change and stop cancels queue without pretending to cancel active edits',async()=>{
  let project={};const r=new ToolRegistry(()=>project);let release;const gate=new Promise(ok=>release=ok);let writes=0;
  r.add(tool('slow',async()=>{await gate;return 'done';}));r.add(tool('write',()=>{writes++;}));
  const a=r.call('slow');const b=r.call('write');await Promise.resolve();project={};release();await a;assert.equal((await b).isError,true);assert.equal(writes,0);
  const q=new ToolRegistry(()=>null);let unblock;const g=new Promise(ok=>unblock=ok);q.add(tool('a',()=>g));q.add(tool('b',()=>writes++));
  const first=q.call('a');const next=q.call('b');await Promise.resolve();q.stop();unblock();await first;await q.drain();assert.equal((await next).isError,true);assert.equal(writes,0);
});
test('a throwing handler does not poison the lane; unknown tool and invalid args fail',async()=>{
  const r=new ToolRegistry(()=>null);r.add(tool('bad',()=>{throw new Error('expected');}));r.add(tool('good',()=>({ok:true})));
  assert((await r.call('bad')).isError);assert.equal(content(await r.call('good')).ok,true);assert((await r.call('missing')).isError);assert((await r.call('good',[])).isError);
});
test('Wiki bone tags preserve UUID, are idempotent, and reject collisions before Undo',async()=>{
  const saved={Project:globalThis.Project,Group:globalThis.Group,Undo:globalThis.Undo};let edits=0;
  const child={uuid:'child',name:'shape',children:[]};const bone={uuid:'bone',name:'tail_base',children:[child]};
  globalThis.Project={};globalThis.Group={all:[bone,child]};globalThis.Undo={initEdit(){edits++;},finishEdit(){}};
  try{
    const r=createRuntime();const args={target:'modelengine',bone:'bone',behavior:'segment_front'};
    const first=content(await r.call('mc_set_bone_behavior',args));assert.equal(first.name,'segf_tail_base');assert.equal(first.uuid,'bone');
    assert.equal(content(await r.call('mc_set_bone_behavior',args)).changed,false);assert.equal(edits,1);
    assert.equal((await r.call('mc_set_bone_behavior',{...args,target:'bettermodel'})).isError,true);
    child.name='tail_base';assert.equal((await r.call('mc_set_bone_behavior',{...args,behavior:'tail'})).isError,true);assert.equal(edits,1);
    child.name='shape';bone.children=[{type:'cube'}];assert.equal((await r.call('mc_set_bone_behavior',args)).isError,true);assert.equal(edits,1);
    bone.children=[];
    assert.equal((await r.call('mc_set_bone_behavior',{...args,behavior:'player_limb'})).isError,true);
    assert.equal(content(await r.call('mc_set_bone_behavior',{...args,behavior:'player_limb',limb_type:'right_forearm'})).name,'limb[type=right_forearm]_tail_base');
    assert.equal(content(await r.call('mc_modelengine_features')).devBuild,null);
  }finally{Object.assign(globalThis,saved);}
});


test('upstream refresh exposes display and wing tools but keeps file exports desktop-only',()=>{
 const web=createRuntime(); const desktop=createRuntime({desktop:true});
 for(const name of ['studio_get_display_transform','studio_set_display_transform','studio_enter_display_mode','anim_add_wing']) assert(web.definitions.has(name),name);
 assert(!web.definitions.has('anim_export_model')); assert(desktop.definitions.has('anim_export_model'));
});

test('script guard uses local advanced setting and undefined results remain valid MCP content',async()=>{
 const saved={settings:globalThis.settings,Blockbench:globalThis.Blockbench};
 try {
  globalThis.Blockbench={};globalThis.settings={minecraft_blockbench_mcp_advanced:{value:false}};
  const r=createRuntime({advanced:true});
  assert.equal((await r.call('anim_execute_script',{code:'return 1;'})).isError,true);
  globalThis.settings.minecraft_blockbench_mcp_advanced.value=true;
  const result=await r.call('anim_execute_script',{code:'void 0;'});
  assert(!result.isError,JSON.stringify(result));assert.equal(typeof result.content[0].text,'string');
 } finally {Object.assign(globalThis,saved);}
});


test('async export resolves codec content instead of serializing a Promise',async()=>{
 const saved={Project:globalThis.Project,Format:globalThis.Format,Codecs:globalThis.Codecs};
 try {globalThis.Project={};globalThis.Format={};globalThis.Codecs={gltf:{id:'gltf',compile:async()=>({asset:{version:'2.0'}})}};
 const r=createRuntime({desktop:true});const res=await r.call('studio_export_model',{codec_id:'gltf',max_content_length:10000});
 assert(!res.isError,JSON.stringify(res));assert.match(res.content[0].text,/2.0/);
 } finally {Object.assign(globalThis,saved);}
});

test('keyframe writes preserve independent scale axes and accept zero on edit',async()=>{
 const saved=Object.fromEntries(['Project','Group','Animation','Undo','Animator'].map(k=>[k,globalThis[k]]));
 try {
 const frames=[];const bone={uuid:'body-id',name:'body'};
 const animator={scale:frames,createKeyframe(data){const frame={...data,uniform:true,axes:{},set(k,v){if(this.uniform)this.axes={x:v,y:v,z:v};else this.axes[k]=v;}};frames.push(frame);return frame;}};
 globalThis.Project={};globalThis.Group={all:[bone]};globalThis.Animation={selected:{animators:{'body-id':animator}}};globalThis.Undo={initEdit(){},finishEdit(){}};globalThis.Animator={preview(){}};
 const r=createRuntime();const args={bone_name:'body',channel:'scale',action:'create',keyframes:[{time:0,values:[1,2,3]}]};
 const result=await r.call('studio_manage_keyframes',args);assert(!result.isError,JSON.stringify(result));assert.deepEqual(frames[0].axes,{x:1,y:2,z:3});
 const edited=await r.call('studio_manage_keyframes',{...args,action:'edit',keyframes:[{time:0,values:0}]});assert(!edited.isError,JSON.stringify(edited));assert.deepEqual(frames[0].axes,{x:0,y:0,z:0});
 }finally{Object.assign(globalThis,saved);}
});
