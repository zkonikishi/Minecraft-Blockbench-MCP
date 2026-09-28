import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const vendor=fileURLToPath(new URL('../vendor/',import.meta.url));
// Manifest files describe the snapshot instead of being part of it.
const manifests=new Set(['ysmparser/provenance.json']);
function walk(dir,base=''){
  const out=[];
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const rel=base?`${base}/${entry.name}`:entry.name;
    if(entry.isDirectory())out.push(...walk(join(dir,entry.name),rel));else out.push(rel);
  }
  return out;
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('every vendored file is pinned by an upstream hash and stored as upstream bytes',()=>{
  const records=JSON.parse(readFileSync(new URL('../upstream-lock.json',import.meta.url),'utf8'));
  const provenance=JSON.parse(readFileSync(new URL('../vendor/ysmparser/provenance.json',import.meta.url),'utf8'));
  const pinned=new Map();
  for(const record of records){
    assert.ok(statSync(join(vendor,record.id)).isDirectory(),`locked vendor directory is missing: ${record.id}`);
    assert.match(record.commit,/^[0-9a-f]{40}$/,`${record.id} needs a full upstream commit`);
    assert.ok(record.repository.startsWith('https://github.com/'),`${record.id} needs an upstream repository`);
    for(const [path,expected] of Object.entries(record.files))pinned.set(`${record.id}/${path}`,expected);
  }
  for(const [path,expected] of Object.entries(provenance.files))pinned.set(`ysmparser/${path}`,expected);
  // A vendor directory absent from every manifest would escape the pin silently.
  assert.deepEqual([...new Set([...pinned.keys()].map(p=>p.split('/')[0]))].sort(),readdirSync(vendor).sort());
  const crlf=Buffer.from('\r\n');
  for(const [path,expected] of pinned){
    const bytes=readFileSync(join(vendor,path));
    assert.equal(sha(bytes),expected,path);
    // The recorded hashes are the upstream sources' own SHA-256. A CRLF import would
    // silently replace them with hashes of locally mangled bytes.
    if(!path.endsWith('.wasm'))assert.ok(!bytes.includes(crlf),`CRLF reintroduced in vendor/${path}`);
  }
  // A file added to vendor/ without updating a manifest must fail the gate.
  assert.deepEqual(walk(vendor).filter(p=>!manifests.has(p)).sort(),[...pinned.keys()].sort());
  // Manifest files themselves must stay LF so the snapshot is byte-reproducible.
  for(const path of manifests)assert.ok(!readFileSync(join(vendor,path)).includes(crlf),`CRLF in vendor/${path}`);
});
