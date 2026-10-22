import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, encodeApng, type ApngFrame } from './apng';

// Independent polynomial long division, rather than the encoder's reflected CRC loop.
function referenceCrc(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    let reversed = 0;
    for (let bit = 0; bit < 8; bit++) reversed = (reversed << 1) | ((byte >>> bit) & 1);
    crc ^= reversed << 24;
    for (let bit = 0; bit < 8; bit++) crc = (crc << 1) ^ (crc < 0 ? 0x04c11db7 : 0);
  }
  let reversed = 0;
  for (let bit = 0; bit < 32; bit++) reversed = (reversed << 1) | ((crc >>> bit) & 1);
  return (reversed ^ 0xffffffff) >>> 0;
}

async function parse(blob: Blob) {
  expect(blob.type).toBe('image/apng');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  const chunks: { type: string; data: Uint8Array; view: DataView }[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    expect(offset + 12).toBeLessThanOrEqual(bytes.length);
    const length = view.getUint32(offset);
    expect(offset + 12 + length).toBeLessThanOrEqual(bytes.length);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    expect(view.getUint32(offset + 8 + length)).toBe(referenceCrc(bytes.subarray(offset + 4, offset + 8 + length)));
    chunks.push({ type, data, view: new DataView(data.buffer) });
    offset += length + 12;
  }
  expect(offset).toBe(bytes.length);
  return chunks;
}

const pixel = (): ApngFrame => ({ rgba: new Uint8Array([255, 0, 127, 255]), duration: 100 });

describe('APNG encoder', () => {
  it('matches the standard CRC-32 vector', () => {
    const bytes = new TextEncoder().encode('123456789');
    expect(crc32(bytes)).toBe(0xcbf43926);
    expect(referenceCrc(bytes)).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('writes full-canvas frames, sequential controls, exact delays, loops, and independent zlib streams', async () => {
    const frames: ApngFrame[] = [
      { rgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 1, 2, 3, 128]), duration: 1 },
      { rgba: new Uint8ClampedArray([9, 8, 7, 0, 0, 0, 0, 0, 4, 5, 6, 128, 0, 0, 0, 0]), duration: 60000 },
      { rgba: new Uint8Array(16).fill(42), duration: 1234 },
    ];
    const chunks = await parse(await encodeApng(2, 2, frames, 0xffffffff));
    expect(chunks.map(({ type }) => type)).toEqual(['IHDR', 'acTL', 'fcTL', 'IDAT', 'fcTL', 'fdAT', 'fcTL', 'fdAT', 'IEND']);
    expect(Array.from(chunks[0].data)).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 8, 6, 0, 0, 0]);
    expect(chunks[1].data.length).toBe(8);
    expect(chunks[1].view.getUint32(0)).toBe(3);
    expect(chunks[1].view.getUint32(4)).toBe(0xffffffff);
    expect(chunks.filter(({ type }) => type === 'fcTL' || type === 'fdAT').map(({ view }) => view.getUint32(0))).toEqual([0, 1, 2, 3, 4]);
    for (let i = 0; i < frames.length; i++) {
      const control = chunks[2 + i * 2];
      expect(control.data.length).toBe(26);
      expect(control.view.getUint32(4)).toBe(2);
      expect(control.view.getUint32(8)).toBe(2);
      expect(control.view.getUint32(12)).toBe(0);
      expect(control.view.getUint32(16)).toBe(0);
      expect(control.view.getUint16(20)).toBe(frames[i].duration);
      expect(control.view.getUint16(22)).toBe(1000);
      expect(control.data[24]).toBe(0); // dispose NONE
      expect(control.data[25]).toBe(0); // blend SOURCE: transparent pixels clear previous pixels
      const compressed = chunks[3 + i * 2].data;
      const decoded = inflateSync(i === 0 ? compressed : compressed.subarray(4));
      expect(Array.from(decoded)).toEqual([0, ...frames[i].rgba.slice(0, 8), 0, ...frames[i].rgba.slice(8)]);
    }
    expect(chunks.at(-1)?.data.length).toBe(0);
  });

  it.each([0, 1, 7])('supports one frame and plays=%s', async (plays) => {
    const chunks = await parse(await encodeApng(1, 1, [pixel()], plays));
    expect(chunks.map(({ type }) => type)).toEqual(['IHDR', 'acTL', 'fcTL', 'IDAT', 'IEND']);
    expect(chunks[1].view.getUint32(4)).toBe(plays);
  });

  it('defaults to infinite looping and snapshots every frame before any await', async () => {
    const first = pixel();
    const second = pixel();
    const frames = [first, second];
    const pending = encodeApng(1, 1, frames);
    first.rgba.fill(0);
    second.rgba.fill(0);
    second.duration = 60000;
    frames.splice(0, frames.length, pixel());
    const chunks = await parse(await pending);
    expect(chunks[1].view.getUint32(0)).toBe(2);
    expect(chunks[1].view.getUint32(4)).toBe(0);
    expect(chunks[4].view.getUint16(20)).toBe(100);
    expect(Array.from(inflateSync(chunks[3].data))).toEqual([0, 255, 0, 127, 255]);
    expect(Array.from(inflateSync(chunks[5].data.subarray(4)))).toEqual([0, 255, 0, 127, 255]);
  });

  it.each([0, -1, 513, 1.5, NaN, Infinity, -Infinity])('rejects invalid dimension %s', async (value) => {
    await expect(encodeApng(value, 1, [pixel()])).rejects.toThrow(RangeError);
    await expect(encodeApng(1, value, [pixel()])).rejects.toThrow(RangeError);
  });

  it.each([0, -1, 60001, 1.5, NaN, Infinity, -Infinity])('rejects invalid duration %s', async (duration) => {
    await expect(encodeApng(1, 1, [{ ...pixel(), duration }])).rejects.toThrow(RangeError);
  });

  it.each([-1, 0x100000000, 0.5, NaN, Infinity])('rejects invalid plays %s', async (plays) => {
    await expect(encodeApng(1, 1, [pixel()], plays)).rejects.toThrow(RangeError);
  });

  it('rejects empty or excessive frames, mismatched pixels and excessive total pixels', async () => {
    await expect(encodeApng(1, 1, [])).rejects.toThrow(RangeError);
    await expect(encodeApng(1, 1, Array.from({ length: 101 }, pixel))).rejects.toThrow(RangeError);
    for (const length of [0, 3, 5]) {
      await expect(encodeApng(1, 1, [{ rgba: new Uint8Array(length), duration: 1 }])).rejects.toThrow(RangeError);
    }
    await expect(encodeApng(512, 512, Array(62).fill(pixel()))).rejects.toThrow(/total pixels/);
  });

  it('accepts the frame-count and dimension boundaries independently', async () => {
    const many = await parse(await encodeApng(1, 1, Array.from({ length: 100 }, pixel)));
    expect(many[1].view.getUint32(0)).toBe(100);
    const wide = await parse(await encodeApng(512, 512, [{ rgba: new Uint8Array(512 * 512 * 4), duration: 1 } ]));
    expect(wide[0].view.getUint32(0)).toBe(512);
    expect(wide[0].view.getUint32(4)).toBe(512);
  });
});
