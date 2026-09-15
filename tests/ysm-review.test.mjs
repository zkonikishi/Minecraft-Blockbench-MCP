import test from 'node:test';
import assert from 'node:assert/strict';
import {collectReview,planPoses,reviewHtml} from '../scripts/ysm-review-lib.mjs';
const json=v=>({content:[{type:'text',text:JSON.stringify(v)}]});
async function run({switchProject=false,noImages=false}={}) {
  const calls=[],saved=[];let imported=false;
  const report={images:[],captureComplete:false};
  await collectReview({model:{},report,saveImage:async(n)=>saved.push(n),call:async(name,args)=>{
    calls.push({name,args});
    if(name==='mc_status')return json({project:{uuid:imported?(switchProject?'other':'review'):'original'}});
    if(name==='mc_import_bbmodel'){imported=true;return json({project:{uuid:'review'}});}
    if(name==='craft_capture_views')return {content:noImages?[]:Array.from({length:3},()=>({type:'image',mimeType:'image/png',data:Buffer.from('89504e470d0a1a0a','hex').toString('base64')}))};
    return json({});
  }});
  return {calls,saved,report};
}
test('review limits animation sampling to 3 clips and 4 times',()=>{
  const poses=planPoses({animations:Array.from({length:20},(_,i)=>({uuid:String(i),name:'walk',length:2}))});
  assert.equal(poses.length,13);assert.equal(poses.at(-1).time,1.5);
});
test('captures evidence but never claims visual or client acceptance',async()=>{
  const {report,saved}=await run();assert.equal(saved.length,3);assert.equal(report.captureComplete,true);assert.equal(report.visualVerified,false);assert.equal(report.clientVerified,false);assert.equal(report.editModeRestored,true);
});
test('project switch stops preview and cleanup writes',async()=>{
  const {report,calls}=await run({switchProject:true});assert.match(report.error,/project changed/);assert.equal(calls.filter(c=>c.name==='mc_preview_animation').length,0);
});
test('missing screenshots cannot pass capture gate',async()=>{const {report}=await run({noImages:true});assert.equal(report.captureComplete,false);assert.match(report.error,/three captured/);});
test('HTML escapes untrusted model labels',()=>{const html=reviewHtml({images:[{filename:'view-001.png',label:'<script>alert(1)</script>',view:'iso'}]});assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));});
