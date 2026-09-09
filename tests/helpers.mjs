import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const runtime=await import(pathToFileURL(resolve(process.env.BLOCKBENCH_TEST_DIR,'.','runtime.mjs')));
export const content=result=>JSON.parse(result.content.find(c=>c.type==='text').text);
export function modelFixture(){return {
  meta:{model_format:'free',format_version:'4.10'},name:'test_creature',resolution:{width:16,height:16},
  elements:[{uuid:'cube-id',type:'cube',name:'cube',from:[-1,0,-1],to:[1,2,1],faces:{north:{uv:[0,0,2,2],texture:0}}}],
  outliner:[{uuid:'bone-id',name:'body',origin:[0,0,0],children:['cube-id']}],
  textures:[{uuid:'texture-id',id:'0',source:'data:image/png;base64,aGVsbG8='}],
  animations:['idle','walk'].map(name=>({name,length:1,loop:'loop',override:false,animators:{'bone-id':{type:'bone',keyframes:[{time:0,channel:'rotation',interpolation:'linear',data_points:[{x:0,y:0,z:0}]}]}}})),
};}
