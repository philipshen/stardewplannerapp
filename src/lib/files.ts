/** Cross-platform helpers to share/download generated files and pick a plan file to import. */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

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

export async function pickJSON(): Promise<unknown | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  let text: string;
  if (Platform.OS === 'web') {
    const file = (asset as any).file as Blob | undefined;
    text = file ? await file.text() : await (await fetch(asset.uri)).text();
  } else {
    text = await new File(asset.uri).text();
  }
  return JSON.parse(text);
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
