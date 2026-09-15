// Resolve explicit YSM spec-2 file associations; never access host paths.
export function modelBinding(jsons,modelPath){
 const config=jsons.find(f=>/(^|\/)ysm\.json$/i.test(f.path))?.json;
 if(!config?.files)return null;
 const player=config.files.player;
 if(player?.model&&typeof player.model==='object'){
  const role=Object.keys(player.model).find(k=>player.model[k]===modelPath);
  if(role){
   const all=player.animation??{};
   const animationFiles=typeof all==='string'?[all]:role==='arm'&&all.arm?[all.arm]:Object.entries(all).filter(([key])=>key!=='arm').map(([,value])=>value).filter(v=>typeof v==='string');
   const candidates=Array.isArray(player.texture)?player.texture:[];
   const selected=candidates.find(t=>t.name===config.properties?.default_texture)??candidates[0];
   return {role,animationFiles,texture:typeof player.texture==='string'?player.texture:selected?.uv,source:'ysm.json/files/player'};
  }
 }
 for(const [role,entry] of Object.entries(config.files.projectiles??{})){
  if(entry?.model===modelPath)return {role,animationFiles:typeof entry.animation==='string'?[entry.animation]:Object.values(entry.animation??{}).filter(v=>typeof v==='string'),texture:typeof entry.texture==='string'?entry.texture:undefined,source:'ysm.json/files/projectiles'};
 }
 return null;
}

export function pngDimensions(file,fallback){
 const b=Buffer.from(file.data,'base64');
 if(b.length>=24&&b.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&b.subarray(12,16).toString()==='IHDR'){
  const width=b.readUInt32BE(16),height=b.readUInt32BE(20);
  if(width>0&&height>0&&width<=32768&&height<=32768)return {width,height};
 }
 return fallback;
}

export function effectKeyframes(animation,makeId){
 const keyframes=[];
 for(const [key,channel] of [['sound_effects','sound'],['particle_effects','particle'],['timeline','timeline']]){
  for(const [timestamp,entry] of Object.entries(animation[key]??{})){
   const time=Number(timestamp);if(!Number.isFinite(time)||time<0)throw Error('Invalid effect keyframe time');
   const values=Array.isArray(entry)?entry:[entry];
   const data_points=channel==='timeline'?[{script:values.join('\n')}]:values.map(value=>{
    const point=typeof value==='string'?{effect:value}:{...value};
    if(channel==='particle'&&point.pre_effect_script!==undefined)point.script=point.pre_effect_script;
    return point;
   });
   keyframes.push({uuid:makeId(`${channel}:${timestamp}`),channel,time,data_points});
  }
 }
 return keyframes;
}
