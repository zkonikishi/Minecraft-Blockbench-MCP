import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identifyYsm,recoverYsm} from '../src/converters/ysm/index.mjs';
import {convertAssets} from '../src/converters/ysm/model.mjs';
import {callYsm} from '../relay/ysm-tools.mjs';
const json=(path,value)=>({path,data:Buffer.from(JSON.stringify(value)).toString('base64')});
function assets(){
 const cube={origin:[1,2,3],size:[2,3,4],uv:{north:{uv:[1,2],uv_size:[3,4]},up:{uv:[2,3],uv_size:[4,5]}}};
 const bone={name:'body',pivot:[2,3,4],rotation:[10,20,30],cubes:[cube]};
 const geometry={description:{identifier:'geometry.test',texture_width:16,texture_height:16},bones:[bone]};
 const tracks={rotation:{'0':[10,20,30],'1':{pre:[0,0,0],post:[1,2,3],lerp_mode:'catmullrom'}},scale:[1,2,3]};
 return [json('main.json',{'minecraft:geometry':[geometry]}),json('main.animation.json',{animations:{idle:{animation_length:1,loop:true,bones:{body:tracks}}}}),{path:'normal.png',data:'iVBORw0KGgo='}];
}
test('YSM geometry restores reflected X, face UV and disabled faces without mutating source',()=>{
 const input=assets(),before=JSON.stringify(input);const r=convertAssets(input);const m=r.models[0].model;
 assert.deepEqual(m.outliner[0].origin,[-2,3,4]);assert.deepEqual(m.outliner[0].rotation,[-10,-20,30]);assert.deepEqual(m.elements[0].from,[-3,2,3]);
 assert.deepEqual(m.elements[0].faces.north.uv,[1,2,4,6]);assert.deepEqual(m.elements[0].faces.up.uv,[6,8,2,3]);assert.equal(m.elements[0].faces.south.texture,null);assert.equal(JSON.stringify(input),before);
});
test('YSM animation retains pre/post, interpolation and independent scale',()=>{
 const m=convertAssets(assets()).models[0].model;const a=m.animations[0];const k=Object.values(a.animators)[0].keyframes;
 assert.equal(a.loop,'loop');assert.deepEqual(k[0].data_points,[{x:-10,y:-20,z:30}]);assert.equal(k[1].data_points.length,2);assert.equal(k[1].interpolation,'catmullrom');assert.deepEqual(k[2].data_points,[{x:1,y:2,z:3}]);
});
test('YSM malformed hierarchy and ambiguous texture selection fail explicitly',()=>{
 const files=assets();const j=JSON.parse(Buffer.from(files[0].data,'base64'));j['minecraft:geometry'][0].bones[0].parent='body';files[0]=json('main.json',j);assert.throws(()=>convertAssets(files),/Cyclic/);assert.throws(()=>convertAssets(assets(),{texture:'absent.png'}),/not found/);
});
test('YSM malformed inputs terminate and tool errors are valid without an editor',async()=>{
 assert.equal(identifyYsm(Buffer.from('efbbbf595347500d','hex')).format,'BOM-v3');
 await assert.rejects(recoverYsm(Buffer.from('not a YSM file')),/Parser/);
 assert.equal((await callYsm('mc_ysm_recover',{data:'@@'})).isError,true);
 const result=await callYsm('mc_ysm_inspect',{data:Buffer.from('5953475000000002','hex').toString('base64')});assert(!result.isError);assert.equal(JSON.parse(result.content[0].text).containerVersion,2);
});

test('YSM parser artifacts match the pinned release manifest',()=>{
 const base=new URL('../vendor/ysmparser/',import.meta.url);const manifest=JSON.parse(readFileSync(new URL('provenance.json',base),'utf8'));
 for(const [name,hash] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(readFileSync(new URL(name,base))).digest('hex'),hash);
});
