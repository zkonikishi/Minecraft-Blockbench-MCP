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
  existing listeners. The supervisor runs for the current Windows session; it
  is not a Windows startup service. Run the launcher after a host reboot.
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
Alpha 5, not a newly published GitHub release.
