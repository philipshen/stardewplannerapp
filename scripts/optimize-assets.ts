/** Lossless PNG compression: keep every RGBA pixel, dimension and asset path. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

let before = 0, after = 0, count = 0;
function optimize(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { optimize(file); continue; }
    if (!entry.name.endsWith('.png')) continue;
    const input = fs.readFileSync(file);
    const original = PNG.sync.read(input);
    const encoded = PNG.sync.write(original, { colorType: 6, deflateLevel: 9, deflateStrategy: 0 });
    const result = encoded.length < input.length ? encoded : input;
    const decoded = PNG.sync.read(result);
    assert.equal(decoded.width, original.width, file);
    assert.equal(decoded.height, original.height, file);
    assert.ok(decoded.data.equals(original.data), `Pixel mismatch: ${file}`);
    if (result !== input) fs.writeFileSync(file, result);
    before += input.length; after += result.length; count++;
  }
}
optimize(path.join(__dirname, '../assets/gen'));
console.log(JSON.stringify({ pngs: count, beforeBytes: before, afterBytes: after, savedBytes: before - after, pixels: 'identical' }, null, 2));
