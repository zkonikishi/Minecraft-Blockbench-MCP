#!/usr/bin/env python3
"""Destructive live Blockbench smoke test; run only against a disposable project."""
from __future__ import annotations
import argparse, json, os, sys
import base64

sys.path.insert(0, os.path.dirname(__file__))
import blockbench_mcp as mcp


def call(name, arguments):
    payload = mcp.rpc("tools/call", {"name": name, "arguments": arguments})
    if "error" in payload:
        raise RuntimeError(f"{name}: {payload['error']}")
    result = payload.get("result", {})
    if result.get("isError"):
        raise RuntimeError(f"{name}: {result}")
    for item in result.get("content", []):
        if item.get("type") != "text":
            continue
        decoded = json.loads(item.get("text", "{}"))
        if not decoded.get("ok"):
            raise RuntimeError(f"{name}: {decoded}")
        return decoded.get("result", {})
    raise RuntimeError(f"{name}: missing structured text result: {result}")


def image_bytes(result, view):
    row = next(item for item in result["views"] if item["view"] == view)
    return base64.b64decode(row["data_url"].split(",", 1)[1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm-disposable",
        action="store_true",
        help="required: this creates/replaces the active Blockbench project",
    )
    args = parser.parse_args()
    if not args.confirm_disposable:
        parser.error("pass --confirm-disposable; the live smoke mutates Blockbench")

    health = mcp.request_json(mcp.endpoint()[0] + "/health")
    call("create_project", {
        "format": "java_block",
        "name": "mcp_e2e_disposable",
        "texture_width": 64,
        "texture_height": 64,
    })
    call("apply_geometry_batch", {
        "create_groups": [{"name": "root", "origin": [0, 8, 0]}],
        "create_cubes": [{
            "name": "body", "parent": "root",
            "from": [-4, 0, -2], "to": [4, 8, 2], "origin": [0, 4, 0],
            "rotation": [0, 20, 0],
        }],
    })
    primary = call("ensure_texture", {"name": "e2e_base", "width": 64, "height": 64})
    helper = call("ensure_texture", {"name": "e2e_helper", "width": 4, "height": 4})
    if primary["width"] != 64 or primary["height"] != 64:
        raise RuntimeError(f"ensure_texture returned stale primary dimensions: {primary}")
    if helper["width"] != 4 or helper["height"] != 4:
        raise RuntimeError(f"ensure_texture returned stale helper dimensions: {helper}")
    before_summary = call("get_project_summary", {})
    if before_summary["texture_width"] != 64 or before_summary["texture_height"] != 64:
        raise RuntimeError(f"helper texture resized project: {before_summary}")
    call("pack_box_uv", {"cubes": ["body"], "mode": "face", "auto_resize": False})
    before = call("capture_views", {"views": ["north", "south"], "max_edge": 128, "format": "png"})
    call("paint_face_grid", {
        "texture": "e2e_base",
        "faces": [{"cube": "body", "face": "north", "rows": ["aaaaaaaa"] * 8}],
        "palette": {"a": "#4f86c6"},
    })
    grid = call("get_face_grid", {"texture": "e2e_base", "cube": "body", "face": "north"})
    colors = {pixel.lower() for row in grid["rows"] for pixel in row}
    if "#4f86c6ff" not in colors:
        raise RuntimeError(f"paint reported success but readback stayed unchanged: {colors}")
    after = call("capture_views", {"views": ["north", "south"], "max_edge": 128, "format": "png"})
    if all(image_bytes(before, view) == image_bytes(after, view) for view in ("north", "south")):
        raise RuntimeError("paint readback changed but both rendered views stayed byte-identical")
    check = call("check_model", {})
    layout = call("get_uv_layout", {"cubes": ["body"]})
    views = call("analyze_view_silhouette", {"views": ["iso", "north"], "max_edge": 128})
    summary = call("get_project_summary", {})
    report = {
        "ok": True,
        "blockbench_version": health.get("blockbench_version"),
        "project": summary,
        "check": check,
        "uv": layout,
        "silhouette": views,
        "texture_readback_colors": sorted(colors),
    }
    json.dump(report, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
