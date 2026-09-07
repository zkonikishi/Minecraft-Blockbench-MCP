import type { SessionState } from "../session.js";
import { CommandError } from "../errors.js";
import { requireNodeModule } from "../host/node-modules.js";
import { requireProject } from "../bb/elements.js";

type FsApi = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string) => Uint8Array;
  writeFileSync: (
    path: string,
    data: string | ArrayBuffer | Uint8Array,
  ) => void;
};

type CodecApi = { compile?: () => unknown };

type PathApi = {
  isAbsolute: (path: string) => boolean;
  resolve: (path: string) => string;
  relative: (from: string, to: string) => string;
};

function fsApi(): FsApi {
  const fs = requireNodeModule<Partial<FsApi>>("fs");
  if (!fs?.existsSync || !fs.readFileSync || !fs.writeFileSync) {
    throw new CommandError(
      "E_BLOCKBENCH_ERROR",
      "Filesystem not available (use Blockbench desktop app).",
    );
  }
  return fs as FsApi;
}

export function scopedTarget(session: SessionState, path: string): string {
  if (!session.scopedDirectory) {
    throw new CommandError(
      "E_SCOPE_DENIED",
      "Call propose_scoped_directory first and get user approval.",
    );
  }
  const paths = requireNodeModule<PathApi>("path");
  if (!paths.isAbsolute(path)) {
    throw new CommandError(
      "E_SCOPE_DENIED",
      "Destination path must be absolute",
    );
  }
  const root = paths.resolve(session.scopedDirectory);
  const target = paths.resolve(path);
  const relative = paths.relative(root, target);
  if (
    relative === ".." ||
    relative.startsWith(`..\\`) ||
    relative.startsWith("../") ||
    paths.isAbsolute(relative)
  ) {
    throw new CommandError(
      "E_SCOPE_DENIED",
      `Export path must be inside scoped directory: ${root}`,
    );
  }
  return target;
}

export function readScopedBinary(
  session: SessionState,
  path: string,
): Uint8Array {
  const target = scopedTarget(session, path);
  const fs = fsApi();
  if (!fs.existsSync(target))
    throw new CommandError("E_NOT_FOUND", `File not found: ${target}`);
  return fs.readFileSync(target);
}

export function writeScopedBinary(
  session: SessionState,
  path: string,
  data: Uint8Array,
  overwrite?: boolean,
): { path: string; bytes: number } {
  const target = scopedTarget(session, path);
  const fs = fsApi();
  if (fs.existsSync(target) && overwrite !== true) {
    throw new CommandError(
      "E_SCOPE_DENIED",
      "File exists; pass overwrite:true",
    );
  }
  fs.writeFileSync(target, data);
  return { path: target, bytes: data.byteLength };
}

function serialize(content: unknown): string | ArrayBuffer | Uint8Array {
  if (
    typeof content === "string" ||
    content instanceof ArrayBuffer ||
    content instanceof Uint8Array
  ) {
    return content;
  }
  if (content === undefined || content === null) {
    throw new CommandError("E_BLOCKBENCH_ERROR", "Codec returned no content");
  }
  return JSON.stringify(content, null, 2);
}

function compileTo(
  session: SessionState,
  opts: { path: string; overwrite?: boolean },
  codec: CodecApi | undefined,
  label: string,
): { path: string; bytes: number; codec: string } {
  requireProject();
  const target = scopedTarget(session, opts.path);
  const fs = fsApi();
  if (fs.existsSync(target) && opts.overwrite !== true) {
    throw new CommandError(
      "E_SCOPE_DENIED",
      "File exists; pass overwrite:true",
    );
  }
  if (typeof codec?.compile !== "function") {
    throw new CommandError(
      "E_UNSUPPORTED_FORMAT",
      `${label} codec is unavailable`,
    );
  }
  const data = serialize(codec.compile());
  fs.writeFileSync(target, data);
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data).byteLength
      : data.byteLength;
  return { path: target, bytes, codec: label };
}

export function proposeScopedDirectory(
  session: SessionState,
  path: string,
): { scoped_directory: string; confirmed: boolean } {
  const paths = requireNodeModule<PathApi>("path");
  if (!paths.isAbsolute(path)) {
    throw new CommandError(
      "E_INVALID_PARAM",
      "Scoped directory must be absolute",
    );
  }
  const resolved = paths.resolve(path);
  const ok =
    typeof window !== "undefined" &&
    window.confirm(
      `Allow MCP file access for this session?\n\n${resolved}\n\nOnly this folder will be writable/readable by AI tools.`,
    );
  if (!ok)
    throw new CommandError(
      "E_SCOPE_DENIED",
      "User denied scoped directory access.",
    );
  session.scopedDirectory = resolved;
  return { scoped_directory: resolved, confirmed: true };
}

export function saveProject(
  session: SessionState,
  opts: { path: string; overwrite?: boolean },
): { path: string; bytes: number; codec: string } {
  const codec = (globalThis as unknown as { Codecs?: { project?: CodecApi } })
    .Codecs?.project;
  return compileTo(session, opts, codec, "project");
}

export function exportModel(
  session: SessionState,
  opts: { path: string; overwrite?: boolean },
): { path: string; bytes: number; codec: string } {
  const format = (
    globalThis as unknown as { Format?: { id?: string; codec?: CodecApi } }
  ).Format;
  return compileTo(session, opts, format?.codec, format?.id ?? "format");
}
