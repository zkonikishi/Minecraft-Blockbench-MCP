# BlockbenchMCP

![MCP](https://img.shields.io/badge/MCP-server-6f42c1)
![Blockbench](https://img.shields.io/badge/Blockbench-4.8%2B-1f8cff)
![Node](https://img.shields.io/badge/Node-18%2B-339933)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

> Let an AI build Minecraft models, textures and animations directly inside [Blockbench](https://www.blockbench.net/) — through the [Model Context Protocol](https://modelcontextprotocol.io/).

BlockbenchMCP gives an AI assistant a live connection to a running Blockbench window. The model can start a project from the start screen, build geometry (bones + cubes), **paint textures procedurally**, author **keyframe animations** (including [GeckoLib](https://github.com/bernie-g/geckolib)), **install Blockbench plugins**, move the camera, and **take screenshots so it can look at its own work and refine it** — all without you touching the editor.

<!-- Tip: add a screenshot or gif of a generated model here, e.g. ![demo](assets/demo.gif) -->

It was used to model, texture and animate a full GeckoLib grizzly bear (walk / run / sleep / attack) end-to-end from a single prompt.

---

## Table of contents

- [How it works](#how-it-works)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Connecting your AI client](#connecting-your-ai-client)
- [Tool reference](#tool-reference)
- [Example: an animated GeckoLib bear](#example-an-animated-geckolib-bear)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Limitations](#limitations)
- [Development](#development)
- [License](#license)

---

## How it works

There are two pieces:

| Piece | Runs where | Responsibility |
|-------|-----------|----------------|
| **Bridge plugin** — [`plugin/blockbench_mcp.js`](plugin/blockbench_mcp.js) | Inside Blockbench (desktop) | Hosts a local HTTP endpoint on `127.0.0.1:8787` (built on Node's `net` module) and runs each command against the Blockbench API on the renderer thread. |
| **MCP server** — [`src/`](src/) → `dist/` | A Node process your AI client launches | Exposes Blockbench as MCP tools (stdio transport) and forwards every call to the bridge. |

```
┌────────────┐   stdio (MCP)   ┌──────────────────┐   HTTP 127.0.0.1:8787   ┌─────────────────────┐
│  AI client │ ──────────────▶ │  blockbench-mcp  │ ──────────────────────▶ │  Blockbench + plugin │
│ (Claude…)  │ ◀────────────── │   (Node server)  │ ◀────────────────────── │   (live editor)      │
└────────────┘                 └──────────────────┘                         └─────────────────────┘
```

## Features

- 🧱 **Modeling** — create bones (groups) and cubes one at a time or **in bulk** (`add_groups` / `add_cubes` build a whole posed skeleton in one call), with full rotation and inflate; edit/move/reparent/delete, and read the outliner tree.
- 🎨 **Texturing** — create textures, paint procedurally (pixels, rects, lines, circles, **ellipses, polygons, dither, noise**, gradients), **auto-shade every cube face** with `detail_cubes` (no flat or untextured gaps), and place features in **face-relative coordinates** with `paint_faces`.
- 🎬 **Animation** — create animations, add keyframes in bulk for any bone/channel with interpolation control (linear / catmullrom / step / bezier).
- 📸 **Vision** — `screenshot`, **`screenshot_views`** (several angles at once) and `get_texture` return images inline so the model can *see* and iterate, and `check_model` audits for problems.
- 🧠 **Guidance** — `get_guide` returns a modeling/texturing playbook so the AI builds detailed, rotated models instead of a few flat boxes.
- 🧩 **Plugins** — search, install (by store id, URL, or file) and uninstall Blockbench plugins, so the AI can set up formats like GeckoLib itself.
- 🔧 **Escape hatch** — `execute_script` runs arbitrary Blockbench JS for anything not covered by a dedicated tool.
- 🟢 **40 tools** total, all over a single local connection.

## Requirements

- **Blockbench desktop app**, version **4.8+** (the web app cannot host the bridge — see [Limitations](#limitations)).
- **Node.js 18+** (for global `fetch`).
- An MCP-capable client (Claude Code, Claude Desktop, Cursor, etc.).

## Installation

### 1. Install the bridge plugin in Blockbench

1. Open the **desktop** Blockbench app.
2. **File ▸ Plugins ▸ Load Plugin from File** and select [`plugin/blockbench_mcp.js`](plugin/blockbench_mcp.js).
   *(Alternatively copy it into your Blockbench `plugins` folder.)*
3. On first start the plugin asks for **network permission** (it needs the `net` module to host the local server). Choose **“Always allow for this plugin.”**
4. A toast confirms **“MCP server started on port 8787.”**
   - Toggle the server any time: **Tools ▸ Start / Stop MCP Server**
   - Change the port: **Settings ▸ General ▸ MCP Server Port** (default `8787`)

Verify it's up:

```bash
curl http://127.0.0.1:8787/ping
# {"ok":true,"protocol":1,"blockbench_version":"5.x.x","is_app":true,"has_project":false}
```

### 2. Build the MCP server

```bash
git clone https://github.com/sosadly/blockbench-mcp.git
cd blockbench-mcp
npm install
npm run build
```

## Connecting your AI client

Point your client at `dist/index.js` over stdio. Use an **absolute path**.

**Claude Code** — `.mcp.json` in your project (or `claude mcp add`):

```json
{
  "mcpServers": {
    "blockbench": {
      "command": "node",
      "args": ["/absolute/path/to/blockbench-mcp/dist/index.js"],
      "env": { "BLOCKBENCH_MCP_PORT": "8787" }
    }
  }
}
```

**Claude Desktop** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "blockbench": {
      "command": "node",
      "args": ["C:\\path\\to\\blockbench-mcp\\dist\\index.js"]
    }
  }
}
```

| Env var | Default | Purpose |
|---------|---------|---------|
| `BLOCKBENCH_MCP_PORT` | `8787` | Must match the plugin's port setting. |
| `BLOCKBENCH_MCP_HOST` | `127.0.0.1` | Bridge host. |

## Tool reference

| Group | Tools |
|-------|-------|
| **Status & guidance** | `get_status`, `get_guide`, `list_formats` |
| **Project** | `new_project`, `set_project_meta`, `save_project`, `export_project`, `load_project`, `close_project` |
| **Geometry** | `add_group`, `add_cube`, `add_groups`, `add_cubes`, `edit_element`, `delete_element`, `list_outliner`, `get_element`, `check_model` |
| **UV & textures** | `create_texture`, `paint_texture`, `detail_cubes`, `paint_faces`, `apply_texture`, `set_cube_uv`, `import_texture`, `resize_texture`, `list_textures`, `get_texture` |
| **Animation** | `create_animation`, `add_keyframe`, `add_keyframes`, `list_animations`, `remove_animation` |
| **View** | `set_camera_angle`, `screenshot`, `screenshot_views` |
| **Plugins** | `list_plugins`, `install_plugin`, `uninstall_plugin` |
| **Escape hatch** | `execute_script` |

Conventions: coordinates are **Blockbench units**; rotations are **degrees**; texture pixel ops use a **top-left origin with y pointing down**. `add_cube` returns each face's resolved UV rect; `detail_cubes` then base-coats every face and `paint_faces` lets you paint features (eyes, nose, claws) in coordinates relative to a face, so you don't compute absolute UVs by hand.

## Example: an animated GeckoLib bear

The sequence an AI follows for *“make a textured GeckoLib bear that can walk, run, sleep and attack”*:

```jsonc
// 0. Read the playbook so the model comes out detailed and rotated, not boxy
get_guide {}

// 1. Install GeckoLib (adds the `geckolib_model` format)
install_plugin { "id": "geckolib" }

// 2. New project, straight from the start screen
new_project { "format": "geckolib_model", "name": "bear",
              "texture_width": 64, "texture_height": 64 }

// 3. Lay out the whole posed skeleton in one call — note the rotated bones
add_groups { "groups": [
  { "name": "body",   "origin": [0, 12, 0] },
  { "name": "head",   "origin": [0, 14, -7], "parent": "body", "rotation": [10, 0, 0] }, // nose down
  { "name": "leg_fl", "origin": [3, 8, -5],  "parent": "body", "rotation": [-6, 0, 0] },
  { "name": "leg_fr", "origin": [-3, 8, -5], "parent": "body", "rotation": [-6, 0, 0] }
  // ...hind legs, ears, muzzle, tail...
] }

// 4. Build many cubes at once (segment limbs, taper with inflate, mirror left/right)
add_cubes { "cubes": [
  { "name": "torso",   "from": [-5, 8, -7], "to": [5, 16, 7], "parent": "body" },
  { "name": "head",    "from": [-3.5, 10, -13], "to": [3.5, 16, -7], "parent": "head" },
  { "name": "muzzle",  "from": [-2, 10, -16], "to": [2, 13, -13], "parent": "head", "inflate": -0.5 }
  // ...
] }

// 5. Texture: shaded base coat on EVERY face (no gaps), then features face-relative
create_texture { "name": "bear", "width": 64, "height": 64, "fill": "#6e4a2b" }
detail_cubes   { "base": "#6e4a2b", "noise": 0.12, "bottom_dark": 0.3 }
paint_faces    { "faces": [
  { "cube": "head",   "face": "north", "ops": [
    { "type": "rect",    "x": 2, "y": 2, "width": 1, "height": 1, "color": "#0f0a05" }, // eye
    { "type": "ellipse", "x": 3, "y": 4, "width": 2, "height": 2, "color": "#140e08" }  // nose
  ] }
] }

// 6. Animate (bulk keyframes, smooth interpolation)
create_animation { "name": "animation.bear.walk", "loop": "loop", "length": 1.2 }
add_keyframes {
  "animation": "animation.bear.walk",
  "keyframes": [
    { "bone": "leg_fl", "channel": "rotation", "time": 0.0, "value": [28, 0, 0], "interpolation": "catmullrom" },
    { "bone": "leg_fl", "channel": "rotation", "time": 0.6, "value": [-28, 0, 0], "interpolation": "catmullrom" },
    { "bone": "leg_fl", "channel": "rotation", "time": 1.2, "value": [28, 0, 0], "interpolation": "catmullrom" }
  ]
}

// 7. Review from every side + audit, fix what you see, then repeat 4–7
screenshot_views { "views": ["isometric_right_front", "front", "left", "back"] }
check_model {}

// 8. Save / export
save_project   { "path": "D:/models/bear.bbmodel" }
export_project { "path": "D:/models/bear.geo.json" }
```

## Troubleshooting

**Blockbench shows “server stopped” and Start does nothing.**
The plugin needs the `net` module. When you click **Start MCP Server**, Blockbench shows a permission dialog — choose **“Always allow for this plugin.”** If you previously denied it, revoke and retry from the plugin's context menu, or restart Blockbench.

**MCP tools fail with “Cannot reach Blockbench on 127.0.0.1:8787”.**
Make sure Blockbench is open, the plugin is loaded, and the server is running (green toast / `curl .../ping` works). Confirm the port in the plugin settings matches `BLOCKBENCH_MCP_PORT`.

**“Unknown format … the matching plugin must be installed.”**
Plugin formats like GeckoLib's `geckolib_model` require `install_plugin { "id": "geckolib" }` first. Run `list_formats` to confirm the id appeared.

**Console 404s about `about.md` / the plugin store.**
Harmless — Blockbench tries to fetch store metadata for the side-loaded plugin and gets a 404. It does not affect the bridge.

## Security

- The bridge binds to **`127.0.0.1` only** — it is not reachable from your network.
- `execute_script` runs **unsandboxed JavaScript** inside Blockbench. Only connect MCP clients you trust, and prefer the dedicated tools over `execute_script` where possible.

## Limitations

- **Desktop only.** The bridge relies on Node modules (`net`), which the Blockbench web app does not expose to plugins.
- **One Blockbench window.** The bridge talks to whichever project is currently active.
- Box-UV packing is up to the caller; `add_cube` returns resolved face UVs to make this manageable.

## Development

```bash
npm run dev     # tsc --watch
npm run build   # one-off compile to dist/
```

- MCP tool definitions live in [`src/tools.ts`](src/tools.ts); the HTTP client in [`src/client.ts`](src/client.ts); the server entry in [`src/index.ts`](src/index.ts).
- Bridge command handlers live in [`plugin/blockbench_mcp.js`](plugin/blockbench_mcp.js) under the `commands` object — add a handler there and a matching tool in `tools.ts` to extend the surface.
- The Blockbench API used by the bridge is documented in the [official type definitions](https://github.com/JannisX11/blockbench/tree/master/types).

## License

[MIT](LICENSE) © [sosadly](https://github.com/sosadly)

Built with the [Model Context Protocol](https://modelcontextprotocol.io/). Not affiliated with Blockbench or GeckoLib.
