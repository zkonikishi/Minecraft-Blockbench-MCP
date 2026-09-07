import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runtime,modelFixture} from './helpers.mjs';
const {auditModel,scaffoldPlan}=runtime;
const codes=(m,t='both')=>new Set(auditModel(m,t).findings.map(f=>f.code));
test('valid shared cube model passes static checks without claiming runtime acceptance',()=>{
  const r=auditModel(modelFixture());assert.equal(r.ok,true);assert.equal(r.runtimeVerified,false);assert.equal(r.counts.bones,1);
});
test('supports Blockbench 5 separate group table and nested outliner',()=>{
  const m=modelFixture();m.groups=[{uuid:'bone-id',name:'body',origin:[0,0,0]}];m.outliner=[{uuid:'bone-id',children:['cube-id']}];assert.equal(auditModel(m).ok,true);
});
test('duplicate bones, dangling references and missing texture produce concrete findings',()=>{
  const m=modelFixture();m.outliner.push({uuid:'other-id',name:'body',children:['missing']});m.textures=[];
  const c=codes(m);for(const code of ['BONE_NAME_DUPLICATE','OUTLINER_DANGLING','TEXTURE_MISSING','FACE_TEXTURE'])assert(c.has(code),code);
});
test('engine differences: ModelEngine animated hitbox rejected and Bezier flagged; BetterModel accepts both',()=>{
  const m=modelFixture();m.outliner[0].name='hitbox';m.animations[0].animators['bone-id'].keyframes[0].interpolation='bezier';
  const c=codes(m);assert(c.has('ANIMATED_HITBOX'));assert(c.has('BEZIER_FALLBACK'));
  const b=codes(m,'bettermodel');assert(!b.has('ANIMATED_HITBOX'));assert(!b.has('BEZIER_FALLBACK'));
});
test('UV boundaries, invalid coordinates and keyframe time detected',()=>{
  const m=modelFixture();m.elements[0].faces.north.uv=[0,0,99,2];m.animations[0].animators['bone-id'].keyframes[0].time=2;
  assert(codes(m).has('UV_BOUNDS'));assert(codes(m).has('KEYFRAME_TIME'));m.elements[0].to=[NaN,1,1];assert(codes(m).has('CUBE_COORDINATES'));
});
test('Blockbench preview-created empty hitbox animator is not animated geometry',()=>{
  const m=modelFixture();m.outliner.push({uuid:'hitbox-id',name:'hitbox',origin:[0,0,0],children:[]});
  m.animations[0].animators['hitbox-id']={type:'bone',name:'hitbox',keyframes:[]};
  assert(!codes(m).has('ANIMATED_HITBOX'));
  m.animations[0].animators['hitbox-id'].keyframes=[{time:0,channel:'position'}];
  assert(codes(m).has('ANIMATED_HITBOX'));
});
test('budget is advisory and animation slots do not pass as finished animation',()=>{
  const m=modelFixture();m.animations[0].animators={};assert(codes(m).has('ANIMATION_EMPTY'));
  m.outliner.push({uuid:'other',name:'tail',children:[]});const r=auditModel(m,'both',1);assert(r.findings.some(f=>f.code==='BONE_BUDGET'&&f.severity==='warning'));
});
test('three creature scaffolds have unique names, topologically ordered bones, valid cube bounds and separate hitbox',()=>{
  for(const type of ['biped','quadruped','dragon']) {
    const plan=scaffoldPlan(type,2,true);const names=new Set();
    for(const g of plan.create_groups){assert(!names.has(g.name));if(g.parent)assert(names.has(g.parent));names.add(g.name);}
    for(const c of plan.create_cubes){assert(names.has(c.parent));assert(c.to.every((v,i)=>v>=c.from[i]));}
    assert(!plan.create_groups.find(g=>g.name==='hitbox').parent);
  }
});
test('ModelEngine normalized IDs and cube-less tags are audited without imposing them on BetterModel',()=>{
  const m=modelFixture();m.outliner.push({uuid:'second',name:'h_body',children:[]});
  assert(codes(m,'modelengine').has('ENGINE_BONE_ID_DUPLICATE'));
  assert(!codes(m,'bettermodel').has('ENGINE_BONE_ID_DUPLICATE'));
  m.outliner.pop();m.outliner[0].name='seg_body';
  assert(codes(m,'modelengine').has('BONE_BEHAVIOR_GEOMETRY'));
});
test('AABB has square/size checks while rectangular OBB is allowed',()=>{
  const m=modelFixture();m.elements[0].to=[2,2,1];m.outliner[0].name='b_body';
  assert(codes(m,'modelengine').has('HITBOX_SQUARE'));
  m.outliner[0].name='ob_body';assert(!codes(m,'modelengine').has('HITBOX_SQUARE'));
});
