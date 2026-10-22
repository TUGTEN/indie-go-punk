import type { CompositionAssets, CompositionSettings, CompositionText, Rect } from './types';
import { drawPixelText } from './pixel-type';

const WIDTH = 1280;
const HEIGHT = 720;
const PAD = 24;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Expected a finite number');
  return Math.max(min, Math.min(max, value));
}

/** All layout edges are physical pixels, shared by preview and export. */
export function compositionLayout(settings: CompositionSettings): {
  bubble: Rect; portrait: Rect; gameplay: Rect; gameTitle: Rect; nameplate: Rect;
  tail: { x: number; y: number };
} {
  const margin = Math.round(clamp(settings.layout.margin, 16, 56));
  const gutter = Math.round(clamp(settings.layout.gutter, 12, 40));
  const available = WIDTH - margin * 2 - gutter;
  const left = Math.round(available * clamp(settings.layout.split, 0.38, 0.56));
  const rightX = margin + left + gutter;
  const rightWidth = WIDTH - margin - rightX;
  const banner = settings.layout.arrangement === 'Banner';
  const gameTitle = {
    x: rightX, y: HEIGHT - margin - Math.round(clamp(settings.layout.titleHeight, 96, 240)),
    width: rightWidth, height: Math.round(clamp(settings.layout.titleHeight, 96, 240)),
  };
  // A banner must leave usable portrait space and at least 64px of gameplay above the title.
  const maxBubbleHeight = banner
    ? Math.min(HEIGHT - margin * 2 - gutter - 160, gameTitle.y - gutter * 2 - margin - 64)
    : 300;
  const bubble = {
    x: margin, y: margin, width: banner ? WIDTH - margin * 2 : left,
    height: Math.round(clamp(settings.layout.bubbleHeight, 140, maxBubbleHeight)),
  };
  const gameplayY = banner ? bubble.y + bubble.height + gutter : margin;
  const aspect = clamp(settings.gameplay.aspect, 0.75, 2.4);
  const maxHeight = gameTitle.y - gutter - gameplayY;
  const width = Math.floor(Math.min(rightWidth * clamp(settings.gameplay.width, 0.5, 1), maxHeight * aspect));
  const gameplay = { x: WIDTH - margin - width, y: gameplayY, width, height: Math.floor(width / aspect) };
  const nameHeight = settings.layout.attribution === 'Nameplate' ? 104 : 0;
  const nameplate = { x: margin, y: HEIGHT - margin - nameHeight, width: left, height: nameHeight };
  const portrait = { x: margin, y: bubble.y + bubble.height + gutter, width: left, height: HEIGHT - margin - bubble.y - bubble.height - gutter };
  const tail = {
    x: Math.round(bubble.x + 24 + (left - 72) * clamp(settings.layout.tailX, 0, 1)),
    y: bubble.y + bubble.height,
  };
  if (settings.layout.arrangement === 'Reversed') {
    const mirror = (rect: Rect): Rect => ({ ...rect, x: WIDTH - rect.x - rect.width });
    return {
      bubble: mirror(bubble), portrait: mirror(portrait), gameplay: mirror(gameplay),
      gameTitle: mirror(gameTitle), nameplate: mirror(nameplate),
      tail: { x: WIDTH - tail.x - 32, y: tail.y },
    };
  }
  return { bubble, portrait, gameplay, gameTitle, nameplate, tail };
}

