import { registerAnimationTools } from '../vendor/jason/server/tools/animation.ts';
import { registerArmatureTools } from '../vendor/jason/server/tools/armature.ts';
import { registerCameraTools } from '../vendor/jason/server/tools/camera.ts';
import { registerCubesTools } from '../vendor/jason/server/tools/cubes.ts';
import { registerElementTools } from '../vendor/jason/server/tools/element.ts';
import { registerExportTools } from '../vendor/jason/server/tools/export.ts';
import { registerHistoryTools } from '../vendor/jason/server/tools/history.ts';
import { registerImportTools } from '../vendor/jason/server/tools/import.ts';
import { registerMaterialInstanceTools } from '../vendor/jason/server/tools/material-instances.ts';
import { registerMeshTools } from '../vendor/jason/server/tools/mesh.ts';
import { registerPaintTools } from '../vendor/jason/server/tools/paint.ts';
import { registerProjectTools } from '../vendor/jason/server/tools/project.ts';
import { registerTextureTools } from '../vendor/jason/server/tools/texture.ts';
import { registerUITools } from '../vendor/jason/server/tools/ui.ts';
import { registerUVTools } from '../vendor/jason/server/tools/uv.ts';
import { listTools, callTool } from '../vendor/swag/packages/plugin/src/mcp/rpc.ts';
import { createSession } from '../vendor/swag/packages/plugin/src/session.ts';
import { tools as animationTools } from '../vendor/sosadly/src/tools.ts';
import Ajv from 'ajv';
import { importedJasonTools } from './jason-factory.ts';

let registered = false;
export function vendorTools() {
  if (!registered) {
    for (const register of [registerAnimationTools,registerArmatureTools,registerCameraTools,registerCubesTools,
      registerElementTools,registerExportTools,registerHistoryTools,registerImportTools,registerMaterialInstanceTools,
      registerMeshTools,registerPaintTools,registerProjectTools,registerTextureTools,registerUITools,registerUVTools]) register();
    registered = true;
  }
  const session = createSession();
  const ajv = new Ajv({strict:false,allErrors:true});
  return [
    ...listTools().tools.map(tool=>({...tool,name:`craft_${tool.name}`,description:`[Craft / SwagRee] ${tool.description}`,
      projectChange:tool.name==='create_project', execute:args=>callTool(session,tool.name,args)})),
    ...importedJasonTools,
    ...animationTools.map(tool=>{
      const validate = ajv.compile(tool.inputSchema);
      return {name:`anim_${tool.name}`,description:`[Animation / sosadly] ${tool.description}`,inputSchema:tool.inputSchema,
        projectChange:['new_project','load_project','close_project'].includes(tool.name),
        validate:args=>{if(!validate(args))throw new Error(ajv.errorsText(validate.errors));return args;},
        execute:async args=>({content:await tool.handler(args)})};
    }),
  ];
}
export { createProject } from '../vendor/swag/packages/plugin/src/bb/project.ts';
export { applyGeometryBatch } from '../vendor/swag/packages/plugin/src/geometry/batch.ts';
export { upsertAnimation } from '../vendor/swag/packages/plugin/src/commands/animation.ts';
