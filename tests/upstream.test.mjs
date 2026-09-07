import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('all vendored files match pinned upstream source hashes',()=>{
  const records=JSON.parse(readFileSync(new URL('../upstream-lock.json',import.meta.url),'utf8'));
  assert.equal(records.length,3);
  for(const record of records)for(const [path,expected] of Object.entries(record.files)) {
    const bytes=readFileSync(new URL(`../vendor/${record.id}/${path}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,`${record.id}/${path}`);
  }
});
