import type { FormatPort } from "./ports.js";
import { CommandError } from "../errors.js";

export function createFormatPort(): FormatPort {
  return {
    currentId() {
      return (
        (globalThis as unknown as { Format?: { id?: string } }).Format?.id ?? null
      );
    },
    hasGeckoLib() {
      const Formats = (globalThis as unknown as {
        Formats?: Record<string, unknown>;
      }).Formats;
      if (!Formats) return false;
      if (Formats.geckolib_model) return true;
      return Object.keys(Formats).some((id) => id.toLowerCase().includes("gecko"));
    },
    createProject(opts) {
      const Formats = (globalThis as unknown as {
        Formats?: Record<string, { new?: () => void; box_uv?: boolean; optional_box_uv?: boolean }>;
      }).Formats;
      if (!Formats) {
        throw new CommandError("E_BLOCKBENCH_ERROR", "Formats unavailable");
      }
      let api = Formats[opts.format];
      let id = opts.format;
      if (!api && opts.format === "geckolib_model") {
        const hit = Object.keys(Formats).find((k) =>
          k.toLowerCase().includes("gecko"),
        );
        if (!hit) {
          throw new CommandError(
            "E_UNSUPPORTED_FORMAT",
            "Install the GeckoLib Blockbench plugin.",
          );
        }
        id = hit;
        api = Formats[hit];
      }
      if (!api?.new) {
        throw new CommandError("E_UNSUPPORTED_FORMAT", `Cannot create ${opts.format}`);
      }
      if (opts.uv_mode && api.optional_box_uv === false && typeof api.box_uv === "boolean" && (opts.uv_mode === "box") !== api.box_uv) {
        throw new CommandError("E_INVALID_PARAM", "The selected format does not support this UV mode");
      }
      if (opts.uv_mode === "box" && opts.format === "java_block") {
        throw new CommandError("E_INVALID_PARAM", "java_block requires face UV mode");
      }
      const create = (globalThis as unknown as {
        newProject?: (format: unknown) => boolean;
      }).newProject;
      const previous = (globalThis as unknown as { Project?: unknown }).Project;
      if (create) {
        if (create(api) === false) {
          throw new CommandError("E_BLOCKBENCH_ERROR", "Project creation was cancelled");
        }
      } else {
        throw new CommandError("E_BLOCKBENCH_ERROR", "Native newProject API unavailable; reference project was not changed");
      }
      const Project = (globalThis as unknown as {
        Project?: { name?: string; texture_width?: number; texture_height?: number; box_uv?: boolean; geometry_name?: string };
        Format?: { id?: string };
      }).Project;
      const Format = (globalThis as unknown as { Format?: { id?: string } }).Format;
      if (!Project || Project === previous) {
        throw new CommandError("E_BLOCKBENCH_ERROR", "A new project was not created; reference project was not changed");
      }
      if (Project) {
        if (opts.name) Project.name = opts.name;
        if (opts.uv_mode) Project.box_uv = opts.uv_mode === "box";
        if (opts.geometry_name) Project.geometry_name = opts.geometry_name;
        if (opts.texture_width) Project.texture_width = opts.texture_width;
        if (opts.texture_height) Project.texture_height = opts.texture_height;
      }
      return { format: Format?.id ?? id, name: Project?.name };
    },
  };
}
