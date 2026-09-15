import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers.mjs';
import {frameTimes,playerHtml} from '../scripts/animation-review-lib.mjs';
const key=(time,x)=>({time,channel:'rotation',interpolation:'linear',data_points:[{x,y:0,z:0}]});
const fixture=()=>({name:'walk',length:1,loop:'loop',animators:{root:{type:'bone',keyframes:[key(0,0),key(.5,20),key(1,0)]}}});
const options={source:'root',chains:[{bones:['neck','head'],offset:0,amplitude:1}],delay:.1,gain:.8,fps:20,name:'walk_variant'};
test('chain produces delayed numeric variant, exact loop seam and preserves source',()=>{
 const input=fixture(),before=structuredClone(input),out=runtime.chainVariant(input,options);assert.deepEqual(input,before);assert.equal(out.name,'walk_variant');
 const neck=out.animators.neck.keyframes,head=out.animators.head.keyframes;assert.equal(neck.length,21);assert.deepEqual(head[0].data_points,head.at(-1).data_points);assert.notDeepEqual(neck[0].data_points,head[0].data_points);
});
test('chain rejects expressions, curves and unmatched loop endpoints',()=>{
 for(const change of [k=>k.data_points[0].x='query.anim_time',k=>k.interpolation='bezier']){const clip=fixture();change(clip.animators.root.keyframes[0]);assert.throws(()=>runtime.chainVariant(clip,options),/numeric linear/);}
 const clip=fixture();clip.animators.root.keyframes.at(-1).data_points[0].x=5;assert.throws(()=>runtime.chainVariant(clip,options),/matching explicit/);
});
test('chain preserves unrelated effects and regenerates key identities',()=>{
 const clip=fixture();clip.animators.effects={keyframes:[{uuid:'old',time:.2,channel:'sound',data_points:[{effect:'roar'}]}]};const out=runtime.chainVariant(clip,options);assert.equal(out.animators.effects.keyframes[0].data_points[0].effect,'roar');assert.equal(out.animators.effects.keyframes[0].uuid,undefined);
});
test('diagnostics flag seam, jump, duplicate, empty and unevaluated tracks without changing data',()=>{
 const clip=fixture();clip.animators.root.keyframes=[key(0,0),key(.5,180),key(.5,200),key(1,220)];clip.animators.empty={keyframes:[]};clip.animators.expr={keyframes:[key(0,'query.anim_time')]};
 const before=structuredClone(clip),report=runtime.diagnoseAnimation(clip),codes=report.findings.map(f=>f.code);for(const code of ['ROTATION_JUMP','DUPLICATE_TIME','LOOP_SEAM','EMPTY_TRACK','UNEVALUATED_TRACK'])assert.ok(codes.includes(code));assert.deepEqual(clip,before);assert.equal(report.visualVerified,false);
});
test('identical tracks are diagnostic hints',()=>{const clip=fixture();clip.animators.copy=structuredClone(clip.animators.root);assert.ok(runtime.diagnoseAnimation(clip).findings.some(f=>f.code==='IDENTICAL_TRACKS'));});
test('continuous frame plan has bounded count and exact endpoint',()=>{assert.equal(frameTimes(1).length,25);assert.equal(frameTimes(60).length,241);assert.equal(frameTimes(.3).at(-1),.3);assert.throws(()=>frameTimes(0));});
test('player escapes embedded script termination and supports incomplete captures',()=>{const html=playerHtml({times:[0],frames:['</script>']});assert.ok(html.includes('\\u003c/script>'));assert.ok(playerHtml({times:[],frames:[]}).includes('Play / Pause'));});
test('chain tool defaults dry-run; apply uses new animation and one Undo transaction',async()=>{
 const data=fixture(),original={uuid:'original',name:'walk',getUndoCopy:()=>structuredClone(data)};let writes=0,finishes=0;
 class Animation{static all=[original];constructor(data){Object.assign(this,data);this.uuid='variant';}add(){Animation.all.push(this);return this;}}
 globalThis.Animation=Animation;globalThis.Project={};const root={uuid:'root',name:'root'},neck={uuid:'neck',name:'neck'},head={uuid:'head',name:'head',parent:neck};globalThis.Group={all:[root,neck,head]};
 globalThis.Undo={initEdit(){writes++;},finishEdit(){finishes++;},cancelEdit(){throw Error('Unexpected rollback');}};
 const registry=new runtime.ToolRegistry();for(const t of runtime.animationQualityTools())registry.add(t);
 const args={animation:'walk',name:'variant',source:'root',chains:[{bones:['neck','head']}]};
 const dry=await registry.call('mc_animation_chain',args);assert.equal(dry.isError,undefined);assert.equal(writes,0);
 const applied=await registry.call('mc_animation_chain',{...args,dry_run:false});assert.equal(applied.isError,undefined);assert.equal(writes,1);assert.equal(finishes,1);assert.equal(Animation.all[0],original);assert.equal(Animation.all.length,2);
 assert.equal((await registry.call('mc_animation_chain',{...args,dry_run:false})).isError,true);assert.equal(writes,1);
});
