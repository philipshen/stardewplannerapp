// Copies CanvasKit's wasm into public/ so Expo web can serve it at /canvaskit.wasm (Skia on web).
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'node_modules', 'canvaskit-wasm', 'bin', 'full', 'canvaskit.wasm');
const dst = path.join(__dirname, '..', 'public', 'canvaskit.wasm');
if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
