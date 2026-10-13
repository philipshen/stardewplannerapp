/** Cross-platform helpers to share/download generated files and pick a plan file to import. */
import { Image, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

/**
 * iOS cannot present a system sheet (share, file picker) while one of the app's own sheets is still closing.
 * Call this after you close a sheet and before you open a system sheet.
 */
export const afterSheetCloses = () => new Promise<void>((resolve) => setTimeout(resolve, Platform.OS === 'web' ? 0 : 500));

const safeName = (s: string) => s.replace(/[^a-z0-9-_ ]+/gi, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'farm';

function webDownload(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function sharePNG(base64: string, title: string) {
  const name = `${safeName(title)}.png`;
  if (Platform.OS === 'web') { webDownload(name, `data:image/png;base64,${base64}`); return; }
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(base64ToBytes(base64));
  await Sharing.shareAsync(f.uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
}

export async function shareJSON(data: unknown, title: string) {
  const name = `${safeName(title)}.stardewplan.json`;
  const text = JSON.stringify(data);
  if (Platform.OS === 'web') {
    webDownload(name, URL.createObjectURL(new Blob([text], { type: 'application/json' })));
    return;
  }
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: title, UTI: 'public.json' });
}

/** Lets the user pick any file and returns its text (plan files and game save files). */
export async function pickText(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  let text: string;
  if (Platform.OS === 'web') {
    const file = (asset as any).file as Blob | undefined;
    text = file ? await file.text() : await (await fetch(asset.uri)).text();
  } else {
    text = await new File(asset.uri).text();
  }
  return { name: asset.name ?? 'file', text };
}

export async function pickJSON(): Promise<unknown | null> {
  const f = await pickText();
  return f ? JSON.parse(f.text) : null;
}

// ---------------------------------------------------------------- custom layout images
const MAX_LAYOUT_PX = 3200;

function imageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));
}

/** Web: scale very large images down so they fit in browser storage. */
async function webNormalize(dataUri: string) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUri;
  });
  const { naturalWidth: width, naturalHeight: height } = img;
  const f = Math.min(1, MAX_LAYOUT_PX / Math.max(width, height));
  if (f === 1 && dataUri.length < 1_500_000) return { uri: dataUri, width, height };
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * f);
  canvas.height = Math.round(height * f);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { uri: canvas.toDataURL('image/jpeg', 0.85), width, height };
}

/** Picks an image to use as a custom layout background. The image is copied into app storage. */
export async function pickLayoutImage(): Promise<{ uri: string; width: number; height: number } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['image/png', 'image/jpeg', 'image/webp'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web') {
    const file = (asset as any).file as Blob | undefined;
    const blob = file ?? (await (await fetch(asset.uri)).blob());
    const dataUri = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return webNormalize(dataUri);
  }
  const ext = (asset.name?.match(/\.(png|jpe?g|webp)$/i)?.[1] ?? 'png').toLowerCase();
  const dest = new File(Paths.document, `layout-${Date.now().toString(36)}.${ext}`);
  await new File(asset.uri).copy(dest);
  return { uri: dest.uri, ...(await imageSize(dest.uri)) };
}

/** Turns a layout image into a data URI, so a plan file works on another device. */
export async function layoutImageForExport(uri: string) {
  if (Platform.OS === 'web' || uri.startsWith('data:')) return uri;
  const ext = uri.match(/\.(png|jpe?g|webp)$/i)?.[1]?.toLowerCase() ?? 'png';
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${await new File(uri).base64()}`;
}

/** Stores an imported layout image. Native keeps it as a file; web keeps the data URI. */
export async function layoutImageFromImport(dataUri: string) {
  if (Platform.OS === 'web' || !dataUri.startsWith('data:')) return dataUri;
  const m = dataUri.match(/^data:image\/(png|jpeg|webp);base64,(.*)$/);
  if (!m) return dataUri;
  const dest = new File(Paths.document, `layout-${Date.now().toString(36)}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
  dest.create();
  dest.write(base64ToBytes(m[2]));
  return dest.uri;
}

function base64ToBytes(b64: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)], b = lookup[clean.charCodeAt(i + 1)], c = lookup[clean.charCodeAt(i + 2)], d = lookup[clean.charCodeAt(i + 3)];
    out[p++] = (a << 2) | (b >> 4);
    if (p < len) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < len) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}