/** Cover crop in source coordinates. Pan endpoints reach, but never exceed, source edges. */
export function coverRect(
  sourceWidth: number, sourceHeight: number, target: Rect, zoom: number, x: number, y: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (![sourceWidth, sourceHeight, target.width, target.height].every(n => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Source and target dimensions must be positive');
  }
  const scale = Math.max(target.width / sourceWidth, target.height / sourceHeight) * clamp(zoom, 1, 3);
  const sw = Math.min(sourceWidth, target.width / scale);
  const sh = Math.min(sourceHeight, target.height / scale);
  return {
    sx: (sourceWidth - sw) * (clamp(x, -100, 100) + 100) / 200,
    sy: (sourceHeight - sh) * (clamp(y, -100, 100) + 100) / 200,
    sw, sh,
  };
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const image = source as unknown as {
    naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number;
    displayWidth?: number; displayHeight?: number; width: number; height: number;
  };
  return {
    width: image.naturalWidth ?? image.videoWidth ?? image.displayWidth ?? image.width,
    height: image.naturalHeight ?? image.videoHeight ?? image.displayHeight ?? image.height,
  };
}

function steppedPath(ctx: CanvasRenderingContext2D, r: Rect, step = 8): void {
  ctx.beginPath();
  ctx.moveTo(r.x + step, r.y);
  ctx.lineTo(r.x + r.width - step, r.y);
  ctx.lineTo(r.x + r.width - step, r.y + step);
  ctx.lineTo(r.x + r.width, r.y + step);
  ctx.lineTo(r.x + r.width, r.y + r.height - step);
  ctx.lineTo(r.x + r.width - step, r.y + r.height - step);
  ctx.lineTo(r.x + r.width - step, r.y + r.height);
  ctx.lineTo(r.x + step, r.y + r.height);
  ctx.lineTo(r.x + step, r.y + r.height - step);
  ctx.lineTo(r.x, r.y + r.height - step);
  ctx.lineTo(r.x, r.y + step);
  ctx.lineTo(r.x + step, r.y + step);
  ctx.closePath();
}

/** Original block-built bust, deliberately an illustration rather than a stock photograph. */
function placeholderPortrait(ctx: CanvasRenderingContext2D, paper: string, ink: string): void {
  ctx.fillStyle = ink;
  for (const [x, y, w, h] of [[29, 8, 38, 8], [21, 16, 54, 48], [29, 64, 38, 16], [37, 80, 22, 14], [21, 94, 54, 10], [9, 104, 78, 48], [1, 124, 94, 36]]) {
    ctx.fillRect(x!, y!, w!, h!);
  }
  ctx.fillStyle = paper;
  ctx.fillRect(29, 32, 38, 32);
  ctx.fillRect(37, 64, 22, 8);
  ctx.fillRect(29, 104, 8, 40);
  ctx.fillRect(59, 104, 8, 40);
  ctx.fillStyle = ink;
  ctx.fillRect(29, 40, 14, 8);
  ctx.fillRect(53, 40, 14, 8);
  ctx.fillRect(43, 40, 10, 4);
  ctx.fillRect(43, 58, 12, 4);
}

export function renderComposition(
  canvas: HTMLCanvasElement, background: HTMLCanvasElement, assets: CompositionAssets,
  text: CompositionText, settings: CompositionSettings,
): { truncated: string[] } {
  if (canvas.width !== WIDTH) canvas.width = WIDTH;
  if (canvas.height !== HEIGHT) canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas2D is unavailable');
  const layout = compositionLayout(settings);
  const { ink, paper } = settings.screen;
  const truncated: string[] = [];
  const depth = clamp(settings.typography.panelDepth, 0, 4);
  const panel = (rect: Rect) => {
    ctx.save();
    ctx.fillStyle = ink;
    ctx.shadowColor = 'rgba(23,60,28,0.18)';
    ctx.shadowOffsetX = 3 * depth;
    ctx.shadowOffsetY = 5 * depth;
    ctx.shadowBlur = 3 * depth;
    steppedPath(ctx, rect);
    ctx.fill();
    ctx.restore();
  };
  const label = (key: string, value: string, rect: Rect, size: number) => {
    if (!value.trim()) return;
    const result = drawPixelText(ctx, value, rect.x, rect.y, rect.width, rect.height, Math.round(clamp(size, 1, 12)), paper);
    if (result.truncated) truncated.push(key);
  };
  const inset = (rect: Rect): Rect => ({ x: rect.x + PAD, y: rect.y + PAD, width: rect.width - PAD * 2, height: rect.height - PAD * 2 });
  ctx.save();
  try {
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);

    // Clip before transforms: offsets/zoom cannot invade either column or the bubble.
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.portrait.x, layout.portrait.y, layout.portrait.width, layout.portrait.height);
    ctx.clip();
    const source = assets.portrait;
    const size = source ? sourceSize(source) : { width: 96, height: 160 };
    if (size.width > 0 && size.height > 0) {
      const scale = Math.min(layout.portrait.width / size.width, layout.portrait.height / size.height) * clamp(settings.portrait.zoom, 0.5, 2.2);
      const w = size.width * scale;
      const h = size.height * scale;
      const x = Math.round(layout.portrait.x + (layout.portrait.width - w) / 2 + settings.portrait.x);
      const y = Math.round(layout.portrait.y + layout.portrait.height - h + settings.portrait.y);
      ctx.translate(x + (settings.portrait.flip ? w : 0), y);
      ctx.scale(settings.portrait.flip ? -scale : scale, scale);
      if (source) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(source, 0, 0, size.width, size.height); }
      else placeholderPortrait(ctx, paper, ink);
    }
    ctx.restore();

    const game = layout.gameplay;
    panel(game);
    ctx.save();
    steppedPath(ctx, game, settings.gameplay.pixelFrame ? 8 : 0);
    ctx.clip();
    const frame = settings.gameplay.pixelFrame ? 8 : 0;
    const target = { x: game.x + frame, y: game.y + frame, width: game.width - frame * 2, height: game.height - frame * 2 };
    ctx.beginPath();
    ctx.rect(target.x, target.y, target.width, target.height);
    ctx.clip();
    if (assets.gameplay) {
      const size = sourceSize(assets.gameplay);
      if (size.width > 0 && size.height > 0) {
        const crop = coverRect(size.width, size.height, target, settings.gameplay.zoom, settings.gameplay.x, settings.gameplay.y);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(assets.gameplay, crop.sx, crop.sy, crop.sw, crop.sh, target.x, target.y, target.width, target.height);
      }
    } else {
      ctx.fillStyle = paper;
      ctx.fillRect(target.x, target.y, target.width, target.height);
      ctx.fillStyle = ink;
      for (let y = target.y; y < target.y + target.height; y += 32) {
        for (let x = target.x; x < target.x + target.width; x += 32) {
          if (((x - target.x) / 32 + (y - target.y) / 32) % 2 === 0) ctx.fillRect(x, y, 12, 12);
        }
      }
      const band = { x: target.x + 12, y: Math.round(target.y + target.height / 2 - 28), width: target.width - 24, height: 56 };
      ctx.fillRect(band.x, band.y, band.width, band.height);
      drawPixelText(ctx, 'GAMEPLAY', band.x + 8, band.y + 8, band.width - 16, 40, 4, paper);
    }
    ctx.restore();

    // Tail and all negative-text panels are opaque ink; letters are solid paper, not cutouts.
    ctx.save();
    ctx.fillStyle = ink;
    ctx.shadowColor = 'rgba(23,60,28,0.18)';
    ctx.shadowOffsetX = 3 * depth;
    ctx.shadowOffsetY = 5 * depth;
    ctx.shadowBlur = 3 * depth;
    ctx.beginPath();
    // Mirror only the tail's local path, never the portrait or gameplay pixels.
    const tailX = (offset: number) => layout.tail.x + (settings.layout.arrangement === 'Reversed' ? 32 - offset : offset);
    ctx.moveTo(tailX(0), layout.tail.y - 8);
    ctx.lineTo(tailX(32), layout.tail.y - 8);
    ctx.lineTo(tailX(32), layout.tail.y + 8);
    ctx.lineTo(tailX(24), layout.tail.y + 8);
    ctx.lineTo(tailX(24), layout.tail.y + 16);
    ctx.lineTo(tailX(16), layout.tail.y + 16);
    ctx.lineTo(tailX(16), layout.tail.y + 24);
    ctx.lineTo(tailX(0), layout.tail.y + 24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    panel(layout.bubble);
    panel(layout.gameTitle);
    if (layout.nameplate.height) panel(layout.nameplate);

    const quote = inset(layout.bubble);
    const inBubble = settings.layout.attribution === 'In bubble';
    const attribution = inset(inBubble ? layout.bubble : layout.nameplate);
    const attributionHeight = text.role.trim() ? 56 : 32;
    if (inBubble && (text.person.trim() || text.role.trim())) {
      quote.height = Math.max(1, quote.height - attributionHeight - 12);
      attribution.y = layout.bubble.y + layout.bubble.height - PAD - attributionHeight;
      attribution.height = attributionHeight;
    }
    label('quote', text.quote, quote, settings.typography.quoteSize);
    label('game', text.game, inset(layout.gameTitle), settings.typography.gameSize);
    const personHeight = text.role.trim() ? Math.min(27, attribution.height - 24) : attribution.height;
    label('person', text.person, { ...attribution, height: personHeight }, settings.typography.nameSize);
    if (text.role.trim()) label('role', text.role, { ...attribution, y: attribution.y + personHeight + 8, height: attribution.height - personHeight - 8 }, Math.max(1, settings.typography.nameSize - 1));
    return { truncated };
  } finally {
    ctx.restore();
  }
}
