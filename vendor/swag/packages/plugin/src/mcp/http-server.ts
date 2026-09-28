import type { NetModule, NetSocket } from "./net.js";

const MAX_BODY = 8 * 1024 * 1024;

export type HttpHeaders = Record<string, string>;

export type HttpRequest = {
  method: string;
  path: string;
  headers: HttpHeaders;
  body: string;
};

export type HttpHandler = (req: HttpRequest, socket: NetSocket) => void | Promise<void>;

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const BufferCtor = (globalThis as { Buffer?: { concat: (c: Uint8Array[]) => Uint8Array } })
    .Buffer;
  if (BufferCtor?.concat) return BufferCtor.concat(chunks);
  let len = 0;
  for (const c of chunks) len += c.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function indexOfSep(buf: Uint8Array): number {
  for (let i = 0; i < buf.length - 3; i++) {
    if (
      buf[i] === 13 &&
      buf[i + 1] === 10 &&
      buf[i + 2] === 13 &&
      buf[i + 3] === 10
    ) {
      return i;
    }
  }
  return -1;
}

export function writeHttp(
  socket: NetSocket,
  status: number,
  body: string | undefined,
  extraHeaders?: HttpHeaders,
): void {
  const statusText =
    status === 200
      ? "OK"
      : status === 202
        ? "Accepted"
        : status === 204
          ? "No Content"
          : status === 401
            ? "Unauthorized"
            : status === 404
              ? "Not Found"
              : status === 405
                ? "Method Not Allowed"
                : status === 400
                  ? "Bad Request"
                  : "Error";
  const payload = body ?? "";
  const headers: string[] = [
    `HTTP/1.1 ${status} ${statusText}`,
    "Connection: close",
    "Access-Control-Allow-Origin: *",
    "Access-Control-Allow-Headers: Content-Type, Authorization, Mcp-Session-Id, mcp-session-id",
    "Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE",
  ];
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers.push(`${k}: ${v}`);
  }
  if (body !== undefined) {
    headers.push("Content-Type: application/json; charset=utf-8");
    const byteLen =
      (globalThis as { Buffer?: { byteLength: (s: string, e: string) => number } }).Buffer
        ?.byteLength?.(payload, "utf8") ?? new TextEncoder().encode(payload).length;
    headers.push(`Content-Length: ${byteLen}`);
  } else {
    headers.push("Content-Length: 0");
  }
  socket.write(`${headers.join("\r\n")}\r\n\r\n${payload}`);
  try {
    socket.destroy();
  } catch {
    /* ignore */
  }
}

export function attachHttpServer(net: NetModule, handler: HttpHandler) {
  return net.createServer((socket) => {
    const chunks: Uint8Array[] = [];
    let received = 0;
    let headersDone = false;
    let method = "GET";
    let path = "/";
    let headerLength = 0;
    let contentLength = 0;
    const headers: HttpHeaders = {};

    socket.on("data", ((chunk: Uint8Array) => {
      received += chunk.length;
      if (received > MAX_BODY) {
        socket.destroy();
        return;
      }
      chunks.push(chunk);
      const buffer = concatChunks(chunks);
      chunks.length = 0;
      chunks.push(buffer);

      if (!headersDone) {
        const sep = indexOfSep(buffer);
        if (sep === -1) return;
        headerLength = sep + 4;
        const headerText = new TextDecoder().decode(buffer.slice(0, sep));
        const lines = headerText.split("\r\n");
        const parts = (lines[0] || "").split(" ");
        method = parts[0] || "GET";
        path = parts[1] || "/";
        for (let i = 1; i < lines.length; i++) {
          const c = lines[i].indexOf(":");
          if (c <= 0) continue;
          const key = lines[i].slice(0, c).trim().toLowerCase();
          const val = lines[i].slice(c + 1).trim();
          headers[key] = val;
          if (key === "content-length") contentLength = parseInt(val, 10) || 0;
        }
        headersDone = true;
      }

      if (headersDone && buffer.length >= headerLength + contentLength) {
        const body = new TextDecoder().decode(
          buffer.slice(headerLength, headerLength + contentLength),
        );
        void Promise.resolve(handler({ method, path, headers, body }, socket)).catch(
          () => {
            try {
              writeHttp(socket, 500, JSON.stringify({ error: "internal" }));
            } catch {
              /* ignore */
            }
          },
        );
      }
    }) as (...args: never[]) => void);

    socket.on("error", (() => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    }) as (...args: never[]) => void);
    socket.setTimeout(120_000, () => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    });
  });
}
