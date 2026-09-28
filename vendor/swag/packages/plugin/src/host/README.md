# Host ports (BB 5.1)

Domain/commands talk only through [`ports.ts`](./ports.ts):

| Port | Responsibility |
|------|----------------|
| `undo` | `initEdit` → work → `finishEdit(elements)` or `cancelEdit(true)` |
| `textures` | `Texture.fromDataURL().add(false)` + `texture.edit()` |
| `canvas` | `Canvas.updateView` with geometry/uv/faces |
| `formats` | create project + GeckoLib detection |
| `preview` | compact Screencam captures |

`live.ts` is the composition root. Capability probing feeds hello handshake.
