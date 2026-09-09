import {z} from 'zod';
import {zodTool} from './registry.js';

export function importTools(){return [zodTool('mc_import_bbmodel',
 'Import a parsed bbmodel JSON object into a NEW project using the native project codec. Existing projects stay open. Requires installed format and embedded PNG textures; no filesystem paths are read. Returns project UUID and counts.',
 z.object({model:z.record(z.unknown()),name:z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional()}).strict(),
 ({model,name})=>{
  const g=globalThis as any;
  const json=JSON.stringify(model);
  if(json.length>64*1024*1024)throw Error('Model JSON exceeds 64 MiB character limit');
  const copy=JSON.parse(json,(key,value)=>{
   if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe JSON property');
   return value;
  });
  if(!copy.meta||!g.Formats?.[copy.meta.model_format])throw Error('Model format is missing or not installed');
  for(const key of ['elements','outliner','textures','groups','animations']){
   if(copy[key]!==undefined&&!Array.isArray(copy[key]))throw Error(`Expected ${key} array`);
  }
  if(!Array.isArray(copy.elements)||!Array.isArray(copy.outliner))throw Error('Expected bbmodel elements and outliner');
  // Desktop codecs prefer paths over embedded bytes. Never read those paths.
  for(const texture of copy.textures||[]){
   if(!texture||typeof texture.source!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=\r\n]+$/.test(texture.source))throw Error('Embed every texture as a PNG data URI before JSON import');
   delete texture.path;delete texture.relative_path;
  }
  if(!g.Codecs?.project?.load)throw Error('Native project codec unavailable');
  const previous=g.Project;
  try{
   g.Codecs.project.load(copy,{path:`${name||'imported_model'}.bbmodel`,no_file:true});
   if(!g.Project||g.Project===previous)throw Error('Native codec did not create a new project');
   return {project:{name:g.Project.name,uuid:g.Project.uuid,format:g.Format?.id},previousProject:previous?.uuid??null,
    elements:g.Outliner?.elements?.length??0,textures:g.Texture?.all?.length??0,animations:g.Animation?.all?.length??0,
    keyframes:(g.Animation?.all||[]).reduce((sum:number,a:any)=>sum+Object.values(a.animators||{}).reduce((n:number,b:any)=>n+(b.keyframes?.length||0),0),0),
    sourcePathsIgnored:true};
  }catch(error){
   // Preserve partial import for inspection, return focus to untouched old project.
   if(previous&&g.Project!==previous)previous.select();
   throw error;
  }
 },{projectChange:true})];}
