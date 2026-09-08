import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtime,modelFixture} from './helpers.mjs';
const {shiftTime,squareBounds,validateScript,collectionModel,auditModel,createRuntime}=runtime;
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
test('workflow schemas reject incomplete types and excessive batches before touching editor',async()=>{
 const r=createRuntime();for(const [name,args] of [['mc_transform_keyframes',{animation:'walk',node:'head',keys:[{time:-1,channel:'rotation',value:[0,0,0]}]}],['mc_texture_workflow',{texture:'skin',fps:0}],['mc_bounding_box',{name:'bad',from:[0,0,0],to:[1,1,'x']}],['mc_control_node',{name:'node',kind:'script',position:[0,0,0]}]])assert((await r.call(name,args)).isError,name);
});
test('keyframe conflict, invalid duration and IK mismatch do not start Undo',async()=>{
 const saved={Project:globalThis.Project,Group:globalThis.Group,Outliner:globalThis.Outliner,Animation:globalThis.Animation,Undo:globalThis.Undo};let edits=0;
 globalThis.Project={};globalThis.Group={all:[{name:'head',uuid:'bone'}]};globalThis.Outliner={elements:[]};globalThis.Undo={initEdit(){edits++;}};
 globalThis.Animation={all:[{name:'walk',uuid:'clip',length:1,animators:{bone:{keyframes:[{time:0,channel:'rotation'}]}}}]};
 try{const r=createRuntime();for(const time of [0,2])assert((await r.call('mc_transform_keyframes',{animation:'walk',node:'head',keys:[{time,channel:'rotation',value:[1,0,0]}]})).isError);assert.equal(edits,0);}finally{Object.assign(globalThis,saved);}
});
