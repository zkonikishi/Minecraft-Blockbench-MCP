import {modelBinding,pngDimensions,effectKeyframes} from './bindings.mjs';
import {createHash} from 'node:crypto';
const uuid=key=>{const h=createHash('sha256').update(key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const vec=(a,d=[0,0,0])=>{const v=a??d;if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))throw Error('Invalid geometry vector');return [...v];};
const pos=a=>{const v=vec(a);v[0]=-v[0];return v;};
const rot=a=>{const v=vec(a);return [-v[0],-v[1],v[2]];};
const negate=v=>typeof v==='number'?-v:`-(${v})`;
const faces=['north','east','south','west','up','down'];
export function convertAssets(files,{texture}={}){
 const issues=[];const models=[];const bindings=[];
 const jsons=files.filter(f=>f.path.endsWith('.json')).map(f=>({path:f.path,json:JSON.parse(Buffer.from(f.data,'base64').toString('utf8').replace(/^\uFEFF/,''))}));
 const pngs=files.filter(f=>f.path.endsWith('.png')&&!/avatar/i.test(f.path));
 const fallbackTexture=texture?pngs.find(f=>f.path===texture):pngs.find(f=>/(^|\/)normal\.png$/.test(f.path))??pngs[0];
 if(texture&&!fallbackTexture)throw Error('Selected texture not found in extracted assets');
 if(!fallbackTexture)issues.push('No PNG texture found; recovered geometry is untextured.');
 if(pngs.length>1&&!texture)issues.push(`Multiple textures found; selected ${fallbackTexture?.path}. Other textures retained as assets; pass texture to select another.`);
 for(const entry of jsons){const geometries=entry.json['minecraft:geometry'];if(!Array.isArray(geometries))continue;
  const binding=modelBinding(jsons,entry.path);
  const chosen=texture?fallbackTexture:pngs.find(f=>f.path===binding?.texture)??fallbackTexture;
  if(binding?.texture&&!pngs.some(f=>f.path===binding.texture))issues.push(`${entry.path}: configured texture ${binding.texture} missing; fallback used.`);
  bindings.push({model:entry.path,...binding,selectedTexture:chosen?.path??null});
  for(const ref of binding?.animationFiles??[])if(!jsons.some(f=>f.path===ref))issues.push(`${entry.path}: configured animation ${ref} missing; original config retained.`);
  for(const [gi,geometry] of geometries.entries()){
   const prefix=`${entry.path}:${gi}`;const bones=geometry.bones??[];if(bones.length>4096)throw Error('Bone count exceeds limit');
   const names=new Map();const elements=[];const outliner=[];
   for(const b of bones){if(typeof b.name!=='string'||names.has(b.name))throw Error('Missing or duplicate bone name');names.set(b.name,{uuid:uuid(prefix+':bone:'+b.name),name:b.name,origin:pos(b.pivot),rotation:rot(b.rotation),children:[],export:true,isOpen:true,mirror_uv:b.mirror===true,reset:b.reset===true});}
   for(const b of bones){const group=names.get(b.name);let current=b;const visited=new Set();while(current?.parent){if(visited.has(current.parent))throw Error('Cyclic bone hierarchy');visited.add(current.parent);current=bones.find(v=>v.name===current.parent);if(!current)throw Error('Missing parent bone');}
    if(b.parent)names.get(b.parent).children.push(group);else outliner.push(group);
    for(const [i,c] of (b.cubes??[]).entries()){
     if(elements.length>=50000)throw Error('Element count exceeds limit');
     const size=vec(c.size),o=vec(c.origin);if(size.some(n=>n<0))issues.push(`${entry.path}/${b.name}: negative cube size preserved as directed bounds; visual review required.`);
     const from=[-o[0]-size[0],o[1],o[2]];
     const cube={uuid:uuid(prefix+':cube:'+b.name+':'+i),type:'cube',name:c.name??b.name,from,to:from.map((v,j)=>v+size[j]),origin:pos(c.pivot),rotation:rot(c.rotation),inflate:c.inflate??b.inflate??0,box_uv:Array.isArray(c.uv),uv_offset:Array.isArray(c.uv)?c.uv:[0,0],mirror_uv:c.mirror??b.mirror??false,autouv:0,faces:{}};
     for(const face of faces){const f=c.uv?.[face];let uv=[0,0,0,0];if(f){const d=f.uv_size??(face==='up'||face==='down'?[size[0],size[2]]:face==='east'||face==='west'?[size[2],size[1]]:[size[0],size[1]]);uv=[...f.uv,f.uv[0]+d[0],f.uv[1]+d[1]];if(face==='up'||face==='down')uv=[uv[2],uv[3],uv[0],uv[1]];}cube.faces[face]={uv,rotation:f?.uv_rotation??0,texture:chosen&&(cube.box_uv||f)?0:null};}
     elements.push(cube);group.children.push(cube.uuid);
    }
    for(const [name,raw] of Object.entries(b.locators??{})){const value=Array.isArray(raw)?{offset:raw}:raw;const id=uuid(prefix+':locator:'+b.name+':'+name);elements.push({uuid:id,type:'locator',name,position:pos(value.offset),rotation:rot(value.rotation),ignore_inherited_scale:value.ignore_inherited_scale===true});group.children.push(id);}
    for(const key of ['poly_mesh','binding','texture_meshes'])if(b[key])issues.push(`${entry.path}/${b.name}: ${key} retained only in source assets.`);
   }
   const animations=[];
   for(const af of jsons.filter(f=>!binding||binding.animationFiles.includes(f.path)))for(const [name,a] of Object.entries(af.json.animations??{})){
    if(!a||typeof a!=='object')continue;
    const animation={uuid:uuid(prefix+':animation:'+af.path+':'+name),name,loop:a.loop===true?'loop':a.loop==='hold_on_last_frame'?'hold':'once',override:a.override_previous_animation===true,length:Number(a.animation_length)||0,animators:{},snapping:20};
    for(const [boneName,tracks] of Object.entries(a.bones??{})){
     const group=names.get(boneName);if(!group){issues.push(`${af.path}/${name}: animation bone ${boneName} not present in ${entry.path}.`);continue;}
     const animator={name:boneName,type:'bone',keyframes:[],rotation_global:tracks.relative_to?.rotation==='entity'};
     for(const channel of ['position','rotation','scale']){const track=tracks[channel];if(track===undefined)continue;
      const entries=Array.isArray(track)||typeof track!=='object'||'pre' in track||'post' in track?[[0,track]]:Object.entries(track);
      for(const [time,source] of entries){const t=Number(time);if(!Number.isFinite(t)||t<0)throw Error('Invalid keyframe time');
       function point(value){const isArray=Array.isArray(value);const v=isArray?value:[value,value,value];if(v.length!==3||!v.every(x=>typeof x==='string'||Number.isFinite(x)))throw Error('Unsupported animation data point');const p={x:v[0],y:v[1],z:v[2]};if(isArray&&channel==='position')p.x=negate(p.x);if(isArray&&channel==='rotation'){p.x=negate(p.x);p.y=negate(p.y);}return p;}
       const object=source&&typeof source==='object'&&!Array.isArray(source);const values=object?[...(source.pre!==undefined?[source.pre]:[]),...(source.post!==undefined?[source.post]:[])]:[source];if(!values.length)throw Error('Unsupported keyframe object');
       animator.keyframes.push({uuid:uuid(prefix+':kf:'+af.path+':'+name+':'+boneName+':'+channel+':'+time),channel,time:t,interpolation:source?.lerp_mode??'linear',data_points:values.map(point),uniform:!Array.isArray(object?(source.post??source.pre):source)});animation.length=Math.max(animation.length,t);
      }
     }
     animation.animators[group.uuid]=animator;
    }
    const effects=effectKeyframes(a,key=>uuid(prefix+':effect:'+af.path+':'+name+':'+key));
    if(effects.length){animation.animators.effects={type:'effect',keyframes:effects};animation.length=Math.max(animation.length,...effects.map(k=>k.time));}
    if(Object.keys(animation.animators).length)animations.push(animation);
    for(const key of ['anim_time_update','blend_weight','start_delay','loop_delay'])if(a[key]!==undefined)issues.push(`${af.path}/${name}: ${key} retained in source assets; runtime semantics not converted.`);
   }
   const d=geometry.description??{};const width=d.texture_width??64,height=d.texture_height??64;
   const pixels=chosen?pngDimensions(chosen,{width,height}):{width,height};
   const textures=chosen?[{uuid:uuid(prefix+':texture'),id:'0',name:chosen.path.split('/').at(-1),source:'data:image/png;base64,'+chosen.data,mode:'bitmap',width:pixels.width,height:pixels.height,uv_width:width,uv_height:height}]:[];
   const filename=entry.path.replace(/[^a-zA-Z0-9_.-]/g,'_').replace(/\.json$/,`_${gi}.bbmodel`);
   if(models.some(m=>m.filename===filename))throw Error('Conflicting recovered model filenames');
   models.push({filename,model:{meta:{format_version:'4.10',model_format:'bedrock',box_uv:false},name:d.identifier??filename,model_identifier:d.identifier??filename,resolution:{width,height},elements,outliner,textures,animations,ysm_recovery:{source:entry.path,description:d}}});
  }
 }
 if(!models.length)throw Error('No supported Bedrock 1.12+ geometry recovered');
 return {models,report:{models:models.map(m=>({filename:m.filename,elements:m.model.elements.length,animations:m.model.animations.length})),texture:fallbackTexture?.path??null,bindings,effectEventsRecovered:true,issues:[...new Set(issues)],sourceAssetsPreserved:true,controllersConverted:false,molangEvaluated:false}};
}
