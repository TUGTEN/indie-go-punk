/** A deliberately small, native-pixel 5×7 font. Rows are five-bit masks. */
const patterns: Record<string, string> = {
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01111/10000/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '11111/00100/00100/00100/00100/00100/11111',
  J: '00111/00010/00010/00010/10010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11110/00001/00001/01110/00001/00001/11110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/10000/11110/00001/00001/11110',
  '6': '01110/10000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00001/01110',
  '?': '01110/10001/00001/00010/00100/00000/00100',
  '!': '00100/00100/00100/00100/00100/00000/00100',
  '.': '00000/00000/00000/00000/00000/00110/00110',
  ',': '00000/00000/00000/00000/00110/00100/01000',
  ':': '00000/00110/00110/00000/00110/00110/00000',
  ';': '00000/00110/00110/00000/00110/00100/01000',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '/': '00001/00001/00010/00100/01000/10000/10000',
  '\\': '10000/10000/01000/00100/00010/00001/00001',
  '&': '01100/10010/10100/01000/10101/10010/01101',
  '+': '00000/00100/00100/11111/00100/00100/00000',
  '(': '00010/00100/01000/01000/01000/00100/00010',
  ')': '01000/00100/00010/00010/00010/00100/01000',
  "'": '00100/00100/01000/00000/00000/00000/00000',
  '"': '01010/01010/01010/00000/00000/00000/00000',
  '=': '00000/00000/11111/00000/11111/00000/00000',
  '_': '00000/00000/00000/00000/00000/00000/11111',
  '#': '01010/01010/11111/01010/11111/01010/01010',
  '%': '11001/11010/00010/00100/01000/01011/10011',
  '@': '01110/10001/10111/10101/10111/10000/01110',
  '*': '00000/10101/01110/11111/01110/10101/00000',
  '[': '01110/01000/01000/01000/01000/01000/01110',
  ']': '01110/00010/00010/00010/00010/00010/01110',
  '<': '00010/00100/01000/10000/01000/00100/00010',
  '>': '01000/00100/00010/00001/00010/00100/01000',
  '$': '00100/01111/10100/01110/00101/11110/00100',
  '|': '00100/00100/00100/00100/00100/00100/00100',
  ' ': '00000/00000/00000/00000/00000/00000/00000',
};

export const PIXEL_GLYPHS: Readonly<Record<string, readonly number[]>> = Object.freeze(
  Object.fromEntries(Object.entries(patterns).map(([char, rows]) => [
    char, Object.freeze(rows.split('/').map((row) => parseInt(row, 2))),
  ])),
);

export type PixelTextLayout = {
  lines: string[];
  scale: number;
  width: number;
  height: number;
  truncated: boolean;
};

const TEXT_LIMIT = 1000;
const substitutions: Record<string, string> = {
  Æ: 'AE', Œ: 'OE', Ø: 'O', Ł: 'L', Đ: 'D', Ð: 'D', Þ: 'TH',
  '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...',
};

function normalize(text: string): { text: string; capped: boolean } {
  // Bound work before normalization, then again after uppercase expansions.
  const source = text.slice(0, TEXT_LIMIT);
  const normalized = source.replace(/\r\n?/g, '\n').normalize('NFD')
    .replace(/\p{M}/gu, '').toUpperCase();
  const chars: string[] = [];
  for (const char of normalized) {
    const replacement = substitutions[char] ?? (char === '\n' ? '\n'
      : /\s/u.test(char) ? ' ' : PIXEL_GLYPHS[char] ? char : '?');
    chars.push(replacement);
  }
  const result = chars.join('');
  return { text: result.slice(0, TEXT_LIMIT), capped: text.length > TEXT_LIMIT || result.length > TEXT_LIMIT };
}

/** Prefer word boundaries; only the space used as a wrap separator is consumed. */
function wrap(text: string, columns: number): string[] {
  return text.split('\n').flatMap((paragraph) => {
    const lines: string[] = [];
    let remaining = paragraph;
    while (remaining.length > columns) {
      const space = remaining.lastIndexOf(' ', columns);
      const end = space > 0 ? space : columns;
      lines.push(remaining.slice(0, end));
      remaining = remaining.slice(end + (space > 0 ? 1 : 0));
    }
    lines.push(remaining);
    return lines;
  });
}

/** Geometry includes the 6-pixel advance and 9-pixel line box, not just ink. */
export function layoutPixelText(
  text: string, maxWidth: number, maxHeight: number, preferredScale: number,
): PixelTextLayout {
  const preferred = Number.isFinite(preferredScale) ? Math.max(1, Math.floor(preferredScale)) : 1;
  const empty = (truncated: boolean): PixelTextLayout => ({
    lines: [], scale: preferred, width: 0, height: 0, truncated,
  });
  if (!text) return empty(false);
  if (!(maxWidth >= 6) || !(maxHeight >= 9)) return empty(true);
  const normalized = normalize(text);
  if (!normalized.text) return empty(normalized.capped);
  const largest = Math.min(preferred, Number.MAX_SAFE_INTEGER,
    Math.floor(maxWidth / 6), Math.floor(maxHeight / 9));
  const atScale = (scale: number) => wrap(normalized.text,
    Math.min(TEXT_LIMIT, Math.floor(maxWidth / (6 * scale))));
  // Fit is monotonic: larger cells cannot increase columns or available rows.
  let low = 1;
  let high = largest;
  let scale = 1;
  while (low <= high) {
    const candidate = low + Math.floor((high - low) / 2);
    if (atScale(candidate).length <= Math.floor(maxHeight / (9 * candidate))) {
      scale = candidate;
      low = candidate + 1;
    } else {
      high = candidate - 1;
    }
  }
  const columns = Math.min(TEXT_LIMIT, Math.floor(maxWidth / (6 * scale)));
  const rows = Math.floor(maxHeight / (9 * scale));
  let lines = atScale(scale);
  const truncated = lines.length > rows || normalized.capped;
  if (truncated) {
    lines = lines.slice(0, rows);
    const dots = '.'.repeat(Math.min(3, columns));
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, columns - dots.length).trimEnd() + dots;
  }
  return { lines, scale, width: Math.max(...lines.map((line) => line.length)) * 6 * scale,
    height: lines.length * 9 * scale, truncated };
}

/** Paint only integer-aligned native pixel cells; never invokes canvas text APIs. */
export function drawPixelText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  width: number, height: number, scale: number, color: string,
): PixelTextLayout {
  const layout = layoutPixelText(text, width, height, scale);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return layout;
  const left = Math.floor(x);
  const top = Math.floor(y);
  ctx.fillStyle = color;
  layout.lines.forEach((line, lineIndex) => {
    Array.from(line).forEach((char, charIndex) => {
      const glyph = PIXEL_GLYPHS[char] ?? PIXEL_GLYPHS['?'];
      glyph.forEach((bits, row) => {
        for (let column = 0; column < 5; column++) {
          if (bits & (1 << (4 - column))) {
            ctx.fillRect(left + (charIndex * 6 + column) * layout.scale,
              top + (lineIndex * 9 + row) * layout.scale, layout.scale, layout.scale);
          }
        }
      });
    });
  });
  return layout;
}
