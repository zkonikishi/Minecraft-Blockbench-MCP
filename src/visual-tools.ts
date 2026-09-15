import {z} from 'zod';
import {zodTool,normalizeResult,type ToolDefinition,type ToolResult} from './registry.js';
import {visualDetailTool} from './visual-detail.js';

const views=z.array(z.enum(['iso','north','south','east','west','up','down'])).min(1).max(7).default(['iso','north','east']);
const captureSchema=z.object({views,max_edge:z.number().int().min(64).max(1024).default(512),render:z.enum(['current','textured','solid','wireframe']).default('current')}).strict();
const G=()=>globalThis as any;
// Invoke validated dependencies inside the registry's existing lane, never recursively queue.
export function visualTools(definitions:Map<string,ToolDefinition>) {
  const baselines=new Map<string,{project:unknown,args:any,result:ToolResult}>();
  async function invoke(name:string,args:Record<string,unknown>={}) {
    const tool=definitions.get(name);if(!tool)throw Error(`Required visual backend unavailable: ${name}`);
    const result=normalizeResult(await tool.execute(tool.validate?tool.validate(args):args));
    if(result.isError)throw Error(result.content.filter(c=>c.type==='text').map(c=>(c as any).text).join('\n'));
    return result;
  }
  async function capture(args:any) {
    const project=G().Project;if(!project)throw Error('Open a project first');
    const previous=project.view_mode;
    try {
      if(args.render!=='current'){if(!G().Canvas?.updateViewMode)throw Error('Render mode API unavailable');project.view_mode=args.render;G().Canvas.updateViewMode();}
      const result=await invoke('craft_capture_views',{views:args.views,max_edge:args.max_edge,format:'png'});
      if(project!==G().Project)throw Error('Project changed during capture');
      if(result.content.filter(c=>c.type==='image').length!==args.views.length)throw Error('Incomplete visual capture');
      return result;
    } finally {if(project===G().Project&&args.render!=='current'){project.view_mode=previous;G().Canvas.updateViewMode();}}
  }
  const metadata=(value:unknown)=>({type:'text' as const,text:JSON.stringify(value)});
  return [
    visualDetailTool(),
    zodTool('mc_visual_capabilities','Discover shared visual evidence tools for every model format and engine. Images are evidence, not an automatic visual or game-runtime verdict.',z.object({}).strict(),()=>({
      tools:['mc_visual_capture','mc_visual_detail','mc_visual_texture','mc_visual_animation','mc_visual_compare'],engines:'format-independent',
      views:['iso','north','south','east','west','up','down'],renderModes:['current','textured','solid','wireframe'],
      limitations:['No automatic clipping or similarity verdict','No game runtime verification','Model views auto-fit cube bounds; mesh-only framing is not guaranteed','Comparison uses matching directions, not a locked camera when geometry bounds change'],visualVerified:false,clientVerified:false
    })),
    zodTool('mc_visual_capture','Capture inline PNG model views in current, textured, solid or wireframe mode. Restores render mode; does not change geometry. All engines share this tool.',captureSchema,capture),
    zodTool('mc_visual_texture','Return a texture image or UV overlay image with labels. Works for any project with textures.',z.object({kind:z.enum(['texture','uv']),texture:z.string().min(1).max(256),max_edge:z.number().int().min(64).max(1024).default(512)}).strict(),async a=>{
      const result=await invoke(a.kind==='uv'?'craft_get_uv_map':'anim_get_texture',a.kind==='uv'?{texture:a.texture,max_edge:a.max_edge,labels:true}:{texture:a.texture});
      if(!result.content.some(c=>c.type==='image'))throw Error('Texture backend returned no image');return result;
    }),
    zodTool('mc_visual_animation','Sample exact animation times and return labelled PNG views. Restores selected animation, timeline and mode when the project is unchanged. Does not verify effect or game playback.',z.object({animation:z.string().min(1).max(256),times:z.array(z.number().nonnegative()).min(1).max(8),views,max_edge:z.number().int().min(64).max(512).default(256)}).strict(),async a=>{
      const g=G(),project=g.Project;if(!project)throw Error('Open a project first');
      if(g.Timeline?.playing)throw Error('Pause playback before visual sampling');
      const matches=(g.Animation?.all||[]).filter((v:any)=>v.uuid===a.animation||v.name===a.animation);
      if(matches.length!==1)throw Error('Animation missing or ambiguous');
      if((a.times as number[]).some(t=>t>matches[0].length))throw Error('Sample exceeds animation duration');
      const previous={mode:g.Modes?.selected?.id||g.Modes?.id,animation:g.Animation.selected,time:g.Timeline.time};
      const content:ToolResult['content']=[];
      try{for(const time of a.times as number[]){
        if(project!==g.Project)throw Error('Project changed during sampling');
        await invoke('mc_preview_animation',{animation:matches[0].uuid,time});
        const result=await capture({...a,render:'current'});
        content.push(metadata({animation:a.animation,time,views:a.views,visualVerified:false,clientVerified:false}),...result.content);
      }return {content};}
      finally{if(project===g.Project){previous.animation?.select();g.Timeline.setTime(previous.time);if(previous.mode)g.Modes.options[previous.mode]?.select();if(previous.mode==='animate'){g.Animator.preview();g.TextureAnimator?.playAnimationFrame(previous.time);}}}
    }),
    zodTool('mc_visual_compare','Save or compare bounded in-memory model snapshots using the same view settings. Returns before/after images, NOT an automatic quality verdict. Baselines are project-scoped, max 4 and 16 MiB each; clear explicitly or reload the plugin.',z.object({operation:z.enum(['save','compare','clear']),key:z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),capture:captureSchema.optional()}).strict(),async a=>{
      const key=a.key as string;
      if(a.operation==='clear'){baselines.delete(key);return {cleared:key};}
      if(a.operation==='save'){
        if(baselines.has(key))throw Error('Baseline already exists; clear explicitly first');
        if(baselines.size>=4)throw Error('Clear an existing baseline first');
        const args=captureSchema.parse(a.capture||{}),result=await capture(args);
        if(JSON.stringify(result).length>16*1024*1024)throw Error('Baseline exceeds 16 MiB');
        baselines.set(key,{project:G().Project,args,result});return {content:[metadata({saved:key,visualVerified:false}),...result.content]};
      }
      if(a.capture)throw Error('Compare reuses saved capture settings; omit capture');
      const before=baselines.get(key);if(!before||before.project!==G().Project)throw Error('No baseline for this project');
      const after=await capture(before.args);
      return {content:[metadata({phase:'before',key,visualVerified:false,clientVerified:false,framing:'auto-fit; bounds changes may alter framing'}),...before.result.content,metadata({phase:'after',key}),...after.content]};
    }),
  ];
}
