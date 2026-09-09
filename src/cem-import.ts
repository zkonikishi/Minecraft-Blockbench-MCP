import {z} from 'zod';
import {zodTool} from './registry.js';

export function cemImportTool(){return zodTool('mc_import_cem',
 'Import supplied OptiFine JEM JSON through the native codec into a NEW project, retaining old tabs. All texture references are removed; external JPM references and unsupported singular submodel/sprites are rejected. Geometry/UV import only; CEM expressions are not converted into keyframe animations. Export the result with mc_export_bbmodel.',
 z.object({model:z.record(z.unknown()),name:z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional()}).strict(),
 ({model,name})=>{
  const g=globalThis as any, json=JSON.stringify(model);
  if(json.length>16*1024*1024)throw Error('CEM JSON exceeds 16 MiB character limit');
  let removedTextures=0;
  const copy=JSON.parse(json,(key,value)=>{
   if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe JSON property');
   if(key==='texture'){removedTextures++;return undefined;}
   if(key==='model'&&value)throw Error('External JPM model references are unsupported; inline geometry first');
   if(['submodel','sprites','baseId','_is_jpm'].includes(key))throw Error(`Unsupported CEM property: ${key}`);
   return value;
  });
  const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
  const vector=(v:any,n:number,label:string)=>{if(!Array.isArray(v)||v.length!==n||!v.every((x:any)=>typeof x==='number'&&Number.isFinite(x)))throw Error(`Invalid ${label}`);};
  if(!Array.isArray(copy.models)||!copy.models.length)throw Error('Expected nonempty JEM models array');
  let nodes=0,boxes=0;
  function validate(part:any,depth:number){
   if(depth>64||++nodes>10000)throw Error('CEM hierarchy limit exceeded');
   if(!object(part))throw Error('Expected CEM part object');
   if(depth===0&&(typeof part.part!=='string'||!part.part))throw Error('Root CEM part name required');
   for(const k of ['translate','rotate'])if(part[k]!==undefined)vector(part[k],3,k);
   if(part.mirrorTexture!==undefined&&typeof part.mirrorTexture!=='string')throw Error('Invalid mirrorTexture');
   if(part.textureSize!==undefined){vector(part.textureSize,2,'textureSize');if(!part.textureSize.every((v:number)=>Number.isInteger(v)&&v>0&&v<=16384))throw Error('Invalid texture dimensions');}
   if(part.boxes!==undefined){
    if(!Array.isArray(part.boxes))throw Error('Expected boxes array');
    for(const box of part.boxes){
     if(!object(box)||++boxes>100000)throw Error('Invalid box or box limit exceeded');
     vector(box.coordinates,6,'box coordinates');
     if(box.coordinates.slice(3).some((v:number)=>v<0))throw Error('Negative box dimensions');
     if(box.textureOffset!==undefined)vector(box.textureOffset,2,'textureOffset');
     for(const f of ['North','South','East','West','Up','Down'])if(box[`uv${f}`]!==undefined)vector(box[`uv${f}`],4,`uv${f}`);
     if(box.sizeAdd!==undefined&&(typeof box.sizeAdd!=='number'||!Number.isFinite(box.sizeAdd)))throw Error('Invalid sizeAdd');
    }
   }
   if(part.submodels!==undefined){if(!Array.isArray(part.submodels))throw Error('Expected submodels array');for(const sub of part.submodels)validate(sub,depth+1);}
  }
  if(copy.textureSize!==undefined){vector(copy.textureSize,2,'textureSize');if(!copy.textureSize.every((v:number)=>Number.isInteger(v)&&v>0&&v<=16384))throw Error('Invalid texture dimensions');}
  for(const part of copy.models)validate(part,0);
  if(!g.Codecs?.optifine_entity?.load||!g.Formats?.optifine_entity)throw Error('Native OptiFine entity codec unavailable');
  const previous=g.Project;
  try{
   g.Codecs.optifine_entity.load(copy,{path:'',no_file:true});
   if(!g.Project||g.Project===previous)throw Error('Native codec did not create a new project');
   g.Project.name=name||'imported_cem';
   return {project:{name:g.Project.name,uuid:g.Project.uuid,format:g.Format?.id},previousProject:previous?.uuid??null,
    elements:g.Outliner?.elements?.length??0,groups:g.Group?.all?.length??0,textures:g.Texture?.all?.length??0,
    removedTextures,exportTool:'mc_export_bbmodel',warnings:['Textures were not imported. Attach embedded textures separately.','Native CEM geometry/UV conversion only; expressions are not converted to Blockbench keyframes.']};
  }catch(error){if(previous&&g.Project!==previous)previous.select();throw error;}
 },{projectChange:true});}
