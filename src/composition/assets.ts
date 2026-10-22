import { alphaBounds } from '../image-math';
import { decodeFile } from '../renderer';

const databaseName = 'igp-composition-assets';
export type SavedCutout = { blob: Blob; name: string; savedAt: number };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local asset storage is unavailable.'));
    request.onblocked = () => reject(new Error('Local asset storage is blocked by another tab.'));
  });
}
async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('assets', mode); const request = action(tx.objectStore('assets'));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Local asset storage failed.')); };
  });
}
export async function saveCutout(blob: Blob, name: string): Promise<void> {
  await transact('readwrite', store => store.put({ blob, name, savedAt: Date.now() } satisfies SavedCutout, 'latest-cutout'));
}
export async function loadCutout(): Promise<SavedCutout | null> {
  return (await transact<SavedCutout | undefined>('readonly', store => store.get('latest-cutout'))) ?? null;
}
export async function forgetCutout(): Promise<void> {
  await transact('readwrite', store => store.delete('latest-cutout'));
}
export async function decodeCompositionAsset(blob: Blob, trim: boolean): Promise<{ bitmap: ImageBitmap; transparent: boolean }> {
  if (blob.size > 20 * 1024 * 1024) throw new Error('Please use an image smaller than 20 MB.');
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(blob.type)) throw new Error('Use a PNG, JPG, WebP, or AVIF image.');
  const bitmap = await decodeFile(blob);
  if (!trim) return { bitmap, transparent: false };
  try {
    const surface = document.createElement('canvas'); surface.width = bitmap.width; surface.height = bitmap.height;
    const ctx = surface.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, surface.width, surface.height).data;
    const bounds = alphaBounds(pixels, surface.width, surface.height, 8);
    if (!bounds) throw new Error('This image is completely transparent. Choose a visible cutout.');
    let transparent = false;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 240) { transparent = true; break; }
    const trimmed = await createImageBitmap(surface, bounds.x, bounds.y, bounds.width, bounds.height);
    return { bitmap: trimmed, transparent };
  } finally { bitmap.close(); }
}
