export type ApngFrame = {
  rgba: Uint8ClampedArray | Uint8Array;
  duration: number;
};

const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const maxTotalPixels = 16_000_000;

function integerInRange(value: number, min: number, max: number, name: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}`);
  }
}

/** PNG's CRC-32 (including both the chunk type and its payload). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(12 + data.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) bytes[4 + i] = type.charCodeAt(i);
  bytes.set(data, 8);
  view.setUint32(8 + data.length, crc32(bytes.subarray(4, 8 + data.length)));
  return bytes;
}

/** Encode full-canvas RGBA frames locally; no canvas, network, or dependencies. */
export async function encodeApng(
  width: number,
  height: number,
  frames: readonly ApngFrame[],
  plays = 0,
): Promise<Blob> {
  integerInRange(width, 1, 512, 'width');
  integerInRange(height, 1, 512, 'height');
  integerInRange(frames.length, 1, 100, 'frame count');
  integerInRange(plays, 0, 0xffffffff, 'plays');
  if (width * height * frames.length > maxTotalPixels) {
    throw new RangeError(`Animation must not exceed ${maxTotalPixels} total pixels`);
  }
  for (const frame of frames) {
    integerInRange(frame.duration, 1, 60000, 'duration');
    if (!(frame.rgba instanceof Uint8Array || frame.rgba instanceof Uint8ClampedArray)
      || frame.rgba.length !== width * height * 4) {
      throw new RangeError('RGBA data must contain exactly width × height × 4 bytes');
    }
  }
  // Snapshot every frame and its timing before the first await, not just the current frame.
  const snapshots = frames.map(({ rgba, duration }) => ({ rgba: new Uint8Array(rgba), duration }));
  const parts: BlobPart[] = [signature];
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8;
  header[9] = 6; // RGBA; compression, filtering and interlace methods remain zero.
  parts.push(chunk('IHDR', header));
  const animation = new Uint8Array(8);
  const animationView = new DataView(animation.buffer);
  animationView.setUint32(0, snapshots.length);
  animationView.setUint32(4, plays);
  parts.push(chunk('acTL', animation));

  let sequence = 0;
  for (let index = 0; index < snapshots.length; index++) {
    const frame = snapshots[index];
    const control = new Uint8Array(26);
    const controlView = new DataView(control.buffer);
    controlView.setUint32(0, sequence++);
    controlView.setUint32(4, width);
    controlView.setUint32(8, height);
    // Full canvas at offset (0, 0), dispose NONE, blend SOURCE (including transparent pixels).
    controlView.setUint16(20, frame.duration);
    controlView.setUint16(22, 1000);
    parts.push(chunk('fcTL', control));

    const stride = width * 4;
    const scanlines = new Uint8Array((stride + 1) * height);
    for (let y = 0; y < height; y++) {
      // The zero-initialized leading byte of each row selects PNG filter NONE.
      scanlines.set(frame.rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
    }
    const compressed = new Uint8Array(await new Response(
      new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate')),
    ).arrayBuffer());
    if (index === 0) {
      parts.push(chunk('IDAT', compressed));
    } else {
      const data = new Uint8Array(4 + compressed.length);
      new DataView(data.buffer).setUint32(0, sequence++);
      data.set(compressed, 4);
      parts.push(chunk('fdAT', data));
    }
  }
  parts.push(chunk('IEND', new Uint8Array()));
  return new Blob(parts, { type: 'image/apng' });
}
