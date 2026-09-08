import { z } from 'zod';
import { zodTool, type ToolDefinition } from './registry.js';
import { compileProject } from './creature-tools.js';
import { auditModel } from './engine-audit.js';
import { behaviorName, parseBehavior } from './modelengine.js';

const G=()=>globalThis as any;
const id=z.string().min(1).max(128);
const name=z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const vec=z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]);
const expr=z.union([z.number().finite(),z.string().min(1).max(4096)]);
const channel=z.enum(['position','rotation','scale']);
const readonly={annotations:{readOnlyHint:true}};
function unique(items:any[],value:unknown){const found=items.filter(n=>n.uuid===value||n.name===value);if(found.length!==1)throw Error(`Expected one object for ${value}; use UUID`);return found[0];}
function nodes(){return [...(G().Group?.all||[]),...(G().Outliner?.elements||[])];}
function animation(value:unknown){return unique(G().Animation?.all||[],value);}
function project(){if(!G().Project)throw Error('Open a project first');}
function edit(label:string,aspects:any,run:()=>any){project();G().Undo.initEdit(aspects);try{const result=run();G().Undo.finishEdit(label);G().Canvas?.updateAll?.();return result;}catch(e){G().Undo.cancelEdit();throw e;}}
function serialize(n:any){return n.getSaveCopy?.()??n.getUndoCopy?.();}

export function shiftTime(time:number,length:number,phase:number){if(!(length>0))throw Error('Animation length must be positive');return phase===0?time:((time+phase*length)%length+length)%length;}
export function squareBounds(from:number[],to:number[]){const width=Math.max(to[0]-from[0],to[2]-from[2]);const mid=[(to[0]+from[0])/2,(to[2]+from[2])/2];return {from:[mid[0]-width/2,from[1],mid[1]-width/2],to:[mid[0]+width/2,to[1],mid[1]+width/2]};}
export function validateScript(script:string){
  const lines=script.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length)throw Error('Script is empty');
  for(const line of lines)if(!/^(mm:[a-zA-Z0-9_.-]+(?:\{[^\r\n]*\})?|(?:changeparent|partvis|tint|enchant|tag|changepart|remap)(?:\{[^\r\n]*\})?)$/.test(line))throw Error(`Unsupported ModelEngine instruction: ${line}`);
  return lines.join('\n');
}

/** Export a collection without mutating the open project or rewriting its hierarchy. */
export function collectionModel(model:any,roots:string[]){
  const copy=structuredClone(model), kept=new Set<string>();
  const scan=(list:any[],take=false):any[]=>list.flatMap(n=>{const uuid=typeof n==='string'?n:n.uuid;const include=take||roots.includes(uuid);const children=typeof n==='object'?scan(n.children||[],include):[];if(include||children.length){kept.add(uuid);return [typeof n==='string'?n:{...n,children}];}return [];});
  copy.outliner=scan(copy.outliner||[]);
  for(const root of roots)if(!kept.has(root))throw Error(`Collection has missing node ${root}`);
  copy.elements=(copy.elements||[]).filter((n:any)=>kept.has(n.uuid));
  copy.groups=(copy.groups||[]).filter((n:any)=>kept.has(n.uuid));
  copy.collections=[];
  copy.animations=(copy.animations||[]).map((a:any)=>({...a,animators:Object.fromEntries(Object.entries(a.animators||{}).filter(([uuid])=>kept.has(uuid)))}));
  return copy;
}

