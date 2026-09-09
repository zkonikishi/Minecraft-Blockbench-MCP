import { parseBehavior, behaviorGeometryIssue, MODELENGINE_CAPABILITIES } from './modelengine.js';
export type EngineTarget = 'bettermodel' | 'modelengine' | 'both';
export type Finding = {severity:'error'|'warning';code:string;path:string;message:string};
export const ENGINE_SOURCES = {
  bettermodel: 'https://github.com/toxicity188/BetterModel/wiki/BlockBench-support-range',
  bettermodelAnimation: 'https://github.com/toxicity188/BetterModel/wiki/Animating-your-own-model',
  bettermodelHitbox: 'https://github.com/toxicity188/BetterModel/wiki/Configuring-custom-hitbox',
  modelengine: 'https://wiki.mythiccraft.io/modelengine/Modeling/Creating-a-Model',
  modelengineAnimation: 'https://wiki.mythiccraft.io/modelengine/Modeling/Animating-a-Model',
  modelengineBones: 'https://wiki.mythiccraft.io/modelengine/Modeling/Bone-Behaviors',
};
export const ENGINE_PROFILES = {
  bettermodel: {format:'free',extension:'.bbmodel',defaultAnimations:['idle','walk','spawn','death','idle_fly','walk_fly','jump'],
    features:['Molang keyframes','Bezier interpolation','IK rigging','parent-following hitboxes: b_ / ob_ / hitbox'],
    limits:['Mesh support has UV limitations','Armature, spline and billboard elements are unsupported'],sources:ENGINE_SOURCES},
  modelengine: {format:'free',extension:'.bbmodel',capabilities:MODELENGINE_CAPABILITIES,defaultAnimations:['idle','walk','jump_start','jump','jump_end','spawn','death'],
    features:['loop / once / hold','animation override','special bone behaviors','hitbox and shadow groups'],
    limits:['hitbox bone is removed from the animated skeleton','Bezier currently falls back to linear','Hitbox: square X/Z; maximum 1024 pixels per dimension'],sources:ENGINE_SOURCES},
};
type Obj = Record<string,any>;
function object(value:unknown):value is Obj {return !!value&&typeof value==='object'&&!Array.isArray(value);}
function vector(value:unknown):value is number[] {return Array.isArray(value)&&value.length===3&&value.every(v=>typeof v==='number'&&Number.isFinite(v));}

