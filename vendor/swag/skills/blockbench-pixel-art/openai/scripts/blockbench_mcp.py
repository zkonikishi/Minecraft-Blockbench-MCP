#!/usr/bin/env python3
"""Minimal standard-library client for the local Blockbench MCP HTTP server."""
from __future__ import annotations
import argparse, json, os, sys, urllib.error, urllib.request
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
DEFAULT_ROOT = "http://127.0.0.1:39741"
def endpoint():
    configured = os.environ.get("BLOCKBENCH_MCP_URL", DEFAULT_ROOT).rstrip("/")
    return (configured[:-4], configured) if configured.endswith("/mcp") else (configured, configured + "/mcp")
def request_json(url, body=None):
    headers = {"Accept": "application/json"}; data = None
    if body is not None:
        secret = os.environ.get("BLOCKBENCH_MCP_SECRET", "dev-local-secret")
        headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {secret}"})
        data = json.dumps(body, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))
def rpc(method, params, request_id=1):
    _, url = endpoint(); return request_json(url, {"jsonrpc":"2.0","id":request_id,"method":method,"params":params})
def load_arguments(args):
    if args.args_file:
        with open(args.args_file, "r", encoding="utf-8") as handle: value = json.load(handle)
    else: value = json.loads(args.args)
    if not isinstance(value, dict): raise ValueError("Tool arguments must be a JSON object")
    return value
def main():
    parser = argparse.ArgumentParser(description=__doc__); sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("health"); sub.add_parser("list"); call = sub.add_parser("call"); call.add_argument("tool")
    source = call.add_mutually_exclusive_group(); source.add_argument("--args", default="{}"); source.add_argument("--args-file")
    args = parser.parse_args()
    try:
        root, _ = endpoint()
        if args.command == "health": result = request_json(root + "/health")
        elif args.command == "list": result = rpc("tools/list", {})
        else: result = rpc("tools/call", {"name":args.tool,"arguments":load_arguments(args)})
        json.dump(result, sys.stdout, ensure_ascii=False, indent=2); sys.stdout.write("\n"); return 0
    except (OSError, ValueError, json.JSONDecodeError, urllib.error.URLError) as exc:
        print(f"blockbench_mcp: {exc}", file=sys.stderr); return 1
if __name__ == "__main__": raise SystemExit(main())


