// Adapter for Jason J. Gardner's GPL-3.0-only tools. Original handlers and full Zod
// refinements are preserved; the original SDK/server singleton is not loaded.
import { z } from 'zod';
import { zodTool, type ToolDefinition } from './registry.js';
export interface ToolSpec {name:string;description:string;parameters:z.ZodTypeAny;status:string;annotations?:Record<string,unknown>}
export interface ToolContext {reportProgress:(progress:{progress:number;total:number})=>void}
export const importedJasonTools: ToolDefinition[] = [];
export function createTool(name:string, tool:{description:string;parameters:z.ZodTypeAny;annotations?:Record<string,unknown>;execute:(args:any,context:ToolContext)=>unknown}, _status='stable', enabled=true) {
  if (enabled) importedJasonTools.push(zodTool(`studio_${name}`,`[Studio / Jason] ${tool.description}`,tool.parameters,
    args=>tool.execute(args,{reportProgress:()=>{}}),{annotations:tool.annotations,projectChange:name==='create_project'}));
  return {name,enabled,status:_status};
}
export const tools = {};
export const prompts = {};
