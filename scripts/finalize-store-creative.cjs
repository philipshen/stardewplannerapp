// App Store assets must be opaque RGB PNGs. Run after the Swift renderer.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const dir = path.join(process.cwd(), 'store/creative-2026-10/readability-v2');
for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.png'))) {
  const target = path.join(dir, file);
  const png = PNG.sync.read(fs.readFileSync(target));
  fs.writeFileSync(target, PNG.sync.write(png, { colorType: 2, inputColorType: 6 }));
  console.log(`${file}: ${png.width} x ${png.height}, RGB`);
}
