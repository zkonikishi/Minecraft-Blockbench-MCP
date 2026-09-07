import { z } from 'zod';

export const MODELENGINE_WIKI='https://wiki.mythiccraft.io/modelengine/Modeling/Bone-Behaviors';
export const LIMB_TYPES=['head','chest','body','right_arm','right_forearm','left_arm','left_forearm','right_leg','right_foreleg','left_leg','left_foreleg'] as const;
export const BEHAVIORS=['hitbox','shadow','head','inherited_head','mount','seat','aabb','obb','item_head','item_right','item_left','ghost','nametag','leash','segment','segment_front','tail','tail_front','player_head','player_body','player_right_arm','player_left_arm','player_right_leg','player_left_leg','player_limb'] as const;
export type Behavior=typeof BEHAVIORS[number];
export const behaviorSchema=z.enum(BEHAVIORS);
export const limbSchema=z.enum(LIMB_TYPES);
const prefixes:Partial<Record<Behavior,string>>={head:'h_',inherited_head:'hi_',seat:'p_',aabb:'b_',obb:'ob_',item_head:'ih_',item_right:'ir_',item_left:'il_',ghost:'g_',nametag:'tag_',leash:'l_',segment:'seg_',segment_front:'segf_',tail:'tl_',tail_front:'tlf_',player_head:'phead_',player_body:'pbody_',player_right_arm:'prarm_',player_left_arm:'plarm_',player_right_leg:'prleg_',player_left_leg:'plleg_'};
const exact=new Set(['hitbox','shadow','mount']);
const cubeless=new Set<Behavior>(['item_head','item_right','item_left','ghost','leash','segment','segment_front','tail','tail_front']);
export function parseBehavior(name:string):{behavior:Behavior;id:string}|undefined {
  if(exact.has(name))return {behavior:name as Behavior,id:name};
  const limb=/^limb\[type=([^\]]+)\]_(.+)$/.exec(name);
  if(limb&&LIMB_TYPES.includes(limb[1] as any))return {behavior:'player_limb',id:limb[2]};
  for(const [behavior,prefix] of Object.entries(prefixes))if(name.startsWith(prefix))return {behavior:behavior as Behavior,id:name.slice(prefix.length)};
}
export function behaviorName(target:'bettermodel'|'modelengine',current:string,behavior:Behavior,name?:string,limb?:typeof LIMB_TYPES[number]) {
  if(target==='bettermodel'&&!['hitbox','shadow','aabb','obb'].includes(behavior))throw new Error('No BetterModel mapping for this behavior');
  if(behavior==='player_limb'&&!limb)throw new Error('player_limb requires limb_type');
  if(behavior!=='player_limb'&&limb)throw new Error('limb_type is only valid for player_limb');
  const id=name??parseBehavior(current)?.id??current;
  if(!/^[a-z][a-z0-9_]{0,63}$/.test(id))throw new Error('Provide a lowercase name using a-z, 0-9 and underscore');
  if(exact.has(behavior))return behavior;
  return behavior==='player_limb'?`limb[type=${limb}]_${id}`:`${prefixes[behavior]}${id}`;
}
export function behaviorGeometryIssue(behavior:Behavior,directElements:number,children:number):string|undefined {
  if(['mount','seat'].includes(behavior)&&children)return 'Mount/seat requires an empty bone';
  if(cubeless.has(behavior)&&directElements)return 'This behavior requires a cube-less bone; put geometry in child bones';
  if((behavior.startsWith('player_'))&&directElements)return 'Player limb geometry is ignored by ModelEngine; use a bone without direct elements';
}
export const MODELENGINE_CAPABILITIES={
  basis:'official-wiki',wiki:'https://wiki.mythiccraft.io/modelengine',checkedAt:'2026-09-07',
  documentationUpdated:'2026-08-19',devBuild:null,runtimeVerified:false,
  boneBehaviors:{status:'authoring-and-static-checks',tool:'mc_set_bone_behavior',values:BEHAVIORS,limbTypes:LIMB_TYPES,source:MODELENGINE_WIKI},
  animationStates:{status:'slot-authoring',note:'Empty slots need keyframes; playback needs server verification'},
  scriptableKeyframes:{status:'reference-only',source:'https://wiki.mythiccraft.io/modelengine/Modeling/Scriptable-Keyframes',note:'No dedicated MCP script-keyframe writer or server execution verification'},
  serverApi:{status:'not-implemented',note:'No runtime mounting, player skins, custom renderers, skill execution or server deployment'},
  devCompatibility:{status:'not-build-certified',note:'A Wiki snapshot is not a Dev build changelog or proof of runtime support'},
};
