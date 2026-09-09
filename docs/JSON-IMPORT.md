# JSON project import

`mc_import_bbmodel` accepts `{model: <parsed bbmodel object>, name?: "file_stem"}`.
The caller reads its authorized file and sends JSON; the tool does not accept
filesystem paths. It invokes the native `Codecs.project.load` with `no_file`,
creating a new project and retaining existing tabs. Repeating the call creates
another project; it is not an update operation.

```js
const model = JSON.parse(fs.readFileSync(authorizedPath, 'utf8'));
const result = await client.callTool({
  name: 'mc_import_bbmodel',
  arguments: {model, name: 'zdrehmal_villager_50'}
});
if (result.isError) throw new Error(result.content[0].text);
```

The format must be installed. Textures must contain embedded PNG data URIs.
Texture filesystem paths are ignored so desktop cannot replace embedded bytes
with unrelated files. Bone, element, texture, animation, and keyframe UUIDs and
data are passed to the native codec without remapping or rebaking. The new
project itself receives a fresh UUID. Native format compatibility processing
still applies, just as with Open Model; this is not a claim of byte-for-byte
roundtrip preservation for every third-party format.

The response reports the new project, previous project UUID, and counts of
elements/textures/animations/keyframes. A codec exception restores focus to the
previous project and retains any partial import for inspection. No project is
closed or saved. Preview and server acceptance remain the caller's responsibility.

Local deployment 2026-09-09: default Web catalogue 207 tools. Typecheck/build and
36 tests passed. Live tool discovery and invalid-input rejection verified without
importing or modifying migration candidates. User-requested content acceptance
is performed by the content task. This is a local Alpha 5 hotfix, not a new release.
