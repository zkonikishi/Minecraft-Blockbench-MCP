# Local Web editor lifecycle

The local editor at `http://127.0.0.1:39801/` now bundles the MCP plugin through
`scripts/web-host-bootstrap.js`. This integration is specific to the local host;
it does not modify the official Web Blockbench site or relax its URL installer.
The host serves the bootstrap and the built plugin beside `index.html`.
Credentials remain in the existing editor settings, never in these scripts.

Web Blockbench does not reload file-installed plugins after a page reload.
Its URL installer also rejects HTTP plugin URLs, including loopback URLs.
Repeated local-file installation is therefore not a durable setup for this host.

The plugin now retries unexpected disconnects with a 1–30 second exponential
backoff when auto-connect is enabled. Manual disconnect and unload cancel retries.
Policy/authentication rejection (1008), including another connected editor, does
not retry. A relay has one editor; content tasks should use the SDK against that
editor instead of opening additional connected windows.

Local operational files live in
`D:/Servers/AI/Data/Codex/config/minecraft-blockbench/`:

- `Start-Minecraft-Blockbench.ps1`: launches a detached supervisor.
- `supervisor.mjs`: loopback singleton on 39802; checks missing services every
  five seconds, starts only absent listeners, records child exits, never kills
  existing listeners. The desktop acceptance run in [runtime acceptance](RUNTIME-ACCEPTANCE.md)
  also starts a relay on 39802, so stop this supervisor before that run; the Web
  host bootstrap in this document uses 39801. The supervisor runs for the current
  Windows session; it is not a Windows startup service. Run the launcher after a
  host reboot.
- `Probe-Minecraft-Blockbench.mjs`: SDK initialize, tools/list, mc_status; exits
  with failure if disconnected. No secret is printed.

An in-app browser belongs to its Codex thread. Its absence from another thread's
tab inventory does not prove the tab was deleted. The owner must call
`markHandoff()` or `markDeliverable()` each turn in which it uses the editor and
needs it retained. This does not survive browser shutdown. The local bootstrap
restores the plugin on reload; model recovery/import is a separate decision.

2026-09-09 local validation: typecheck/build and 34 tests passed; real editor
reload restored 206 tools; stopping only the identified relay PID caused the
supervisor to restart it and the editor to reconnect without a UI action. SDK
initialize/list/status then returned 206 tools and Web mode. Existing model
files and the recovery prompt were left untouched. This is a local hotfix over
Alpha 5, not a newly published GitHub release. The 206 tools and 34 tests describe
this Alpha 5 hotfix build only: other 2026-09-09 records — [JSON import](JSON-IMPORT.md)
(207 tools, 36 tests) and [Alpha 6](ALPHA-6.md) (207 tools, 39 tests) — are
different checkpoint builds, and none of them is the current suite of 85 tests.

## Two supported ways to run the Web editor

**A. Official editor, plugin loaded from file (no local host required).** Open
`https://web.blockbench.net`, use **File → Plugins → Load Plugin from File** and select
`minecraft_blockbench_mcp.js`, then set the token and choose **Tools → Connect
Minecraft MCP**. The relay already allows the official origins, and the bridge URL
`ws://127.0.0.1:39800` is a *potentially trustworthy* origin — the Secure Contexts
specification classifies hosts in `127.0.0.0/8`, `::1/128` and `localhost` as
potentially trustworthy — so it is not mixed content and an HTTPS page may open it.
The trade-off is that Web Blockbench does not persist a file-installed plugin across a
page reload, so the file must be loaded again after every reload.

**B. Local Web host (persistent plugin).** Serve a local Blockbench Web checkout on
`http://127.0.0.1:39801/` and inject the built plugin through
`scripts/web-host-bootstrap.js`. This survives reloads because the bootstrap registers
the plugin on every page load. It requires maintaining a separate Blockbench checkout.

## Why the editor bridge was recorded as disconnected

The local editor host is a **separate Blockbench checkout and is not part of this
repository**. The recorded blocker came from that checkout living under a build cache,
`D:/Servers/AI/Data/Codex/cache/blockbench-merge-20260907/blockbench-host`, which was
later removed by cache cleanup. `supervisor.mjs` still starts the editor with
`build.js --target=web --serve` in that directory, so once the directory is gone the
editor never starts, no editor ever connects to the relay, and `mc_status` reports a
disconnected bridge. The relay itself was healthy throughout.

The same supervisor also creates the junction target
`D:/Servers/AI/Data/Codex/builds/blockbench-web-host` at startup. The editor's own
command is what every `mc_status` depends on, so check it first.

`editor.supervised.log` distinguishes the cases:

- `Failed to create output directory: mkdir ...\dist: Cannot create a file when that
  file already exists` — the checkout exists but `dist` is already present as a
  junction, and the build script calls `mkdir` without tolerating that. Point the
  junction at `D:/Servers/AI/Data/Codex/builds/blockbench-web-host`, or remove the
  stale `dist`, then run `node build.js --target=web`.
- no output and no listener on the editor port — the checkout directory itself is
  missing; restore or re-clone a Blockbench Web checkout into the path the supervisor
  uses, or switch to option A above.

`node --env-file=.env scripts/doctor.mjs` separates the three independent services:
the relay, the editor host page, and the editor's own connection. It reports the editor
host URL and status in its JSON and gives a different message for each failure, so a
missing editor host is never confused with a disconnected editor. Set
`MINECRAFT_BLOCKBENCH_EDITOR_URL` when the host is not on `http://127.0.0.1:39801/`.

Verify the editor page, its `dist/bundle.js`, and the plugin asset separately. HTTP 200
proves asset availability; only a successful `mc_status` proves editor connection.
Browser-control errors are separate from relay availability.

