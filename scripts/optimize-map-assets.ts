/** Lossless runtime map assets. PNG masters remain available for art tests and sample renders. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
const root = path.join(__dirname, '..');
const dir = path.join(root, 'assets/gen/maps');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stardew-webp-'));
let before = 0, after = 0, count = 0;
const manifestPath = path.join(root, 'src/data/generated/assets.ts');
let manifest = fs.readFileSync(manifestPath, 'utf8');
try {
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.png') && !n.endsWith('-thumb.png'))) {
    const source = path.join(dir,name), target = source.replace(/\.png$/, '.webp');
    execFileSync('cwebp', ['-quiet','-lossless','-exact','-m','6',source,'-o',target]);
    const decoded = path.join(tmp,'decoded.png');
    execFileSync('dwebp',[target,'-quiet','-o',decoded]);
    const a = PNG.sync.read(fs.readFileSync(source)), b = PNG.sync.read(fs.readFileSync(decoded));
    assert.equal(a.width,b.width,name); assert.equal(a.height,b.height,name);
    assert.ok(a.data.equals(b.data), `Pixel mismatch: ${name}`);
    const inputSize=fs.statSync(source).size, outputSize=fs.statSync(target).size;
    const ext = outputSize<inputSize ? 'webp' : 'png';
    const stem = name.slice(0,-4);
    manifest=manifest.replaceAll(`maps/${stem}.png`, `maps/${stem}.${ext}`).replaceAll(`maps/${stem}.webp`, `maps/${stem}.${ext}`);
    before+=inputSize; after+=Math.min(inputSize,outputSize); count++;
  }
  fs.writeFileSync(manifestPath,manifest);
  console.log(JSON.stringify({maps:count,beforeBytes:before,afterBytes:after,savedBytes:before-after,pixels:'identical'},null,2));
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
