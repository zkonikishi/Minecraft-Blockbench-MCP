import { requireNodeModule } from "../host/node-modules.js";

/** Blockbench desktop grants a scoped `require` for `net` (network permission). */
export type NetModule = {
  createServer: (
    listener: (socket: NetSocket) => void,
  ) => NetServer;
};

export type NetSocket = {
  on: (event: string, cb: (...args: never[]) => void) => void;
  write: (data: string | Uint8Array) => void;
  destroy: () => void;
  setTimeout: (ms: number, cb: () => void) => void;
};

export type NetServer = {
  listen: (port: number, host: string, cb?: () => void) => void;
  close: (cb?: () => void) => void;
  on: (event: string, cb: (...args: never[]) => void) => void;
};

export function loadNet(): NetModule {
  const net = requireNodeModule<NetModule>("net");
  if (!net?.createServer) {
    throw new Error(
      "Network access (net module) was denied. Allow it for this plugin, then Start MCP Server.",
    );
  }
  return net;
}
