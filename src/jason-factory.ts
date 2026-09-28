// Adapter for Jason J. Gardner's GPL-3.0-only tools. Original handlers and full Zod
// refinements are preserved; the original SDK/server singleton is not loaded.
//
// Upstream 1.9.3 resolves `@/lib/factories` to this module (see
// scripts/bundle-options.mjs), so it must expose the surface the vendored tool files
// use. Upstream's own implementation maintains an McpServer instance, a tool
// registry and AI-disclosure tracking; the shared registry in ./registry.ts owns all
// of that here, so only the declaration helpers are provided.
import { z } from 'zod';
import { zodTool, type ToolDefinition } from './registry.js';
import type { ToolCondition } from '../vendor/jason/server/tool-conditions.js';

export interface IToolAnnotations {
  title?: string;
  destructiveHint?: boolean;
  readOnlyHint?: boolean;
  openWorldHint?: boolean;
}
export interface IToolSpec {
  name: string;
  description: string;
  annotations?: IToolAnnotations;
  parameters: z.ZodTypeAny;
  status: string;
  /** Native Blockbench condition; evaluated by the editor, not by this adapter. */
  condition?: ToolCondition;
}
export interface IToolContext {
  reportProgress: (progress: { progress: number; total: number }) => void;
}
export type ToolResult = unknown;
/** Previous upstream names, still referenced by files pinned before 1.9.3. */
export type ToolSpec = IToolSpec;
export type ToolContext = IToolContext;

export const importedJasonTools: ToolDefinition[] = [];
export function createTool<T extends z.ZodTypeAny>(
  name: string,
  tool: {
    description: string;
    annotations?: IToolAnnotations;
    parameters: T;
    condition?: ToolCondition;
    plugin?: string;
    execute: (args: z.infer<T>, context?: IToolContext) => unknown;
  },
  _status = 'stable',
  enabled = true
) {
  if (enabled) {
    importedJasonTools.push(zodTool(`studio_${name}`, `[Studio / Jason] ${tool.description}`, tool.parameters,
      args => tool.execute(args as z.infer<T>, {reportProgress: () => {}}),
      {annotations: tool.annotations as Record<string, unknown> | undefined, projectChange: name === 'create_project'}));
  }
  return {name, enabled, status: _status, plugin: tool.plugin};
}
export const tools: Record<string, unknown> = {};
export const prompts: Record<string, unknown> = {};
export const resources: Record<string, unknown> = {};
