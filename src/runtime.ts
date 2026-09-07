import { ToolRegistry, zodTool } from './registry.js';
import { z } from 'zod';
import { vendorTools } from './vendor-runtime.mjs';
import { creatureTools } from './creature-tools.js';
const DESKTOP_ONLY=new Set(['craft_propose_scoped_directory','craft_save_project','craft_export_model','craft_import_texture_png','craft_export_texture_png','anim_load_project','anim_save_project','anim_export_project','anim_import_texture','studio_export_model','studio_save_checkpoint','studio_capture_app_screenshot']);
const ADVANCED=new Set(['studio_risky_eval','studio_trigger_action','studio_emulate_clicks','studio_fill_dialog','anim_execute_script','anim_install_plugin','anim_uninstall_plugin']);
export function createRuntime(options:{desktop?:boolean;advanced?:boolean}={}) {
  const registry=new ToolRegistry();
  const unavailable:{name:string;reason:string}[]=[];
  for(const tool of vendorTools()) {
    if(!options.desktop&&DESKTOP_ONLY.has(tool.name)){unavailable.push({name:tool.name,reason:'desktop-only; use mc_export_bbmodel in Web'});continue;}
    if(!options.advanced&&ADVANCED.has(tool.name)){unavailable.push({name:tool.name,reason:'enable Advanced tools locally and reconnect'});continue;}
    registry.add(tool);
  }
  for(const tool of creatureTools())registry.add(tool);
  registry.add(zodTool('mc_status','Inspect this connection, available tool families, project and engine authoring profile.',z.object({}).strict(),()=>({
    name:'Minecraft Blockbench MCP',version:'0.1.0-alpha.2',mode:options.desktop?'desktop':'web',
    project:(globalThis as any).Project?{name:(globalThis as any).Project.name,uuid:(globalThis as any).Project.uuid,format:(globalThis as any).Format?.id}:null,
    toolCount:registry.definitions.size,unavailable,targets:['BetterModel','ModelEngine'],runtimeVerified:false,
  }),{annotations:{readOnlyHint:true}}));
  return registry;
}
