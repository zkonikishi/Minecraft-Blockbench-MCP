import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime,content} from './helpers.mjs';
function setup(){
  const calls=[],r=new runtime.ToolRegistry(),project={view_mode:'textured'};
  globalThis.Project=project;globalThis.Canvas={updateViewMode(){calls.push('render');}};
  for(const name of ['craft_capture_views','anim_get_texture','craft_get_uv_map','mc_preview_animation'])r.add({name,inputSchema:{},execute:args=>{
    calls.push({name,args});return {content:name==='mc_preview_animation'?[{type:'text',text:'{}'}]:Array.from({length:args.views?.length||1},()=>({type:'image',mimeType:'image/png',data:'test-image'}))};
  }});
  for(const tool of runtime.visualTools(r.definitions))r.add(tool);
  return {r,calls,project};
}
test('detail frame includes mesh vertices and resolves focus without changing geometry',()=>{
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const make=(name,x)=>({name,uuid:name,mesh:{updateWorldMatrix(){},matrixWorld:{elements:identity},geometry:{attributes:{position:{count:2,getX:i=>x+i,getY:i=>i,getZ:i=>i}}}}});
  globalThis.Group={all:[]};const near=make('near',0),far=make('far',100);
  const frame=runtime.visualFrame([near,far],['near']);assert.deepEqual(frame.center,[.5,.5,.5]);
  assert.ok(runtime.visualFrame([near,far]).span>frame.span);
  assert.throws(()=>runtime.visualFrame([near],['missing']),/Missing/);
  assert.throws(()=>runtime.visualFrame([]),/No visible/);
});
test('universal capture returns images and restores wireframe state',async()=>{
  const {r,project}=setup();const out=await r.call('mc_visual_capture',{render:'wireframe',views:['north']});
  assert.equal(out.isError,undefined);assert.equal(out.content[0].type,'image');assert.equal(project.view_mode,'textured');
});
test('texture and UV use dedicated image backends',async()=>{
  const {r,calls}=setup();await r.call('mc_visual_texture',{kind:'texture',texture:'skin'});await r.call('mc_visual_texture',{kind:'uv',texture:'skin'});
  assert.ok(calls.some(c=>c.name==='anim_get_texture'));assert.ok(calls.some(c=>c.name==='craft_get_uv_map'));
});
test('comparison refuses overwrite and other projects; returns labelled images',async()=>{
  const {r}=setup();assert.equal((await r.call('mc_visual_compare',{operation:'save',key:'before'})).isError,undefined);
  assert.equal((await r.call('mc_visual_compare',{operation:'save',key:'before'})).isError,true);
  const out=await r.call('mc_visual_compare',{operation:'compare',key:'before'});assert.equal(out.content.filter(c=>c.type==='image').length,6);assert.equal(content(out).visualVerified,false);
  globalThis.Project={};assert.equal((await r.call('mc_visual_compare',{operation:'compare',key:'before'})).isError,true);
  assert.equal(content(await r.call('mc_visual_compare',{operation:'clear',key:'before'})).cleared,'before');
});
test('capture failures restore render state and reject missing images',async()=>{
  const {r,project}=setup();r.definitions.get('craft_capture_views').execute=()=>({content:[]});
  assert.equal((await r.call('mc_visual_capture',{render:'wireframe'})).isError,true);assert.equal(project.view_mode,'textured');
});
test('visual schemas bound memory and frame count before execution',async()=>{
  const {r,calls}=setup();assert.equal((await r.call('mc_visual_capture',{max_edge:99999})).isError,true);
  assert.equal((await r.call('mc_visual_animation',{animation:'walk',times:Array(9).fill(0)})).isError,true);assert.equal(calls.length,0);
});
test('detail rejects unavailable native API and contradictory invalid frames',async()=>{
  const {r}=setup();assert.equal((await r.call('mc_visual_detail',{})).isError,true);
  assert.equal((await r.call('mc_visual_detail',{frame:{center:[0,0,0],span:-1}})).isError,true);
});
test('animation sampling restores timeline selection and mode',async()=>{
  const {r}=setup();let restored=false;const previous={select(){restored=true;}};
  globalThis.Animation={all:[{uuid:'walk',length:1}],selected:previous};
  globalThis.Timeline={time:0.3,setTime(t){this.time=t;}};
  globalThis.Modes={id:'edit',options:{edit:{select(){}}}};
  const result=await r.call('mc_visual_animation',{animation:'walk',times:[0,0.5],views:['iso']});
  assert.equal(result.isError,undefined);assert.equal(result.content.filter(c=>c.type==='image').length,2);assert.equal(globalThis.Timeline.time,0.3);assert.ok(restored);
});
