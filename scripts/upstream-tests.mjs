import {build} from 'esbuild';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {root} from './bundle-options.mjs';
const output=resolve(process.env.BLOCKBENCH_TEST_DIR||resolve(root,'.test-output'),'upstream');
mkdirSync(output,{recursive:true});
const shared=resolve(root,'vendor/swag/packages/shared/src');
const tests=[];
for(const name of ['protocol.test','smoke-contract.test','uv-mode.test']) {
  const file=join(output,`${name}.mjs`);
  await build({entryPoints:[join(shared,`${name}.ts`)],bundle:true,platform:'node',format:'esm',outfile:file,
    define:{'import.meta.url':JSON.stringify(pathToFileURL(join(shared,`${name}.ts`)).href)}});tests.push(file);
}
const hostSource=resolve(root,'vendor/swag/packages/plugin/src');
for(const name of ['bedrock-host.test','startup.test']) {
  const original=resolve(root,`vendor/swag/packages/plugin/tests/${name}.mjs`);
  let source=readFileSync(original,'utf8');
  source=source.replace('from "esbuild"',`from ${JSON.stringify(pathToFileURL(resolve(root,'node_modules/esbuild/lib/main.js')).href)}`);
  source=source.replaceAll('import.meta.url',JSON.stringify(pathToFileURL(original).href));
  source=source.replaceAll('await build({',`await build({ alias: {"@blockbench-mcp/shared":${JSON.stringify(join(shared,'index.ts'))}},`);
  const file=join(output,`${name}.mjs`);writeFileSync(file,source);tests.push(file);
}
const run=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit',env:process.env});
process.exitCode=run.status??1;