export function workflowTools():ToolDefinition[]{return [
  zodTool('mc_workflow_capabilities','Inspect native BB APIs and the dedicated creature workflow tools; no game-runtime certification.',z.object({}).strict(),()=>({blockbench:G().Blockbench?.version,apis:Object.fromEntries(['BoundingBox','Locator','NullObject','Collection','AnimationCodec','moveOutlinerSelectionTo'].map(k=>[k,typeof G()[k]!=='undefined'])),mirrorAnimating:!!G().BarItems?.mirror_animating,web:true,runtimeVerified:false}),readonly),
  zodTool('mc_mirror_animation','Copy bone channels to an explicit opposite bone using native keyframe mirroring, including Molang and Bezier handles. Phase is a fraction of a loop. Existing destination keys require replace.',z.object({animation:id,source:id,destination:id,axis:z.enum(['x','y','z']).default('x'),phase:z.number().min(0).max(1).default(0),replace:z.boolean().default(false)}).strict(),a=>{
    const clip=animation(a.animation),source=unique(nodes(),a.source),dest=unique(nodes(),a.destination);
    if(source===dest)throw Error('Source and destination must differ');
    if(a.phase&&clip.loop!=='loop')throw Error('Phase offset requires a looping animation');
    const keys=clip.animators[source.uuid]?.keyframes?.filter((k:any)=>['rotation','position','scale'].includes(k.channel))||[];
    if(!keys.length)throw Error('Source has no transform keys');
    const existing=clip.animators[dest.uuid]?.keyframes||[];
    if(existing.length&&!a.replace)throw Error('Destination has keys; set replace explicitly');
    const copies=keys.map((k:any)=>({data:k.getUndoCopy(true),time:shiftTime(k.time,clip.length,a.phase as number)}));
    if(a.phase){
      const seam=(1-(a.phase as number))*clip.length;
      for(const c of new Set(keys.map((k:any)=>k.channel)))if(!keys.some((k:any)=>k.channel===c&&Math.abs(k.time-seam)<1e-6))throw Error('Add a source key at the phase seam before mirroring to preserve curve continuity');
      for(const copy of copies.filter((k:any)=>Math.abs(k.time)<1e-6))copies.push({data:structuredClone(copy.data),time:clip.length});
    }
    return edit('Mirror creature animation',{animations:[clip]},()=>{
      const target=clip.getBoneAnimator(dest);if(!target)throw Error('Destination cannot be animated');target.rotation_global=clip.animators[source.uuid].rotation_global;
      for(const k of existing.slice())k.remove();
      const occupied=new Set<string>();let count=0;
      for(const {data,time} of copies){const key=`${data.channel}:${time.toFixed(6)}`;if(occupied.has(key))continue;occupied.add(key);delete data.uuid;const k=target.addKeyframe({...data,time});if(!k)throw Error('Unable to add mirrored key');k.flip(['x','y','z'].indexOf(a.axis as string));count++;}
      return {created:count,source:source.uuid,destination:dest.uuid};
    });
  }),
  zodTool('mc_mirror_animating','Configure Blockbench live mirror animating and its phase offset for later keyframe edits.',z.object({enabled:z.boolean(),phase_degrees:z.number().min(0).max(360).default(0)}).strict(),a=>{
    const toggle=G().BarItems?.mirror_animating;if(!toggle?.tool_config?.options)throw Error('Native Mirror Animating unavailable');
    toggle.tool_config.options.offset='custom';toggle.tool_config.options.custom_offset=a.phase_degrees;
    if(!G().Modes?.animate)throw Error('Use mc_preview_animation to enter Animate mode first');
    if(toggle.value!==a.enabled)toggle.trigger();return {enabled:toggle.value,phase_degrees:a.phase_degrees};
  }),
  zodTool('mc_reparent_bone','Move one bone using native Preserve World Transform. Preserves rest pose; does not retarget existing animation curves.',z.object({bone:id,parent:id,preserve_world:z.boolean().default(true)}).strict(),a=>{
    const bone=unique(G().Group.all,a.bone),parent=unique(G().Group.all,a.parent);
    if(bone===parent||parent.isChildOf(bone))throw Error('Reparent would create a cycle');
    if(G().Modes?.animate)throw Error('Switch to Edit mode before changing rest hierarchy');
    if(G().Pressing?.overrides?.alt)throw Error('Release Alt before changing hierarchy');
    if(typeof G().moveOutlinerSelectionTo!=='function')throw Error('Native reparent API unavailable');
    const selected=nodes().filter(n=>n.selected);
    try{G().unselectAllElements();bone.select();G().moveOutlinerSelectionTo(bone,parent,0,{event:{altKey:false},adjust_position:a.preserve_world});}
    finally{G().unselectAllElements();for(const n of selected)if(n instanceof G().Group)n.multiSelect();else n.markAsSelected(true);G().updateSelection();}
    return {bone:bone.uuid,parent:parent.uuid,preserve_world:a.preserve_world,animationRetargeted:false};
  }),
  zodTool('mc_bounding_box','Create or update a native axis-aligned BoundingBox. Can compute bounds from rendered cube vertices in model space, including parent rotations.',z.object({name,box:id.optional(),from:vec.optional(),to:vec.optional(),elements:z.array(id).min(1).max(4096).optional(),padding:z.number().min(0).max(128).default(0)}).strict(),a=>{
    project();if(!G().BoundingBox)throw Error('BoundingBox API unavailable');
    if(!!a.elements===(!!a.from||!!a.to))throw Error('Provide elements OR both from and to');
    let from=a.from as number[],to=a.to as number[];
    if(a.elements){const chosen=(a.elements as string[]).map(v=>unique(G().Cube.all,v));const points:number[][]=[];
      for(const cube of chosen){cube.mesh.updateWorldMatrix(true,false);const p=cube.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new (G().THREE.Vector3)().fromBufferAttribute(p,i);cube.mesh.localToWorld(v);G().Project.model_3d.worldToLocal(v);points.push(v.toArray());}}
      from=[0,1,2].map(i=>points.reduce((v,p)=>Math.min(v,p[i]),Infinity));to=[0,1,2].map(i=>points.reduce((v,p)=>Math.max(v,p[i]),-Infinity));
    }
    if(!from||!to||[...from,...to].some(n=>!Number.isFinite(n))||to.some((n,i)=>n<=from[i]))throw Error('Bounds must have positive finite XYZ size');
    from=from.map(n=>n-(a.padding as number));to=to.map(n=>n+(a.padding as number));
    const current=a.box?unique(G().BoundingBox.all,a.box):null;
    const affected=current?[current]:[];
    return edit('Edit creature bounds',{elements:affected,outliner:true},()=>{const box=current??new (G().BoundingBox)({name:a.name}).init();if(!current)affected.push(box);box.extend({name:a.name,from,to,function:['hitbox','collision']});box.preview_controller.updateGeometry(box);return serialize(box);});
  }),
  zodTool('mc_convert_hitbox','Convert a root-level native bounding box into a separate engine hitbox bone and defining cube. Primary eye_height is the world Y pivot in pixels, defaulting to 85% of the box top. ModelEngine AABB expands X/Z equally; does not delete the authoring box.',z.object({box:id,target:z.enum(['bettermodel','modelengine']),kind:z.enum(['primary','aabb','obb']).default('primary'),eye_height:z.number().finite().positive().max(1024).optional(),name}).strict(),a=>{
    const box=unique(G().BoundingBox?.all||[],a.box);if(box.parent instanceof G().Group)throw Error('Use a root-level authoring bounding box');
    const next=behaviorName(a.target as any,a.name as string,a.kind==='primary'?'hitbox':a.kind as any,a.name as string);
    const existing=G().Group.all.filter((g:any)=>g.name===next);if(existing.length)throw Error('Hitbox name already exists; edit it or choose another name');
    if(a.target==='modelengine'&&G().Group.all.some((g:any)=>(parseBehavior(g.name)?.id??g.name)===(parseBehavior(next)?.id??next)))throw Error('Hitbox would collide with an existing ModelEngine bone ID');
    let bounds={from:[...box.from],to:[...box.to]};if(a.target==='modelengine'&&a.kind!=='obb')bounds=squareBounds(bounds.from,bounds.to);
    if(bounds.to.some((n,i)=>n<=bounds.from[i]||n-bounds.from[i]>1024))throw Error('Hitbox dimensions must be in (0,1024]');
    if(a.kind!=='primary'&&a.eye_height!==undefined)throw Error('eye_height applies only to a primary hitbox');
    const eyeHeight=a.kind==='primary'?((a.eye_height as number|undefined)??bounds.to[1]*0.85):0;
    if(a.kind==='primary'&&(!Number.isFinite(eyeHeight)||eyeHeight<=0||eyeHeight>1024))throw Error('Set a positive eye_height in (0,1024] for this primary hitbox');
    const elements:any[]=[],groups:any[]=[];
    return edit('Convert engine hitbox',{elements,groups,outliner:true},()=>{const group=new (G().Group)({name:next,origin:[0,eyeHeight,0]}).init();groups.push(group);const cube=new (G().Cube)({name:`${a.name}_shape`,...bounds}).addTo(group).init();elements.push(cube);return {target:a.target,bone:group.uuid,name:group.name,cube:cube.uuid,bounds,...(a.kind==='primary'?{eyeHeight}:{}),runtimeVerified:false};});
  }),
  zodTool('mc_control_node','Create a Locator or NullObject with optional IK chain on a NullObject. BetterModel supports these; ModelEngine export needs separate verification.',z.object({name,kind:z.enum(['locator','null_object']),position:vec,parent:id.optional(),ik_source:id.optional(),ik_target:id.optional(),lock_rotation:z.boolean().default(false)}).strict(),a=>{
    project();const Class=a.kind==='locator'?G().Locator:G().NullObject;if(!Class)throw Error('Control node API unavailable');
    const parent=a.parent?unique(G().Group.all,a.parent):null;
    if(!!a.ik_source!==!!a.ik_target)throw Error('Provide both IK source and target');
    if(a.kind!=='null_object'&&a.ik_source)throw Error('IK requires NullObject');
    const source=a.ik_source?unique(G().Group.all,a.ik_source):null,target=a.ik_target?unique(G().Group.all,a.ik_target):null;
    if(source&&(!target.isChildOf(source)||source===target))throw Error('IK target must descend from source');
    if(nodes().some(n=>n.name===a.name))throw Error('Node name exists');
    const elements:any[]=[];return edit('Create creature control',{elements,outliner:true},()=>{const n=new Class({name:a.name,position:a.position,...(source?{ik_source:source.uuid,ik_target:target.uuid,lock_ik_target_rotation:a.lock_rotation}:{})});if(parent)n.addTo(parent);n.init();elements.push(n);return serialize(n);});
  }),
  zodTool('mc_transform_keyframes','Author numeric or Molang transform keys, Bezier handles and global rotation with bounded validation. Never evaluates JavaScript.',z.object({animation:id,node:id,replace:z.boolean().default(false),global_rotation:z.boolean().optional(),keys:z.array(z.object({time:z.number().nonnegative(),channel,value:z.tuple([expr,expr,expr]),interpolation:z.enum(['linear','catmullrom','bezier','step']).default('linear'),bezier_left_time:vec.optional(),bezier_right_time:vec.optional(),bezier_left_value:vec.optional(),bezier_right_value:vec.optional()}).strict()).min(1).max(4096)}).strict(),a=>{
    const clip=animation(a.animation),node=unique(nodes(),a.node),keys=a.keys as any[];
    if(keys.some(k=>k.time>clip.length))throw Error('Keyframe exceeds animation length');
    const occupied=new Set<string>();for(const k of keys){const key=`${k.channel}:${k.time}`;if(occupied.has(key))throw Error('Duplicate channel/time');occupied.add(key);}
    const existing=clip.animators[node.uuid]?.keyframes||[];
    if(!a.replace&&existing.some((k:any)=>occupied.has(`${k.channel}:${k.time}`)))throw Error('Keyframe exists; set replace');
    return edit('Author creature keyframes',{animations:[clip]},()=>{const animator=clip.getBoneAnimator(node);if(!animator)throw Error('Node cannot be animated');if(a.global_rotation!==undefined)animator.rotation_global=a.global_rotation;
      for(const k of existing.slice())if(occupied.has(`${k.channel}:${k.time}`))k.remove();
      for(const k of keys){const {value,...rest}=k;if(!animator.addKeyframe({...rest,data_points:[{x:value[0],y:value[1],z:value[2]}]}))throw Error('Unsupported animation channel');}
      return {written:keys.length,node:node.uuid};});
  }),
  zodTool('mc_script_keyframes','Read, upsert or delete ModelEngine instruction keyframes. Supports mm: skills and documented MEG commands. Writes data only; never runs server skills.',z.object({animation:id,operation:z.enum(['read','upsert','delete']).default('read'),time:z.number().nonnegative().optional(),script:z.string().max(16384).optional()}).strict(),a=>{
    const clip=animation(a.animation),effects=clip.animators.effects;
    const current=effects?.timeline||[];
    if(a.operation==='read')return current.map((k:any)=>({uuid:k.uuid,time:k.time,script:k.data_points.map((p:any)=>p.script).join('\n')}));
    if(a.time===undefined||(a.time as number)>clip.length)throw Error('Provide time within animation duration');
    const script=a.operation==='upsert'?validateScript(String(a.script||'')):null;
    return edit('Edit skill keyframes',{animations:[clip]},()=>{const animator=effects??(clip.animators.effects=new (G().EffectAnimator)(clip));for(const k of current.slice())if(Math.abs(k.time-(a.time as number))<1e-6)k.remove();
      if(script&&!animator.addKeyframe({channel:'timeline',time:a.time,data_points:[{script}]}))throw Error('Effects timeline unavailable');
      return {operation:a.operation,time:a.time,serverExecuted:false};});
  }),
  zodTool('mc_texture_workflow','Set UV dimensions with optional proportional UV remapping, wrap mode and flipbook FPS on an existing texture. Image pixels are preserved; game export compatibility is audited separately.',z.object({texture:id,uv_size:z.tuple([z.number().int().min(1).max(8192),z.number().int().min(1).max(8192)]).optional(),remap_uv:z.boolean().default(true),wrap:z.enum(['limited','repeat','clamp']).optional(),fps:z.number().min(1).max(120).optional()}).strict(),a=>{
    const texture=unique(G().Texture.all,a.texture);const elements=G().Outliner.elements.filter((e:any)=>e.faces&&Object.values(e.faces).some((f:any)=>f.getTexture?.()===texture));
    if(a.uv_size&&!G().Format.per_texture_uv_size)throw Error('This format uses project-wide UV dimensions; use a per-texture UV format');
    if(a.uv_size&&a.remap_uv&&elements.some((e:any)=>e.box_uv))throw Error('Convert box UV to face UV before proportional remapping');
    const old=[texture.getUVWidth(),texture.getUVHeight()];
    return edit('Configure creature texture',{textures:[texture],elements,uv_only:true},()=>{
      if(a.uv_size){const size=a.uv_size as number[];if(a.remap_uv)for(const e of elements)for(const f of Object.values(e.faces) as any[])if(f.getTexture?.()===texture){if(Array.isArray(f.uv))f.uv=f.uv.map((v:number,i:number)=>v*size[i%2]/old[i%2]);else for(const key in f.uv)f.uv[key]=f.uv[key].map((v:number,i:number)=>v*size[i]/old[i]);}texture.uv_width=size[0];texture.uv_height=size[1];}
      if(a.wrap!==undefined)texture.wrap_mode=a.wrap;if(a.fps!==undefined)texture.fps=a.fps;texture.updateMaterial?.();return {uuid:texture.uuid,uv_size:[texture.getUVWidth(),texture.getUVHeight()],wrap:texture.wrap_mode,fps:texture.fps,pixelsChanged:false};});
  }),
  zodTool('mc_preview_animation','Select an animation and sample its pose and flipbook textures at an exact time, or return to Edit mode. This does not run ModelEngine scripts.',z.object({animation:id.optional(),time:z.number().nonnegative().default(0),mode:z.enum(['animate','edit']).default('animate')}).strict(),a=>{
    project();if(a.mode==='edit'){G().Modes.options.edit.select();return {mode:'edit'};}
    const clip=animation(a.animation);if((a.time as number)>clip.length)throw Error('Preview time exceeds duration');
    G().Modes.options.animate.select();clip.select();G().Timeline.pause();G().Timeline.setTime(a.time);G().Animator.preview();G().TextureAnimator.playAnimationFrame(a.time);
    return {animation:clip.uuid,time:a.time,serverExecuted:false};
  }),
  zodTool('mc_inspect_nodes','Read native node properties and model-space transforms for verifying rest-pose or animation changes.',z.object({nodes:z.array(id).min(1).max(256)}).strict(),a=>{
    project();return (a.nodes as string[]).map(v=>{const n=unique(nodes(),v),object=n.scene_object||n.mesh;object?.updateWorldMatrix(true,false);const matrix=object?new (G().THREE.Matrix4)().copy(G().Project.model_3d.matrixWorld).invert().multiply(object.matrixWorld).toArray():null;return {uuid:n.uuid,name:n.name,parent:n.parent?.uuid??null,data:serialize(n),modelMatrix:matrix};});
  },readonly),
  zodTool('mc_animation_codec','List installed native AnimationCodecs or compile one clip through the chosen codec. Returns content without filesystem writes.',z.object({operation:z.enum(['list','compile']).default('list'),codec:id.optional(),animation:id.optional()}).strict(),a=>{
    const codecs=G().AnimationCodec?.codecs;if(!codecs)throw Error('AnimationCodec API unavailable');
    if(a.operation==='list')return Object.entries(codecs).map(([id,c]:[string,any])=>({id,multiple:c.multiple_per_file,canCompile:typeof c.compileAnimation==='function'}));
    const codec=codecs[a.codec as string];if(!codec?.compileAnimation)throw Error('Choose an installed codec with canCompile');
    return {codec:a.codec,content:codec.compileAnimation(animation(a.animation)),engineCompatibility:'Codec output is not automatically a BetterModel or ModelEngine file'};
  },readonly),
  zodTool('mc_collection','List or create native collections for body, equipment and attachments. Explicit UUID members avoid experimental scope rules changing animation ownership.',z.object({operation:z.enum(['list','create']).default('list'),name:name.optional(),members:z.array(id).min(1).max(4096).optional()}).strict(),a=>{
    project();if(!G().Collection)throw Error('Collection API unavailable');if(a.operation==='list')return G().Collection.all.map((c:any)=>({uuid:c.uuid,name:c.name,members:c.children,scope:c.scope}));
    if(!a.name||!a.members)throw Error('name and members required');if(G().Collection.all.some((c:any)=>c.name===a.name))throw Error('Collection exists');
    const children=[...new Set((a.members as string[]).map(v=>unique(nodes(),v).uuid))];const collections:any[]=[];
    return edit('Create creature collection',{collections},()=>{const c=new (G().Collection)({name:a.name,children}).add();collections.push(c);return {uuid:c.uuid,name:c.name,members:c.children};});
  }),
  zodTool('mc_export_collection','Export a collection as portable .bbmodel JSON, preserving ancestor transforms and filtering animation tracks. Timeline scripts are deliberately omitted because they may reference excluded bones.',z.object({collection:id,target:z.enum(['bettermodel','modelengine']).default('bettermodel')}).strict(),a=>{const c=unique(G().Collection?.all||[],a.collection);const model=collectionModel(compileProject(),c.getChildren().map((n:any)=>n.uuid));return {filename:`${c.name}.bbmodel`,model,report:auditModel(model,a.target as any),omitted:'effects timeline'};},readonly),
  zodTool('mc_export_engine_variants','Return separate BetterModel and ModelEngine exports with independent audits. Native authoring boxes are omitted; convert them explicitly first. No lossy curve conversion is performed.',z.object({}).strict(),()=>{
    const base=compileProject();const boxes=new Set((base.elements||[]).filter((e:any)=>e.type==='bounding_box').map((e:any)=>e.uuid));
    const prune=(list:any[]):any[]=>list.filter(n=>!boxes.has(typeof n==='string'?n:n.uuid)).map(n=>typeof n==='object'?{...n,children:prune(n.children||[])}:n);
    const model={...base,elements:(base.elements||[]).filter((e:any)=>!boxes.has(e.uuid)),outliner:prune(base.outliner||[]),collections:(base.collections||[]).map((c:any)=>({...c,children:(c.children||[]).filter((uuid:string)=>!boxes.has(uuid))}))};
    return {variants:['bettermodel','modelengine'].map(target=>({target,filename:`${base.name}_${target}.bbmodel`,model:structuredClone(model),report:auditModel(model,target as any)})),removedAuthoringBoxes:boxes.size,runtimeVerified:false};
  },readonly),
];}
