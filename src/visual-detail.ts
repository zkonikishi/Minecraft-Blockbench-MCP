import {posedCubeCorners} from './posed-bounds.js';
import {z} from 'zod';
import {zodTool} from './registry.js';
const vector=z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]);
export const frameSchema=z.object({center:vector,span:z.number().positive().max(1e7)}).strict();
export function visualFrame(elements:any[],focus:string[]=[]){
  const all=[...(globalThis as any).Group?.all||[],...elements];
  const selected=focus.map(id=>{const matches=all.filter(n=>n.uuid===id||n.name===id);if(matches.length!==1)throw Error(`Missing or ambiguous focus node: ${id}`);return matches[0];});
  const included=(n:any)=>{if(!selected.length)return true;for(let p=n;p&&typeof p==='object';p=p.parent)if(selected.includes(p))return true;return false;};
  const points=elements.filter(n=>included(n)&&n.visibility!==false&&n.mesh?.geometry?.attributes?.position).flatMap(posedCubeCorners);
  if(!points.length)throw Error('No visible geometry available for framing');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of points)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
  const center=min.map((v,i)=>(v+max[i])/2);
  const radius=points.reduce((r,p)=>Math.max(r,Math.hypot(...p.map((v,i)=>v-center[i]))),1);
  return {center,span:radius*2.3};
}
export function visualDetailTool(){return zodTool('mc_visual_detail','Native offscreen close-up or skeleton overlay. Accepts focus node names/UUIDs, or an explicit reusable center/span frame for fixed-camera before/after captures. Returns frame and PNG images; no geometry edits.',z.object({
  focus:z.array(z.string().min(1).max(256)).max(64).default([]),
  frame:frameSchema.optional(),bones:z.boolean().default(false),
  views:z.array(z.enum(['iso','north','south','east','west','up','down'])).min(1).max(7).default(['iso']),
  max_edge:z.number().int().min(64).max(1024).default(512)
}).strict(),async a=>{
  const g=globalThis as any,project=g.Project,preview=g.Screencam?.NoAAPreview;
  if(!project||!preview||!g.Screencam?.screenshotPreview)throw Error('Native offscreen preview unavailable');
  if(a.frame&&(a.focus as string[]).length)throw Error('Choose focus or an explicit frame, not both');
  const frame=a.frame as any||visualFrame(g.Outliner?.elements||[],a.focus as string[]),size=a.max_edge as number;
  const directions:Record<string,number[]>={iso:[1,.8,1],north:[0,0,-1],south:[0,0,1],east:[1,0,0],west:[-1,0,0],up:[0,1,.0001],down:[0,-1,.0001]};
  const content:any[]=[{type:'text',text:JSON.stringify({frame,views:a.views,bones:a.bones,visualVerified:false,clientVerified:false})}];
  for(const view of a.views as string[]){
    if(g.Project!==project)throw Error('Project changed during detail capture');
    const dir=directions[view],length=Math.hypot(...dir),distance=frame.span*2+64;
    preview.resize(size,size);preview.loadAnglePreset({projection:'orthographic',position:frame.center.map((v:number,i:number)=>v+dir[i]/length*distance),target:frame.center});
    const camera=preview.camOrtho;if(!camera)throw Error('Orthographic camera unavailable');
    camera.zoom=Math.min(camera.right-camera.left,camera.top-camera.bottom)/frame.span;camera.near=.01;camera.far=Math.max(1000,frame.span*10+128);camera.updateProjectionMatrix();preview.render?.();
    const url=await new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Detail screenshot timeout; do not retry automatically')),20000);try{g.Screencam.screenshotPreview(preview,{width:size,height:size,crop:false},(url:string)=>{clearTimeout(timer);resolve(url);});}catch(e){clearTimeout(timer);reject(e);}});
    if(g.Project!==project)throw Error('Project changed during detail capture');
    let output=url;
    if(a.bones){
      const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas overlay unavailable');
      const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Invalid screenshot'));image.src=url;});ctx.drawImage(image,0,0,size,size);
      const projectPoint=(node:any)=>{const mesh=node?.mesh||node?.scene_object;if(!mesh)return null;mesh.updateWorldMatrix(true,false);const p=mesh.getWorldPosition(new g.THREE.Vector3()).project(camera);return [(p.x+1)*size/2,(1-p.y)*size/2];};
      ctx.strokeStyle='#00ffff';ctx.fillStyle='#ffcc00';ctx.lineWidth=2;
      for(const bone of (g.Group?.all||[])){const p=projectPoint(bone);if(!p)continue;const parent=projectPoint(bone.parent);if(parent){ctx.beginPath();ctx.moveTo(parent[0],parent[1]);ctx.lineTo(p[0],p[1]);ctx.stroke();}ctx.beginPath();ctx.arc(p[0],p[1],3,0,Math.PI*2);ctx.fill();}
      output=canvas.toDataURL('image/png');
    }
    if(!output.startsWith('data:image/png;base64,'))throw Error('Expected PNG capture');
    content.push({type:'image',mimeType:'image/png',data:output.slice('data:image/png;base64,'.length)});
  }
  return {content};
});}
