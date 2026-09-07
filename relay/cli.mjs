import { startRelay } from './server.mjs';
const relay=await startRelay({token:process.env.MINECRAFT_BLOCKBENCH_TOKEN,port:Number(process.env.MINECRAFT_BLOCKBENCH_PORT||39800),pluginFile:process.env.MINECRAFT_BLOCKBENCH_PLUGIN_FILE||new URL('../dist/minecraft_blockbench_mcp.js',import.meta.url)});
console.error(`Minecraft Blockbench MCP: http://127.0.0.1:${relay.port}/mcp`);
console.error('Load minecraft_blockbench_mcp.js in Blockbench Desktop or Web, set the same token, then Connect Minecraft MCP.');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void relay.close().then(()=>process.exit(0));});
