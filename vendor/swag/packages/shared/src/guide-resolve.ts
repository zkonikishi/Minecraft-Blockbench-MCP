import { GUIDE_ANIMATION, GUIDE_GECKOLIB, GUIDE_JAVA_BLOCK, GUIDE_MODELING, GUIDE_TEXTURING } from "./guides.js";

export type GuideTopic =
  | "modeling"
  | "texturing"
  | "animation"
  | "java_block"
  | "geckolib";

const TOPICS: Record<GuideTopic, string> = {
  modeling: GUIDE_MODELING,
  texturing: GUIDE_TEXTURING,
  animation: GUIDE_ANIMATION,
  java_block: GUIDE_JAVA_BLOCK,
  geckolib: GUIDE_GECKOLIB,
};

export function resolveGuide(topic?: GuideTopic): { topic: GuideTopic; text: string } {
  const key = topic ?? "modeling";
  return { topic: key, text: TOPICS[key] };
}
