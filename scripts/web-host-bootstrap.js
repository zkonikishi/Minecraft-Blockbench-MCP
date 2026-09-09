// Local development-host integration. Serve beside the built MCP plugin.
// No credentials are embedded: the plugin uses the editor's existing settings.
(() => {
  if (location.hostname !== '127.0.0.1' || location.port !== '39801') return;
  const source = new URL('./minecraft_blockbench_mcp.js', document.currentScript.src).href;
  let attempts = 0;
  const timer = setInterval(() => {
    if (!window.Blockbench?.setup_successful || !window.Plugin || !window.Plugins) {
      if (++attempts >= 240) clearInterval(timer);
      return;
    }
    clearInterval(timer);
    const id = 'minecraft_blockbench_mcp';
    if (window[`${id}_cleanup`]) return;
    // Register an explicitly bundled local plugin before its Plugin.register call.
    const plugin = new Plugin(id);
    Plugins.registered[id] = plugin;
    Plugins.all.safePush(plugin);
    plugin.source = 'file';
    plugin.tags.safePush('Local');
    const script = document.createElement('script');
    script.src = source;
    script.onload = () => { plugin.installed = true; };
    script.onerror = () => Blockbench.showQuickMessage('Local Minecraft MCP bundle could not be loaded.', 8000);
    document.head.append(script);
  }, 250);
})();