/** Conservative offline authoring checks, not an emulation of either engine. */
export function auditModel(model:unknown,target:EngineTarget='both',boneBudget=64) {
  const findings:Finding[]=[];
  const add=(severity:Finding['severity'],code:string,path:string,message:string)=>findings.push({severity,code,path,message});
  if(!object(model))throw new Error('Expected a .bbmodel JSON object');
  const format=model.meta?.model_format;
  if(format!=='free')add('warning','FORMAT','meta.model_format','Use a Generic (free) .bbmodel for this shared engine workflow; no automatic format conversion was performed.');
  const name=model.model_identifier||model.name;
  if(typeof name!=='string'||!/^[a-z0-9_]+$/.test(name))add('warning','MODEL_ID','name','Use a lowercase model/file identifier containing a-z, 0-9 and underscore.');
  const elements:Obj[]=Array.isArray(model.elements)?model.elements:[];
  const textures:Obj[]=Array.isArray(model.textures)?model.textures:[];
  const animations:Obj[]=Array.isArray(model.animations)?model.animations:[];
  const allIds=new Set<string>();
  const elementMap=new Map<string,Obj>();
  const groups=new Map<string,Obj>();
  const parents=new Map<string,string>();
  const groupDefinitions:Obj[]=Array.isArray(model.groups)?model.groups:[];
  const checkId=(entry:Obj,path:string)=>{
    if(typeof entry.uuid!=='string'||!entry.uuid){add('error','UUID_MISSING',path,'Element/bone UUID is missing');return;}
    if(allIds.has(entry.uuid))add('error','UUID_DUPLICATE',path,`Duplicate UUID: ${entry.uuid}`);
    allIds.add(entry.uuid);
  };
  for(const [i,e] of elements.entries()) {
    if(!object(e)){add('error','ELEMENT_INVALID',`elements.${i}`,'Expected element object');continue;}
    checkId(e,`elements.${i}`);elementMap.set(e.uuid,e);
  }
  for(const [i,g] of groupDefinitions.entries()) {
    if(!object(g)){add('error','BONE_INVALID',`groups.${i}`,'Expected bone object');continue;}
    checkId(g,`groups.${i}`);groups.set(g.uuid,g);
  }
  const visited=new Set<string>();
  const visit=(nodes:unknown,parent?:string,depth=0)=>{
    if(!Array.isArray(nodes))return;
    if(depth>128){add('error','HIERARCHY_DEPTH','outliner','Hierarchy exceeds 128 levels');return;}
    for(const node of nodes) {
      const id=typeof node==='string'?node:object(node)?node.uuid:undefined;
      if(typeof id!=='string'){add('error','OUTLINER_INVALID','outliner','Outliner reference has no UUID');continue;}
      if(visited.has(id)){add('error','OUTLINER_DUPLICATE',id,'Repeated or cyclic outliner reference');continue;}
      visited.add(id);if(parent)parents.set(id,parent);
      if(object(node)) {
        if(!groups.has(id)){checkId(node,`outliner.${id}`);groups.set(id,node);}
        visit(node.children,id,depth+1);
      }else if(!elementMap.has(id)&&!groups.has(id))add('error','OUTLINER_DANGLING',id,'Outliner refers to a missing element or bone');
    }
  };
  visit(model.outliner);
  const names=new Set<string>();
  const engineIds=new Set<string>();
  for(const [id,g] of groups) {
    if(names.has(g.name))add('error','BONE_NAME_DUPLICATE',id,`Duplicate bone name: ${g.name}`);
    names.add(g.name);
    if(typeof g.name!=='string'||!g.name) add('error','BONE_NAME_MISSING',id,'Bone must have a name');
    if(!visited.has(id))add('error','BONE_ORPHAN',id,'Bone is absent from the outliner');
    if(g.origin!==undefined&&!vector(g.origin))add('error','PIVOT_INVALID',id,'Bone pivot must have three finite numbers');
    const tag=parseBehavior(g.name||'');
    if(target==='both'&&tag)add('warning','ENGINE_BONE_TAG',id,'Special bone tags have engine-specific semantics; verify a separate engine variant.');
    if(target!=='bettermodel'){
      const engineId=tag?.id??g.name;
      if(engineIds.has(engineId))add('error','ENGINE_BONE_ID_DUPLICATE',id,'Bone IDs collide after removing ModelEngine tags');
      engineIds.add(engineId);
      if(tag){
        const directElements=[...elementMap.keys()].filter(key=>parents.get(key)===id).length;
        const children=[...parents.values()].filter(parent=>parent===id).length;
        const issue=behaviorGeometryIssue(tag.behavior,directElements,children);
        if(issue)add('warning','BONE_BEHAVIOR_GEOMETRY',id,issue);
      }
    }
  }
  if(groups.size>boneBudget)add('warning','BONE_BUDGET','groups',`${groups.size} bones exceed your advisory budget ${boneBudget}; this is not an engine hard limit.`);
  const w=model.resolution?.width,h=model.resolution?.height;
  if(!(w>0&&h>0&&Number.isFinite(w)&&Number.isFinite(h)))add('error','TEXTURE_SIZE','resolution','Texture resolution must be positive and finite');
  const special=(id:string)=>{let at=parents.get(id);for(let n=0;at&&n<129;n++,at=parents.get(at)){const name=groups.get(at)?.name;if(name==='hitbox'||name==='shadow'||(target==='bettermodel'&&/^(b_|ob_)/.test(name||'')))return true;}return false;};
  for(const e of elements.filter(object)) {
    const id=e.uuid||e.name;const type=e.type||'cube';
    if(type==='mesh')add('warning','MESH_PORTABILITY',id,'Use cubes for the shared baseline; mesh import/UV behavior must be checked in the exact engine version.');
    else if(type==='bounding_box')add('warning','AUTHORING_BOUNDING_BOX',id,'Convert this authoring box into an engine hitbox before variant export.');
    else if(type!=='cube'&&!(target==='bettermodel'&&['locator','null_object'].includes(type)))add(target==='modelengine'?'warning':['armature','spline','billboard'].includes(type)?'error':'warning','ELEMENT_PORTABILITY',id,`Verify ${type} support in the target engine; this baseline uses cubes.`);
    if(type==='null_object'&&(e.ik_source||e.ik_target)) {
      if(!groups.has(e.ik_source)||!groups.has(e.ik_target))add('error','IK_REFERENCE',id,'IK source and target must reference existing bones');
      else {let at=parents.get(e.ik_target),valid=false;for(let n=0;at&&n<129;n++,at=parents.get(at))if(at===e.ik_source){valid=true;break;}if(!valid)add('error','IK_CHAIN',id,'IK target must descend from source');}
    }
    if(type!=='cube')continue;
    if(!parents.has(e.uuid))add('error','UNGROUPED_CUBE',id,'Every rendered cube must belong to a bone');
    if(!vector(e.from)||!vector(e.to)){add('error','CUBE_COORDINATES',id,'Cube bounds must contain finite XYZ values');continue;}
    if(e.to.some((v:number,i:number)=>v<e.from[i]))add('error','INVERTED_CUBE',id,'Cube maximum is below its minimum');
    if(target!=='bettermodel'&&vector(e.rotation)) {
      const nonzero=e.rotation.filter((v:number)=>Math.abs(v)>1e-6);
      if(nonzero.length>1||nonzero.some((v:number)=>![0,22.5,-22.5,45,-45].some(a=>Math.abs(a-v)<1e-6)))
        add('warning','CUBE_ROTATION',id,'ModelEngine documentation limits item cube rotation to one axis and 0, ±22.5, ±45 degrees; put arbitrary rotations on bones. Verify the target version.');
    }
    if(special(e.uuid))continue;
    for(const [dir,face] of Object.entries(e.faces||{}) as [string,Obj][]) {
      if(face.texture===null)continue;
      const tex=textures.find(t=>t.uuid===face.texture||String(t.id)===String(face.texture))??textures[Number(face.texture)];
      if(face.texture===false||face.texture===undefined||!tex)add('warning','FACE_TEXTURE',`${id}.${dir}`,'Visible face has no resolvable texture');
      const tw=tex?.uv_width||w,th=tex?.uv_height||h;
      if(!Array.isArray(face.uv)||face.uv.length!==4||!face.uv.every(Number.isFinite))add('error','UV_INVALID',`${id}.${dir}`,'Face UV must contain four finite numbers');
      else if(face.uv.some((v:number,i:number)=>v<0||v>(i%2?th:tw)))add('warning','UV_BOUNDS',`${id}.${dir}`,'UV extends outside the texture; inspect atlas before export');
    }
  }
  if(!textures.length)add('warning','TEXTURE_MISSING','textures','No texture sheets are present');
  for(const [i,t] of textures.entries())if(typeof t.source!=='string'||!t.source.startsWith('data:image/png;base64,'))add('warning','TEXTURE_EXTERNAL',`textures.${i}`,'Embed a PNG texture for a portable .bbmodel');
  for(const [i,t] of textures.entries())if(t.wrap_mode&&t.wrap_mode!=='limited')add('warning','TEXTURE_WRAP',`textures.${i}`,'Texture repeat/clamp preview is not a guarantee of Minecraft atlas behavior');
  const animationNames=new Set<string>();
  for(const [i,a] of animations.entries()) {
    if(!object(a)){add('error','ANIMATION_INVALID',`animations.${i}`,'Expected animation object');continue;}
    if(target!=='bettermodel'&&typeof a.override!=='boolean')add('error','ANIMATION_OVERRIDE',`animations.${i}.override`,'ModelEngine requires an explicit boolean animation.override (true or false); missing/null values can fail parsing in R4.1.1.');
    if(animationNames.has(a.name))add('error','ANIMATION_DUPLICATE',`animations.${i}`,`Duplicate animation: ${a.name}`);
    animationNames.add(a.name);
    if(!(typeof a.length==='number'&&Number.isFinite(a.length)&&a.length>0))add('warning','ANIMATION_LENGTH',a.name||String(i),'Set an explicit positive animation duration');
    if(['idle','walk','idle_fly','walk_fly','jump'].includes(a.name)&&a.loop!=='loop')add('warning','ANIMATION_LOOP',a.name,'This default state normally loops');
    if(target!=='bettermodel'&&a.name==='death'&&a.loop!=='hold')add('warning','DEATH_HOLD',a.name,'ModelEngine death normally holds the final frame');
    let count=0;
    for(const [id,animator] of Object.entries(a.animators||{}) as [string,Obj][]) {
      if(id==='effects'||animator.type==='effect'){
        if(animator.keyframes?.length)add('warning','EFFECTS_PORTABILITY',a.name,'Timeline effects/scripts require engine-specific integration');
        for(const k of animator.keyframes||[])if(typeof k.time!=='number'||!Number.isFinite(k.time)||k.time<0||k.time>a.length)add('error','KEYFRAME_TIME',a.name,'Effect keyframe time is outside animation duration');
        continue;
      }
      const bone=groups.get(id)||elementMap.get(id);
      if(!bone)add('error','ANIMATOR_BONE',`${a.name}.${id}`,'Animation references a missing bone');
      if(target!=='bettermodel'&&bone?.name==='hitbox'&&animator.keyframes?.length)add('error','ANIMATED_HITBOX',a.name,'ModelEngine removes hitbox; animate a visual bone instead');
      for(const k of animator.keyframes||[]) {
        count++;
        if(typeof k.time!=='number'||!Number.isFinite(k.time)||k.time<0||k.time>a.length)add('error','KEYFRAME_TIME',a.name,'Keyframe time is invalid or outside the duration');
        if(target!=='bettermodel'&&k.interpolation==='bezier')add('warning','BEZIER_FALLBACK',a.name,'ModelEngine currently falls back from Bezier to linear interpolation');
      }
    }
    if(!count)add('warning','ANIMATION_EMPTY',a.name,'Animation slot has no bone keyframes yet');
  }
  for(const state of ['idle','walk'])if(!animationNames.has(state))add('warning','STATE_MISSING',state,`No ${state} animation; add it or configure the engine state mapping`);
  for(const [id,g] of groups)if((g.name==='hitbox'||parseBehavior(g.name||'')?.behavior==='aabb')&&target!=='bettermodel') {
    if(g.name==='hitbox'&&(!vector(g.origin)||g.origin[1]<=0))add('warning','EYE_HEIGHT_NONPOSITIVE',id,'The primary hitbox pivot Y sets ModelEngine eye height; use a positive value above the ground to avoid suffocation.');
    const cubes=elements.filter(e=>parents.get(e.uuid)===id&&(e.type||'cube')==='cube');
    if(cubes.length!==1)add('warning','HITBOX_COUNT',id,'Use one defining cube in the primary hitbox bone');
    for(const c of cubes)if(vector(c.from)&&vector(c.to)) {
      const size=c.to.map((v:number,i:number)=>v-c.from[i]);
      if(size.some((v:number)=>v<=0||v>1024))add('error','HITBOX_SIZE',id,'Hitbox dimensions must be positive and at most 1024 pixels');
      if(Math.abs(size[0]-size[2])>1e-6)add('warning','HITBOX_SQUARE',id,'ModelEngine uses a square horizontal hitbox; make X and Z equal');
    }
  }
  return {target,ok:!findings.some(f=>f.severity==='error'),validation:'static-authoring-only',
    runtimeVerified:false,counts:{bones:groups.size,elements:elements.length,textures:textures.length,animations:animations.length},findings,sources:ENGINE_SOURCES};
}
