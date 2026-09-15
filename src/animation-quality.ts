import {z} from 'zod';
import {zodTool} from './registry.js';
const channels=['rotation','position','scale'];
function values(k:any):number[]|null {
  if(k.data_points?.length!==1)return null;
  const p=k.data_points[0],v=['x','y','z'].map(axis=>p[axis]);
  if(v.some(x=>typeof x!=='number'&&(typeof x!=='string'||!x.trim()||!Number.isFinite(Number(x)))))return null;
  const result=v.map(Number);return result.every(Number.isFinite)?result:null;
}
const distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function diagnoseAnimation(clip:any,{rotationJump=120,speedRatio=4,seamTolerance=.01}={}) {
  const findings:any[]=[],signatures=new Map<string,string[]>();let inspected=0,skipped=0;
  for(const [bone,animator] of Object.entries(clip.animators||{}) as [string,any][]){
    const keys=animator.keyframes||[];
    if(!keys.length)findings.push({code:'EMPTY_TRACK',bone});
    for(const channel of channels){
      const track=keys.filter((k:any)=>k.channel===channel).sort((a:any,b:any)=>a.time-b.time);if(!track.length)continue;
      inspected++;
      if(track.some((k:any)=>!values(k)||!Number.isFinite(k.time))){skipped++;findings.push({code:'UNEVALUATED_TRACK',bone,channel,reason:'Expressions, pre/post values or invalid times require native sampling'});continue;}
      const signature=JSON.stringify(track.map((k:any)=>[k.time,values(k),k.interpolation]));
      const id=`${channel}:${signature}`;signatures.set(id,[...(signatures.get(id)||[]),bone]);
      let previousSpeed:number|undefined;
      for(let i=1;i<track.length;i++){
        const dt=track[i].time-track[i-1].time,delta=distance(values(track[i])!,values(track[i-1])!);
        if(dt<=0){findings.push({code:'DUPLICATE_TIME',bone,channel,time:track[i].time});continue;}
        const speed=delta/dt;
        if(channel==='rotation'&&delta>rotationJump)findings.push({code:'ROTATION_JUMP',bone,channel,time:track[i].time,degrees:delta});
        if(previousSpeed!==undefined&&Math.max(speed,previousSpeed)>1e-6&&Math.max(speed,previousSpeed)/Math.max(Math.min(speed,previousSpeed),1e-6)>speedRatio)findings.push({code:'SPEED_CHANGE',bone,channel,time:track[i-1].time,speeds:[previousSpeed,speed]});
        previousSpeed=speed;
      }
      if(clip.loop==='loop'){
        const first=track[0],last=track.at(-1);
        if(Math.abs(first.time)>1e-6||Math.abs(last.time-clip.length)>1e-6)findings.push({code:'LOOP_ENDPOINTS_MISSING',bone,channel});
        else if(distance(values(first)!,values(last)!)>seamTolerance)findings.push({code:'LOOP_SEAM',bone,channel,delta:distance(values(first)!,values(last)!)});
      }
    }
  }
  for(const bones of signatures.values())if(bones.length>1)findings.push({code:'IDENTICAL_TRACKS',bones});
  return {animation:clip.name,length:clip.length,inspected,skipped,findings,method:'Keyframe secants, not interpolated/world-space velocities. Intentional turns/holds may be flagged.',visualVerified:false,clientVerified:false};
}
// Deliberately narrow: no silent baking of Molang, Bezier, pre/post or effects.
export function chainVariant(clip:any,options:any){
  const {source,chains,delay,gain,fps,name}=options;
  if(!(clip.length>0)||clip.length>60)throw Error('Clip duration must be 0..60 seconds');
  const original=clip.animators?.[source];if(!original)throw Error('Source track missing');
  const keys=(original.keyframes||[]).filter((k:any)=>k.channel==='rotation');
  if(!keys.length||keys.some((k:any)=>!values(k)||!['linear',undefined].includes(k.interpolation)))throw Error('Chain source requires numeric linear rotation keys with one data point');
  keys.sort((a:any,b:any)=>a.time-b.time);
  if(keys.some((k:any,i:number)=>k.time<0||k.time>clip.length||(i&&k.time<=keys[i-1].time)))throw Error('Invalid or duplicate source times');
  if(clip.loop==='loop'&&(keys[0].time!==0||keys.at(-1).time!==clip.length||distance(values(keys[0])!,values(keys.at(-1))!)>1e-6))throw Error('Loop requires matching explicit start/end rotation keys');
  const count=Math.ceil(clip.length*fps);
  if((count+1)*chains.reduce((n:number,c:any)=>n+c.bones.length,0)>20000)throw Error('Chain plan exceeds 20000 keys');
  const sample=(time:number)=>{
    const t=clip.loop==='loop'?((time%clip.length)+clip.length)%clip.length:Math.max(0,Math.min(clip.length,time));
    let i=keys.findIndex((k:any)=>k.time>=t);if(i<0)return values(keys.at(-1))!;if(i===0)return values(keys[0])!;
    const a=keys[i-1],b=keys[i],f=(t-a.time)/(b.time-a.time),v=values(a)!;return v.map((x,j)=>x+(values(b)![j]-x)*f);
  };
  const out=structuredClone(clip);out.name=name;delete out.uuid;out.selected=false;
  for(const chain of chains)for(const [index,bone] of chain.bones.entries()){
    const animator=out.animators[bone]||{type:'bone',name:bone,keyframes:[]};
    animator.keyframes=(animator.keyframes||[]).filter((k:any)=>k.channel!=='rotation');
    for(let i=0;i<=count;i++){
      const time=i*clip.length/count,v=sample((clip.loop==='loop'&&i===count?0:time)-chain.offset-index*delay).map(x=>x*Math.pow(gain,index)*chain.amplitude);
      animator.keyframes.push({channel:'rotation',time,interpolation:'linear',data_points:[{x:v[0],y:v[1],z:v[2]}]});
    }out.animators[bone]=animator;
  }
  // Fresh key identities, while animator map keys remain bound to the original bones.
  for(const animator of Object.values(out.animators) as any[])for(const key of animator.keyframes||[])delete key.uuid;
  return out;
}
export function animationQualityTools(){
  const g=()=>globalThis as any,id=z.string().min(1).max(128);
  const clip=(id:unknown)=>{const found=(g().Animation?.all||[]).filter((a:any)=>a.uuid===id||a.name===id);if(found.length!==1)throw Error('Animation missing or ambiguous');return found[0];};
  return [
    zodTool('mc_animation_diagnose','Read-only numeric keyframe diagnostics: jumps, secant-speed changes, loop seams, empty and identical tracks. Expressions are reported unevaluated; findings are heuristics, not a visual verdict.',z.object({animation:id,rotationJump:z.number().positive().default(120),speedRatio:z.number().min(1).default(4),seamTolerance:z.number().nonnegative().default(.01)}).strict(),a=>diagnoseAnimation(clip(a.animation).getUndoCopy(),a as any),{annotations:{readOnlyHint:true}}),
    zodTool('mc_animation_chain','Create a NEW animation variant with numeric linear rotation follow-through on explicit parent-child chains. Per-chain offsets/amplitudes support multiple heads. Original remains untouched; dry_run defaults true. This copies motion, not anatomy-aware automatic animation.',z.object({animation:id,name:z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),source:id,
      chains:z.array(z.object({bones:z.array(id).min(1).max(32),offset:z.number().min(0).max(60).default(0),amplitude:z.number().min(0).max(4).default(1)}).strict()).min(1).max(9),
      delay:z.number().min(0).max(2).default(.06),gain:z.number().min(.1).max(1.5).default(.9),fps:z.number().int().min(4).max(60).default(24),dry_run:z.boolean().default(true)
    }).strict(),a=>{
      if(!g().Project)throw Error('Open a project first');const original=clip(a.animation);
      if(g().Animation.all.some((c:any)=>c.name===a.name))throw Error('Destination animation name exists');
      const find=(id:string)=>{const list=(g().Group?.all||[]).filter((n:any)=>n.uuid===id||n.name===id);if(list.length!==1)throw Error(`Bone missing or ambiguous: ${id}`);return list[0];};
      const used=new Set(),chains=(a.chains as any[]).map(c=>{const bones=c.bones.map(find);for(let i=0;i<bones.length;i++){if(used.has(bones[i].uuid))throw Error('Duplicate destination bone');used.add(bones[i].uuid);if(i&&bones[i].parent!==bones[i-1])throw Error('Chain must be ordered direct parent to child');}return {...c,bones:bones.map((b:any)=>b.uuid)};});
      const variant=chainVariant(original.getUndoCopy(),{...a,source:find(a.source as string).uuid,chains});
      const report={name:a.name,bones:used.size,keys:Object.values(variant.animators).reduce((n:number,b:any)=>n+(b.keyframes?.length||0),0),originalPreserved:true,diagnostics:diagnoseAnimation(variant),dry_run:a.dry_run};
      if(a.dry_run)return report;
      g().Undo.initEdit({animations:[]});try{const created=new (g().Animation)(variant).add(false);g().Undo.finishEdit('Create chain animation variant',{animations:[created]});return {...report,uuid:created.uuid};}catch(e){g().Undo.cancelEdit();throw e;}
    })
  ];
}
