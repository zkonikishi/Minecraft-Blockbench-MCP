import { z } from 'zod';
import { zodTool, type ToolDefinition } from './registry.js';
import { auditModel, ENGINE_PROFILES, ENGINE_SOURCES, type EngineTarget } from './engine-audit.js';
import { createProject, applyGeometryBatch, upsertAnimation } from './vendor-runtime.mjs';
import { behaviorSchema, limbSchema, behaviorName, behaviorGeometryIssue, parseBehavior, MODELENGINE_CAPABILITIES, type Behavior } from './modelengine.js';
const targetSchema=z.enum(['bettermodel','modelengine','both']).default('both');
const idSchema=z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const G=()=>globalThis as any;
export function compileProject():Record<string,any> {
  if(!G().Project)throw new Error('No project is open');
  const codec=G().Codecs?.project;
  if(!codec?.compile)throw new Error('Blockbench project codec unavailable');
  const raw=codec.compile({raw:true,bitmaps:true,absolute_paths:false});
  const model=typeof raw==='string'?JSON.parse(raw):raw;
  if(!model||typeof model!=='object'||Array.isArray(model))throw new Error('Project codec returned an invalid model');
  return model;
}
export function scaffoldPlan(archetype:'biped'|'quadruped'|'dragon',scale=1,hitbox=true) {
  const groups:any[]=[];const cubes:any[]=[];
  const v=(a:number[])=>a.map(n=>n*scale);
  const bone=(name:string,origin:number[],parent='body_root')=>groups.push({name,origin:v(origin),...(name==='body_root'?{}:{parent})});
  const cube=(name:string,from:number[],to:number[],parent:string)=>cubes.push({name,from:v(from),to:v(to),parent});
  bone('body_root',[0,12,0]);bone('body',[0,12,0]);
  if(archetype==='biped') {
    cube('torso',[-4,12,-2],[4,24,2],'body');bone('head',[0,24,0],'body');cube('skull',[-4,24,-4],[4,32,4],'head');
    for(const [side,s] of [['left',1],['right',-1]] as const) {
      const x=s*6;bone(`${side}_arm`,[x,23,0],'body');cube(`${side}_upper_arm`,[x-2,12,-2],[x+2,24,2],`${side}_arm`);
      const lx=s*2;bone(`${side}_leg`,[lx,12,0]);cube(`${side}_lower_leg`,[lx-2,0,-2],[lx+2,12,2],`${side}_leg`);
    }
  }else {
    cube('torso',[-5,8,-8],[5,18,8],'body');bone('neck',[0,16,-7],'body');bone('head',[0,18,-10],'neck');
    cube('skull',[-4,15,-17],[4,23,-9],'head');bone('jaw',[0,16,-10],'head');cube('lower_jaw',[-3,13,-17],[3,15,-10],'jaw');
    for(const [side,x] of [['left',4],['right',-4]] as const)for(const [part,z] of [['front',-6],['back',6]] as const){
      const n=`${side}_${part}_leg`;bone(n,[x,11,z],'body');cube(`${n}_shape`,[x-2,0,z-2],[x+2,11,z+2],n);
    }
    bone('tail_1',[0,13,7],'body');cube('tail_base',[-2,11,7],[2,15,15],'tail_1');
    bone('tail_2',[0,13,15],'tail_1');cube('tail_tip',[-1,12,15],[1,14,23],'tail_2');
    if(archetype==='dragon')for(const [side,s] of [['left',1],['right',-1]] as const){
      bone(`${side}_wing`,[s*4,16,-2],'body');bone(`${side}_wing_tip`,[s*18,16,0],`${side}_wing`);
      cube(`${side}_wing_inner`,[Math.min(s*4,s*18),15,-3],[Math.max(s*4,s*18),16,8],`${side}_wing`);
      cube(`${side}_wing_outer`,[Math.min(s*18,s*30),15,-1],[Math.max(s*18,s*30),16,6],`${side}_wing_tip`);
    }
  }
  if(hitbox){groups.push({name:'hitbox',origin:v([0,archetype==='biped'?28:20,0])});cube('hitbox_shape',[-6,0,-6],[6,archetype==='biped'?32:23,6],'hitbox');}
  return {create_groups:groups,create_cubes:cubes,undo_label:`Minecraft ${archetype} scaffold`};
}
export function creatureTools():ToolDefinition[] {
  return [
    zodTool('mc_modelengine_features','Inspect implemented ModelEngine features versus reference-only and unverified Dev capabilities.',z.object({}).strict(),()=>MODELENGINE_CAPABILITIES,{annotations:{readOnlyHint:true}}),
    zodTool('mc_engine_profile','BetterModel / ModelEngine feature profiles, differences and authoritative references.',z.object({target:targetSchema}).strict(),({target})=>target==='both'?ENGINE_PROFILES:ENGINE_PROFILES[target as keyof typeof ENGINE_PROFILES]),
    zodTool('mc_get_workflow','Start here: workflow for a complex Minecraft creature using all three integrated tool families.',z.object({}).strict(),()=>({
      sequence:['mc_create_project','mc_scaffold_creature (optional blockout)','craft_apply_geometry_batch / studio_* refinement','craft_ensure_texture','craft_pack_box_uv','craft_get_uv_layout','craft_paint_face_grid / anim_texture tools','mc_create_animation_set (empty slots)','anim_add_keyframes / craft_upsert_animation / studio animation tools','craft_capture_views','mc_audit_model','mc_export_bbmodel'],
      rules:['Use Generic/free and north (-Z) facing cubes for the shared engine baseline.','Animate bones, not individual cubes or the primary hitbox.','Keep a separate engine variant for custom tags, effects and advanced interpolation.','Use UUIDs returned by tools; imported names may be renamed for uniqueness.','Default slots are placeholders; add and preview actual keyframes.','Exports are editable .bbmodel files with embedded textures; game AI and combat skills remain server-side.'],sources:ENGINE_SOURCES})),
    zodTool('mc_create_project','Create a new Generic .bbmodel tab for BetterModel and/or ModelEngine; preserves existing tabs.',z.object({name:idSchema,target:targetSchema,texture_size:z.number().int().min(16).max(2048).default(128)}).strict(),({name,target,texture_size})=>{
      const result=createProject({format:'free',name,uv_mode:'face',texture_width:texture_size,texture_height:texture_size});
      G().Project.model_identifier=name;
      return {result,target,format:'free',next:'mc_scaffold_creature'};
    },{projectChange:true}),
    zodTool('mc_scaffold_creature','Build an editable biped, quadruped or winged dragon blockout; no finished artwork or animation is implied.',z.object({archetype:z.enum(['biped','quadruped','dragon']),scale:z.number().positive().max(16).default(1),hitbox:z.boolean().default(true)}).strict(),({archetype,scale,hitbox})=>{
      if(G().Format?.id!=='free')throw new Error('Create a Generic/free project first');
      const plan=scaffoldPlan(archetype as any,scale as number,hitbox as boolean);
      const existing=new Set((G().Group?.all||[]).map((g:any)=>g.name));
      for(const group of plan.create_groups)if(existing.has(group.name))throw new Error(`Bone already exists: ${group.name}; use a new tab or edit the existing scaffold.`);
      return {result:applyGeometryBatch(plan),stage:'blockout',needs:['proportions and detail','UV packing','texture painting','keyframes','in-game acceptance']};
    }),
    zodTool('mc_create_animation_set','Create missing default animation slots, preserving existing clips. Slots are empty until you author keyframes.',z.object({target:targetSchema,include_combat:z.boolean().default(true)}).strict(),({target,include_combat})=>{
      if(!G().Project||!G().Animation?.all)throw new Error('Open an animation-capable project');
      const common=['idle','walk','spawn','death'];
      const names=target==='bettermodel'?[...common,'idle_fly','walk_fly','jump']:target==='modelengine'?[...common,'jump_start','jump','jump_end']:common;
      if(include_combat)names.push('attack','hurt');
      const created:string[]=[];const preserved:string[]=[];
      for(const name of names){
        if(G().Animation.all.some((a:any)=>a.name===name)){preserved.push(name);continue;}
        const loop=['idle','walk','idle_fly','walk_fly','jump'].includes(name)?'loop':name==='death'?'hold':'once';
        upsertAnimation({name,length:1,loop,bones:{}});created.push(name);
        const a=G().Animation.all.find((a:any)=>a.name===name);
        if(a&&['spawn','death','attack','jump','jump_start','jump_end'].includes(name)){
          G().Undo.initEdit({animations:[a]});a.override=true;G().Undo.finishEdit(`Minecraft ${name} override`);
        }
      }
      return {created,preserved,emptySlots:true,next:'Author bone keyframes with anim_add_keyframes or craft_upsert_animation. Combat clips need server triggers.'};
    }),
    zodTool('mc_set_bone_behavior','Set a Wiki-documented bone tag, including segment/tail, attachments and player limbs. Preserves UUID and checks geometry; no server-side execution.',z.object({target:z.enum(['bettermodel','modelengine']),bone:z.string().min(1),behavior:behaviorSchema,name:idSchema.optional(),limb_type:limbSchema.optional()}).strict(),({target,bone,behavior,name,limb_type})=>{
      const matches=(G().Group?.all||[]).filter((g:any)=>g.uuid===bone||g.name===bone);
      if(matches.length!==1)throw new Error('Bone must resolve uniquely; use its UUID');
      const group=matches[0];
      const next=behaviorName(target as any,group.name,behavior as Behavior,name as string|undefined,limb_type as any);
      if(G().Group.all.some((g:any)=>g!==group&&g.name===next))throw new Error(`Bone name already exists: ${next}`);
      if(target==='modelengine'){
        const id=parseBehavior(next)?.id??next;
        if(G().Group.all.some((g:any)=>g!==group&&(parseBehavior(g.name)?.id??g.name)===id))throw new Error(`ModelEngine bone ID collision after removing tags: ${id}`);
      }
      const issue=behaviorGeometryIssue(behavior as Behavior,(group.children||[]).filter((c:any)=>!G().Group.all.includes(c)).length,group.children?.length||0);
      if(issue)throw new Error(issue);
      if(next===group.name)return {uuid:group.uuid,name:next,changed:false,target,serverSetupRequired:true};
      G().Undo.initEdit({outliner:true});group.name=next;G().Undo.finishEdit('Minecraft bone behavior');
      return {uuid:group.uuid,name:next,target,serverSetupRequired:true,sources:ENGINE_SOURCES};
    }),
    zodTool('mc_audit_model','Read-only static compatibility audit of the current project or supplied .bbmodel JSON; not runtime certification.',z.object({target:targetSchema,model:z.record(z.unknown()).optional(),bone_budget:z.number().int().positive().max(1024).default(64)}).strict(),({target,model,bone_budget})=>auditModel(model??compileProject(),target as EngineTarget,bone_budget as number),{annotations:{readOnlyHint:true}}),
    zodTool('mc_export_bbmodel','Compile the real project with embedded textures; audit before returning .bbmodel JSON or downloading it in Web/desktop.',z.object({target:targetSchema,name:idSchema.optional(),download:z.boolean().default(false),allow_errors:z.boolean().default(false)}).strict(),({target,name,download,allow_errors})=>{
      const model=compileProject();const report=auditModel(model,target as EngineTarget);
      if(!report.ok&&!allow_errors)throw new Error(JSON.stringify({message:'Fix audit errors before export, or explicitly set allow_errors for a diagnostic export.',report}));
      const filename=`${name||String(model.name||'creature').replace(/[^a-z0-9_]/gi,'_')}.bbmodel`;
      const data=JSON.stringify(model,null,2);
      if(download){
        if(typeof document==='undefined')throw new Error('Browser download API unavailable');
        const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
        return {filename,downloadRequested:true,report};
      }
      return {filename,model,report};
    }),
  ];
}
