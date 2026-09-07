export {
  PROTOCOL_VERSION,
  DEFAULTS,
  ERROR_CODES,
  errorPayloadSchema,
  makeError,
  PROJECT_FORMATS,
  VIEW_PRESETS,
  vec3Schema,
} from "./protocol-base.js";
export type {
  ErrorCode,
  ErrorPayload,
  ProjectFormat,
  ViewPreset,
  Vec3,
} from "./protocol-base.js";

export {
  projectSummarySchema,
  checkFindingSchema,
  checkModelResultSchema,
  checkModelParamsSchema,
  captureViewsParamsSchema,
  captureViewsDefaults,
  captureViewMetaSchema,
  mutationSuccessSchema,
  mutationFailureSchema,
  mutationResultSchema,
  createProjectParamsSchema,
  cubeSpecSchema,
  groupSpecSchema,
  applyGeometryBatchParamsSchema,
  createLimbParamsSchema,
  paintFaceFeatureParamsSchema,
  healthResultSchema,
} from "./contracts.js";
export type {
  ProjectSummary,
  CheckModelResult,
  CaptureViewsParams,
  MutationResult,
  HealthResult,
} from "./contracts.js";

export {
  ensureTextureParamsSchema,
  autoUvCubesParamsSchema,
  mirrorElementsParamsSchema,
  scaffoldBipedParamsSchema,
  upsertAnimationParamsSchema,
} from "./contracts-extra.js";

export {
  packBoxUvParamsSchema,
  getUvLayoutParamsSchema,
  getUvMapParamsSchema,
  shadeModelBaseParamsSchema,
  paintFaceFeaturesParamsSchema,
  paintPixelBatchParamsSchema,
  getTextureParamsSchema,
  resizeTextureParamsSchema,
  paintFaceGridParamsSchema,
  getFaceGridParamsSchema,
  editTexturePixelsParamsSchema,
  replaceTextureColorParamsSchema,
  copyFacePixelsParamsSchema,
  analyzeTexturePaletteParamsSchema,
  getTextureRegionParamsSchema,
  importTexturePngParamsSchema,
  exportTexturePngParamsSchema,
  getTextureRevisionParamsSchema,
  floodFillTextureParamsSchema,
  transformTextureRegionParamsSchema,
  auditTextureQualityParamsSchema,
} from "./contracts-texture.js";

export {
  assignTextureParamsSchema,
  deleteAnimationParamsSchema,
  getElementsParamsSchema,
  setFaceUvParamsSchema,
  setProjectMetaParamsSchema,
  updateElementsParamsSchema,
  transformElementsParamsSchema,
  arrayCubesParamsSchema,
  measureModelParamsSchema,
  auditSymmetryParamsSchema,
} from "./contracts-management.js";

export {
  radialArrayCubesParamsSchema,
  duplicateHierarchyParamsSchema,
  transformUvIslandsParamsSchema,
  auditMaterialSetParamsSchema,
  ensureMaterialSetParamsSchema,
  inspectAnimationParamsSchema,
  transformAnimationKeysParamsSchema,
  analyzeViewSilhouetteParamsSchema,
} from "./contracts-advanced.js";

export { resolveGuide } from "./guide-resolve.js";
export type { GuideTopic } from "./guide-resolve.js";
export {
  GUIDE_MODELING,
  GUIDE_TEXTURING,
  GUIDE_ANIMATION,
  GUIDE_JAVA_BLOCK,
  GUIDE_GECKOLIB,
} from "./guides.js";

export { COMMAND_SPECS, COMMAND_NAMES, isCommandName } from "./commands.js";
export type { CommandSpec, CommandName } from "./commands.js";

export {
  MIN_BLOCKBENCH_VERSION,
  CAPABILITY_IDS,
  capabilitiesSchema,
  parseSemverParts,
  isBlockbenchSupported,
} from "./capabilities.js";
export type { CapabilityId } from "./capabilities.js";

export { UV_MODES, uvModeSchema, resolveUvModeFromHints } from "./uv-mode.js";
export type { UvMode } from "./uv-mode.js";

export const PLUGIN_VERSION = "0.6.2";
