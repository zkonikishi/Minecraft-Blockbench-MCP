import {z} from 'zod';
import {zodTool} from './registry.js';

const segment=z.string().regex(/^[a-z0-9_-]{1,64}$/);
const asset=z.string().max(128).regex(/^[a-z0-9_-]+:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/);
const vec=z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]);
const stringify=(value:unknown)=>JSON.stringify(value,null,2)+'\n'; // JSON is valid YAML 1.2 and SnakeYAML input.
const profile={target:'CraftEngine',profileVersion:'26.8.2',
 supported:['static Java Block/Item bbmodel blueprints with embedded PNG textures','item configuration and optional ground furniture','BetterModel/ModelEngine furniture references','additive external pack merge plan'],
 limitations:['Not a creature animation renderer: use BetterModel/ModelEngine for animated furniture.','Blueprint export requires java_block format and per-face UV; no implicit lossy conversion.','Export returns a file manifest; it does not upload, reload or modify server settings.'],
 references:['https://xiao-momi.github.io/craft-engine-wiki/configuration/item/models/model/','https://xiao-momi.github.io/craft-engine-wiki/configuration/furniture/variants/','https://xiao-momi.github.io/craft-engine-wiki/reference/file_conflict/']};

function blueprint(input:unknown){
 const encoded=JSON.stringify(input);
 if(!encoded||encoded.length>64*1024*1024)throw Error('Blueprint missing or exceeds 64 MiB character limit');
 const m=JSON.parse(encoded,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe JSON property');return value;});
 if(m.meta?.model_format!=='java_block')throw Error('CraftEngine static blueprint requires java_block format. Convert a copy in Blockbench; use engine furniture for animated creatures.');
 if(m.animations?.length)throw Error('Static blueprint cannot preserve animations; use BetterModel/ModelEngine furniture');
 if(!Array.isArray(m.elements)||!m.elements.length||!Array.isArray(m.textures)||!m.textures.length)throw Error('Blueprint requires cube elements and embedded textures');
 if(m.resolution)for(const k of ['width','height'])if(!Number.isInteger(m.resolution[k])||m.resolution[k]<=0||m.resolution[k]>16384)throw Error('Invalid blueprint resolution');
 for(const t of m.textures){
  if(!t||typeof t.source!=='string'||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(t.source))throw Error('Embed every texture as a PNG before export');
  delete t.path;delete t.relative_path;
 }
 // CE converts cube elements, not animated parent transformations or mesh elements.
 const checkGroup=(group:any)=>{
  if(!group||typeof group!=='object')return;
  if(group.rotation?.some((v:number)=>v!==0))throw Error('Bake group rotations into a Java model before export');
  if(group.export===false)throw Error('Remove excluded groups from the export copy before blueprint export');
  if(group.children)for(const child of group.children)checkGroup(child);
 };
 for(const g of m.groups||[])checkGroup(g);for(const g of m.outliner||[])checkGroup(g);
 let enabledFaces=0;
 for(const e of m.elements){
  if(e.type&&e.type!=='cube')throw Error('Static CE blueprint supports cubes only');
  if(e.box_uv===true)throw Error('Convert box UV to per-face UV before CE blueprint export');
  for(const k of ['from','to'])vec.parse(e[k]);
  if(e.rotation)vec.parse(e.rotation);if(e.origin)vec.parse(e.origin);
  if(e.inflate!==undefined)z.number().finite().parse(e.inflate);
  if(e.rotation?.some((v:number)=>v!==0)&&!m.java_block_version)throw Error('Rotated cube requires explicit java_block_version');
  const version=String(m.java_block_version||'1.9.0').split('.').map(Number);
  const modern=version[0]>1||(version[0]===1&&(version[1]>21||(version[1]===21&&version[2]>=11)));
  if(e.rotation&&!modern&&(e.rotation.filter((v:number)=>v!==0).length>1||e.rotation.some((v:number)=>Math.abs(v)>45||(m.java_block_version==='1.9.0'&&v%22.5!==0))))throw Error('Legacy Java rotation would lose precision; use a compatible Java model version');
  if(!e.faces||typeof e.faces!=='object')throw Error('Cube faces required');
  for(const f of Object.values(e.faces) as any[]){
   if(f.texture===null)continue;
   if(!Number.isInteger(f.texture)||f.texture<0||f.texture>=m.textures.length)throw Error('Every enabled face must reference an embedded texture index');
   if(e.export!==false)enabledFaces++;
   z.tuple([z.number().finite(),z.number().finite(),z.number().finite(),z.number().finite()]).parse(f.uv);
  }
 }
 if(!enabledFaces)throw Error('Blueprint has no exported textured faces');
 return m;
}

const interaction=z.object({width:z.number().positive().max(64),height:z.number().positive().max(64),position:vec.default([0,0,0])}).strict();
const exportSchema=z.object({
 pack:segment.default('blockbench_mcp'),namespace:segment,id:segment,
 material:z.string().regex(/^(?:minecraft:)?[a-z0-9_]+$/).default('paper'),display_name:z.string().max(256).optional(),
 renderer:z.enum(['blueprint','bettermodel','modelengine']).default('blueprint'),
 model:z.record(z.unknown()).optional(),engine_model:segment.optional(),
 furniture:z.boolean().default(false),hitbox:interaction.optional(),translation:vec.default([0,0,0]),
}).strict().superRefine((v,ctx)=>{
 if(v.renderer!=='blueprint'&&(!v.engine_model||!v.furniture||v.model))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Engine references require furniture:true and engine_model; do not supply model'});
 if(v.renderer==='blueprint'&&v.engine_model)ctx.addIssue({code:z.ZodIssueCode.custom,message:'engine_model is only for engine renderers'});
 if(v.hitbox&&!v.furniture)ctx.addIssue({code:z.ZodIssueCode.custom,message:'hitbox requires furniture:true'});
});

export function craftengineTools(){return [
 zodTool('mc_craftengine_profile','Read supported CraftEngine authoring/export capabilities and version profile.',z.object({}).strict(),()=>profile,{annotations:{readOnlyHint:true}}),
 zodTool('mc_craftengine_export','Return a deployable CE resources pack manifest: static native bbmodel blueprint, item YAML and optional ground furniture, or a reference to an existing animated engine model. No files are written and no server reload/upload occurs.',exportSchema,(raw)=>{
  const a=exportSchema.parse(raw),id=`${a.namespace}:${a.id}`,key=`${a.namespace}:item/${a.id}`;
  const files:{path:string;encoding:'utf8';content:string}[]=[];
  const file=(path:string,value:unknown)=>files.push({path,encoding:'utf8',content:stringify(value)});
  file('pack.yml',{namespace:a.namespace,author:'Minecraft Blockbench MCP',version:'1.0',description:'Blockbench-generated CraftEngine assets'});
  const item:any={material:a.material};if(a.display_name)item.data={item_name:a.display_name};
  if(a.renderer==='blueprint'){
   const g=globalThis as any;
   if(!a.model&&(!g.Project||!g.Codecs?.project?.compile))throw Error('Open a Java Block/Item project or supply model JSON');
   const m=blueprint(a.model??g.Codecs.project.compile({raw:true,bitmaps:true}));
   file(`blueprint/${a.id}.bbmodel`,m);item.model={type:'minecraft:model',path:key,blueprint:a.id};
  }
  const config:any={items:{[id]:item}};
  if(a.furniture){
   item.behavior={type:'furniture_item',furniture:id,rules:{ground:{rotation:'any',alignment:'any'}}};
   const element=a.renderer==='blueprint'?{type:'item_display',item:id,translation:a.translation.join(',')}:
    {type:a.renderer==='bettermodel'?'better_model':'model_engine',model:a.engine_model,position:a.translation.join(',')};
   const variant:any={elements:[element]};
   if(a.hitbox)variant.hitboxes=[{type:'interaction',...a.hitbox,position:a.hitbox.position.join(','),interactive:true,blocks_building:true}];
   config.furniture={[id]:{settings:{item:id},variants:{ground:variant}}};
  }
  file(`configuration/${a.id}.yml`,config);
  return {schemaVersion:1,target:'CraftEngine',profileVersion:'26.8.2',pack:a.pack,installRelativePath:`plugins/CraftEngine/resources/${a.pack}`,files,
   dependencies:a.renderer==='blueprint'?[]:[{engine:a.renderer,model:a.engine_model,requirement:'Install the referenced engine model and merge its generated resource pack into CraftEngine before reloading.'}],
   reload:'ce reload all',warnings:['File contents named .yml use JSON syntax, which CraftEngine YAML accepts.','Existing packs must not be overwritten without reviewing conflicts.',...(a.renderer!=='blueprint'?['The inventory item uses its base material; the engine model is used for placed furniture.']:[])]};
 },{annotations:{readOnlyHint:true}}),
 zodTool('mc_craftengine_pack_plan','Produce additive CE resource-pack merge lists from existing lists and supplied plugin-relative pack paths. Does not change hosting credentials or write configuration.',z.object({
  existing_folders:z.array(z.string()).default([]),existing_zips:z.array(z.string()).default([]),
  add_folders:z.array(z.string().max(256).regex(/^[a-zA-Z0-9_ .-]+(?:\/[a-zA-Z0-9_ .-]+)*$/).refine(v=>v.split('/').every(s=>s!=='.'&&s!=='..'))).default([]),
  add_zips:z.array(z.string().max(256).regex(/^[a-zA-Z0-9_ .-]+(?:\/[a-zA-Z0-9_ .-]+)*\.zip$/).refine(v=>v.split('/').every(s=>s!=='.'&&s!=='..'))).default([]),
 }).strict(),(raw)=>{
  const a=raw as {existing_folders:string[];existing_zips:string[];add_folders:string[];add_zips:string[]};
  return {patch:{'resource-pack':{'merge-external-folders':[...new Set([...a.existing_folders,...a.add_folders])],'merge-external-zip-files':[...new Set([...a.existing_zips,...a.add_zips])]}},
   instructions:['Apply only these two keys inside the existing resource-pack section; preserve delivery, hosting and conflict handlers.','Paths are relative to the plugins directory. Verify each generated pack exists; merge either its folder or ZIP, not both.','Rebuild the model engine pack before ce reload all. CE remains the resource pack sender.'],validatedOnDisk:false};
 },{annotations:{readOnlyHint:true}})
 ];}
