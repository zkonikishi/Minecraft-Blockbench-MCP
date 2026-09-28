declare const __MCP_VERSION__: string;
/**
 * Injected from `package.json` at build time by `scripts/bundle-options.mjs`.
 * The `typeof` guard keeps unbundled / test imports from throwing.
 */
export const VERSION: string = typeof __MCP_VERSION__ === 'string' ? __MCP_VERSION__ : '0.0.0-unbundled';
