import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function bundleOptions() {
  return {bundle:true,platform:'neutral',target:'es2022',legalComments:'inline',mainFields:['module','main'],external:['fs','path','net'],
    alias:{'@/lib/factories':resolve(root,'src/jason-factory.ts'),'@':resolve(root,'vendor/jason'),
      '@blockbench-mcp/shared':resolve(root,'vendor/swag/packages/shared/src/index.ts')},
    plugins:[{name:'upstream-adapters',setup(build){
      build.onLoad({filter:/vendor[\\/]swag[\\/]packages[\\/]plugin[\\/]src[\\/]host[\\/]preview-port\.ts$/},args=>{
        const original=readFileSync(args.path,'utf8');
        if(!original.includes('visible.flatMap(cubeWorldCorners)'))throw Error('Pinned screenshot framing boundary changed');
        return {contents:`import {posedCubeCorners} from ${JSON.stringify(resolve(root,'src/posed-bounds.ts').replaceAll('\\','/'))};\n`+original.replace('visible.flatMap(cubeWorldCorners)','visible.flatMap(posedCubeCorners)'),loader:'ts'};
      });
      build.onLoad({filter:/vendor[\\/]jason[\\/]lib[\\/]constants\.ts$/},args=>({contents:readFileSync(args.path,'utf8').replace(' assert { type: "json" }',''),loader:'ts'}));
      build.onResolve({filter:/^\.\/client\.js$/},args=>args.importer.replaceAll('\\','/').includes('/vendor/sosadly/')?{path:resolve(root,'src/sosadly-client.mjs')}:undefined);
      build.onResolve({filter:/^sosadly-commands$/},()=>({path:'commands',namespace:'sosadly'}));
      build.onLoad({filter:/.*/,namespace:'sosadly'},()=>{
        const original = readFileSync(resolve(root,'vendor/sosadly/plugin/blockbench_mcp.js'),'utf8');
        const start = original.indexOf('function requireProject()');
        const end = original.indexOf('// HTTP server');
        if(start<0||end<start)throw new Error('Pinned sosadly extraction boundary changed');
        const faceLookup='const tex = findTexture(fd.texture);';
        const extracted=original.slice(start,end);
        if(extracted.split(faceLookup).length!==3)throw new Error('Pinned face texture adapter boundary changed');
        const adapted=extracted.replaceAll(faceLookup,'if (fd.texture === null) { face.texture = null; continue; }\n\t\t\t'+faceLookup);
        return {contents:`const PROTOCOL_VERSION=1;\n${adapted}\nexport { commands, applyFaces };`,loader:'js',resolveDir:root};
      });
      build.onLoad({filter:/vendor[\\/]swag[\\/]packages[\\/]plugin[\\/]src[\\/]mcp[\\/]rpc\.ts$/},args=>({
        contents:readFileSync(args.path,'utf8')+'\nexport { listTools, callTool };\n',loader:'ts'}));
      build.onLoad({filter:/vendor[\\/]swag[\\/]packages[\\/]shared[\\/]src[\\/]protocol-base\.ts$/},args=>({
        contents:readFileSync(args.path,'utf8').replace('export const PROJECT_FORMATS = [','export const PROJECT_FORMATS = ["free", '),loader:'ts'}));
    }}]};
}
