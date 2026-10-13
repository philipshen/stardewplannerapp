/** Shared native/web/export lighting pass, recorded once per farm edit. */
import { BlendMode, ClipOp, Skia, SkCanvas, TileMode } from '@shopify/react-native-skia';
import { planLights } from './lighting';

export function drawNight(canvas: SkCanvas, lights: ReturnType<typeof planLights>, width: number, height: number) {
  const bounds = Skia.XYWHRect(0, 0, width, height);
  const paint = Skia.Paint();
  canvas.save();
  canvas.clipRect(bounds, ClipOp.Intersect, false);
  // Erase soft pools from an isolated darkness layer, revealing the actual farm.
  canvas.saveLayer(undefined, bounds);
  paint.setColor(Skia.Color('rgba(8,14,42,0.78)'));
  canvas.drawRect(bounds, paint);
  paint.setBlendMode(BlendMode.DstOut);
  for (const light of lights) {
    const center = { x: light.x * 16, y: light.y * 16 };
    const radius = light.radius * 16;
    const shader = Skia.Shader.MakeRadialGradient(center, radius,
      ['rgba(0,0,0,0.96)', 'rgba(0,0,0,0.65)', 'transparent'].map(Skia.Color),
      [0, 0.35, 1], TileMode.Clamp);
    paint.setShader(shader);
    canvas.drawCircle(center.x, center.y, radius, paint);
    shader.dispose();
  }
  canvas.restore();
  // A restrained warm tint keeps overlapping lights from washing out the pixel art.
  paint.setBlendMode(BlendMode.SrcOver);
  for (const light of lights) {
    const center = { x: light.x * 16, y: light.y * 16 };
    const radius = light.radius * 16;
    const shader = Skia.Shader.MakeRadialGradient(center, radius,
      ['rgba(255,183,72,0.16)', 'rgba(255,183,72,0)'].map(Skia.Color),
      [0, 1], TileMode.Clamp);
    paint.setShader(shader);
    canvas.drawCircle(center.x, center.y, radius, paint);
    shader.dispose();
  }
  canvas.restore();
  paint.dispose();
}

export function nightPicture(lights: ReturnType<typeof planLights>, width: number, height: number) {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  drawNight(canvas, lights, width, height);
  const picture = recorder.finishRecordingAsPicture();
  recorder.dispose();
  return picture;
}
