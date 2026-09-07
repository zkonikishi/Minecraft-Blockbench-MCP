import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
export type ToolResult = { content: Content[]; isError?: boolean; structuredContent?: unknown };
export type ToolDefinition = {
  name: string; description: string; inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
  validate?: (args: unknown) => Record<string, unknown>;
  projectChange?: boolean;
};
export const textResult = (value: unknown): ToolResult => ({content:[{type:'text',text:typeof value === 'string' ? value : JSON.stringify(value,null,2)}]});
export const errorResult = (error: unknown): ToolResult => ({...textResult(error instanceof Error ? error.message : String(error)),isError:true});
export function normalizeResult(value: unknown): ToolResult {
  if (value && typeof value === 'object' && 'content' in value && Array.isArray(value.content)) return value as ToolResult;
  return textResult(value ?? null);
}
export function zodTool(name: string, description: string, schema: z.ZodTypeAny, execute: ToolDefinition['execute'], extras: Partial<ToolDefinition> = {}): ToolDefinition {
  return {name,description,inputSchema:zodToJsonSchema(schema,{$refStrategy:'none',target:'jsonSchema7'}) as Record<string,unknown>,
    validate:args=>schema.parse(args) as Record<string,unknown>,execute,...extras};
}

/** One shared lane for every tool, including reads: no cross-provider Undo overlap. */
export class ToolRegistry {
  readonly definitions = new Map<string, ToolDefinition>();
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private closed = false;
  constructor(private readonly getProject: () => unknown = () => (globalThis as any).Project) {}
  add(tool: ToolDefinition): void {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) throw new Error(`Invalid tool name: ${tool.name}`);
    if (this.definitions.has(tool.name)) throw new Error(`Duplicate tool: ${tool.name}`);
    this.definitions.set(tool.name,tool);
  }
  list() { return [...this.definitions.values()].map(({execute,validate,projectChange,...spec})=>spec); }
  stop(): void { this.closed = true; }
  async drain(): Promise<void> { await this.tail; }
  call(name: string, raw: unknown = {}): Promise<ToolResult> {
    if (this.closed) return Promise.resolve(errorResult('MCP stopped; queued calls were cancelled.'));
    const tool = this.definitions.get(name);
    if (!tool) return Promise.resolve(errorResult(`Unknown tool: ${name}`));
    if (this.pending >= 64) return Promise.resolve(errorResult('MCP queue full; wait for outstanding calls.'));
    let args: Record<string,unknown>;
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Arguments must be an object');
      args = tool.validate ? tool.validate(raw) : raw as Record<string,unknown>;
    } catch (e) { return Promise.resolve(errorResult(e)); }
    const project = this.getProject();
    this.pending++;
    const result = this.tail.then(async () => {
      if (this.closed) return errorResult('MCP stopped; queued call cancelled.');
      if (project !== this.getProject()) return errorResult('Active project changed while queued; inspect it and retry.');
      try {
        const value = normalizeResult(await tool.execute(args));
        if (!tool.projectChange && project !== this.getProject()) return errorResult('Active project changed during execution; inspect both projects before retrying.');
        return value;
      } catch (e) { return errorResult(e); }
      finally { /* Keep the lane occupied until the actual handler settles, even on client disconnect. */ }
    }).finally(()=>{this.pending--;});
    this.tail = result.catch(()=>undefined);
    return result;
  }
}
