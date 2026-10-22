import { describe, expect, it } from 'vitest';
import { effects, framePlan, iconArtworkSvg, type ArtworkOptions, type IconEffect } from './artwork';
import { icons, type PixelIcon } from './library';

const defaults: ArtworkOptions = {
  size: 240, ink: '#2D612D', paper: '#477E43', surface: 'LCD',
  depth: 1, glow: 1, effect: 'None', phase: 0, background: true,
};
const render = (options: Partial<ArtworkOptions> = {}, icon: PixelIcon = icons[0]) =>
  iconArtworkSvg(icon, { ...defaults, ...options });
const layer = (svg: string, name: string) => svg.match(new RegExp(`<use data-layer="${name}"[^>]*>`))?.[0];
const ids = (svg: string) => Array.from(svg.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
const glyph = (svg: string) => svg.match(/<path id="[^"]+-glyph" d="([^"]*)"/)![1];

describe('iconArtworkSvg', () => {
  it('is deterministic, standalone, framed, and independent of previous calls', () => {
    const svg = render();
    render({ phase: 0.8, effect: 'Glitch' });
    expect(render()).toBe(svg);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 20 20"');
    expect(svg).toContain('transform="translate(2 2)"');
    expect(svg).toContain('<title');
    expect(svg).not.toMatch(/<animate|<script|<style|@keyframes/);
    expect((glyph(svg).match(/M/g) || []).length).toBe(icons[0].rows.join('').split('#').length - 1);
  });

  it.each([[0, 16], [15.9, 16], [17.6, 18], [9000, 2048], [NaN, 192], [Infinity, 192]])(
    'clamps and rounds output size %s to %s', (size, expected) => {
      expect(render({ size })).toContain(`width="${expected}" height="${expected}"`);
    },
  );

  it('validates colors and safely escapes text and definition identifiers', () => {
    const svg = render({ ink: '#fff', paper: '\"><script>bad</script>', phase: NaN, depth: Infinity, glow: NaN },
      { ...icons[0], id: 'a/\"><script>', name: '<img onerror="bad"> & \'name\'' });
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<img');
    expect(svg).toContain('&lt;img onerror=&quot;bad&quot;&gt; &amp; &apos;name&apos;');
    expect(svg).toContain('fill="#477E43"');
    expect(svg).toContain('fill="#2D612D"');
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    for (const id of ids(svg)) expect(id).toMatch(/^[a-zA-Z][\w-]*$/);
  });

  it('has unique local ids, resolves every reference, and avoids sanitized-id collisions', () => {
    const allIds: string[] = [];
    for (const icon of [...icons, { ...icons[0], id: 'a/b' }, { ...icons[0], id: 'a b' }]) {
      const svg = render({}, icon);
      const localIds = ids(svg);
      allIds.push(...localIds);
      const refs = Array.from(svg.matchAll(/(?:href="#|url\(#)([^"\)]+)/g), (match) => match[1]);
      for (const ref of refs) expect(localIds).toContain(ref);
    }
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('isolates different captured frames and color variants of the same icon', () => {
    const restIds = ids(render());
    for (const options of [{ ink: '#123456' }, { effect: 'Glitch' as const, phase: 0.8 }]) {
      expect(ids(render(options)).some((id) => restIds.includes(id))).toBe(false);
    }
  });
  it('uses the calibrated rear shadow below an unfiltered sharp foreground', () => {
    const svg = render();
    expect(layer(svg, 'rear-shadow')).toContain('fill="#173C1C" opacity=".18"');
    expect(layer(svg, 'rear-shadow')).toContain('translate(0.25 0.4167)');
    expect(svg).toContain('stdDeviation="0.25"');
    expect(svg.indexOf('data-layer="rear-shadow"')).toBeLessThan(svg.indexOf('data-layer="front"'));
    expect(layer(svg, 'front')).not.toContain('filter=');
    expect(svg).not.toMatch(/<g[^>]*filter=/);
    expect(render({ depth: 2 })).toContain('translate(0.5 0.8333)');
    expect(render({ depth: 5 })).toBe(render({ depth: 2 }));
    expect(layer(render({ depth: -1 }), 'rear-shadow')).toBeUndefined();
    expect(layer(render({ surface: 'Flat' }), 'rear-shadow')).toBeUndefined();
  });

  it('keeps transparent LCD shadows without painting any screen lighting', () => {
    const svg = render({ background: false, surface: 'Backlit' });
    const visible = svg.split('</defs>')[1];
    expect(layer(svg, 'rear-shadow')).toBeDefined();
    expect(visible).not.toContain('<rect');
    expect(visible).not.toContain('-light');
    expect(layer(svg, 'front')).toContain('fill="#2D612D"');
    expect(render({ surface: 'Backlit' }).split('</defs>')[1]).toContain('-light');
    expect(render({ grid: true })).toContain('width="16" height="16"');
  });
});

const animated = effects.filter((effect): effect is Exclude<IconEffect, 'None'> => effect !== 'None');
const positions = (svg: string) => Array.from(glyph(svg).matchAll(/M(-?\d+) (\d+)/g), (m) => [Number(m[1]), Number(m[2])]);

describe('sampled one-shot motion', () => {
  it.each(effects)('%s preserves static reduced-motion and endpoint frames', (effect) => {
    const rest = render({ effect });
    expect(rest).toBe(render());
    for (const phase of [-1, NaN, Infinity, 0.9, 0.99, 1, 2]) {
      expect(render({ effect, phase })).toBe(rest);
    }
    if (effect === 'None') for (const phase of [0.01, 0.5, 0.79]) expect(render({ effect, phase })).toBe(rest);
  });

  it.each(animated)('%s starts immediately and stays materially active at midpoint', (effect) => {
    for (const phase of [0.01, 0.02, 0.5, 0.79]) {
      const svg = render({ effect, phase });
      const rest = render();
      // Ignore frame namespaces: visible geometry or actual paint must change.
      const visible = (s: string) => s.replace(/pixel-[\w-]+/g, 'pixel-id');
      expect(visible(svg)).not.toBe(visible(rest));
      expect(render({ effect, phase })).toBe(svg);
      expect(svg).not.toMatch(/<animate|<script|<style|@keyframes/);
    }
  });

  it.each(animated)('%s has exactly one contiguous episode, never a repeated strobe', (effect) => {
    const rest = JSON.stringify(framePlan(effect, 0));
    let episodes = 0;
    let wasActive = false;
    for (let i = 0; i <= 1000; i++) {
      const active = JSON.stringify(framePlan(effect, i / 1000)) !== rest;
      if (active && !wasActive) episodes++;
      wasActive = active;
    }
    expect(episodes).toBe(1);
  });

  it('blinks once dramatically to .12, then recovers monotonically', () => {
    expect(framePlan('Blink', 0.01).opacity).toBe(0.12);
    expect(framePlan('Blink', 0.5).opacity).toBe(0.12);
    let previous = 0.12;
    for (let i = 1; i <= 1000; i++) {
      const opacity = framePlan('Blink', i / 1000).opacity;
      expect(opacity).toBeGreaterThanOrEqual(previous);
      expect(opacity).toBeLessThanOrEqual(1);
      previous = opacity;
    }
  });

  it('reveals whole 2x2 blocks monotonically from an almost empty frame', () => {
    expect(framePlan('Build', 0.01).build).toBe(0);
    expect(glyph(render({ effect: 'Build', phase: 0.01 }))).toBe('');
    let previous = 0;
    for (let i = 1; i <= 900; i++) {
      const phase = i / 1000;
      const svg = render({ effect: 'Build', phase });
      const cells = positions(svg);
      expect(cells.length).toBeGreaterThanOrEqual(previous);
      const rest = positions(render());
      const block = (x: number, y: number) => Math.floor(y / 2) * 8 + Math.floor(x / 2);
      const blocks = [...new Set(rest.map(([x, y]) => block(x, y)))].sort((a, b) => a - b);
      const revealed = Math.floor(framePlan('Build', phase).build / 64 * blocks.length);
      expect(cells).toEqual(rest.filter(([x, y]) => blocks.indexOf(block(x, y)) < revealed));
      expect(framePlan('Build', phase).opacity).toBe(1);
      previous = cells.length;
    }
    expect(previous).toBe(positions(render()).length);
  });

  it('holds three deterministic hard tear patterns with integer two-cell bands', () => {
    const rest = positions(render());
    const frames = [0.1, 0.4, 0.7].map((phase) => render({ effect: 'Glitch', phase }));
    expect(new Set(frames.map(glyph)).size).toBe(3);
    for (let step = 0; step < 3; step++) {
      expect(framePlan('Glitch', [0.1, 0.4, 0.7][step]).glitchStep).toBe(step);
      expect(render({ effect: 'Glitch', phase: [0.2, 0.5, 0.8][step] })).toBe(frames[step]);
      const offsets = new Set<number>();
      positions(frames[step]).forEach(([x, y], index) => {
        expect(y).toBe(rest[index][1]);
        const offset = x - rest[index][0];
        expect([-2, 0, 2]).toContain(offset);
        offsets.add(offset);
      });
      expect(offsets).toEqual(new Set([-2, 0, 2]));
    }
  });

  it.each([0.02, 0.5, 0.79])('renders three opaque, separated RGB silhouettes at phase %s', (phase) => {
    const svg = render({ effect: 'Glitch', phase });
    const channels = [
      ['red', '#ff2450', -1, 0], ['green', '#2dff83', 1, -1], ['blue', '#397bff', 0, 1],
    ] as const;
    // Cell-center raster coverage: prove each opaque RGB layer has exposed pixels
    // even after subsequent channels and the translucent foreground are painted.
    const cells = positions(svg);
    const coverage = (dx: number, dy: number) => new Set(cells.map(([x, y]) => `${x + dx},${y + dy}`));
    const masks = channels.map(([, , x, y]) => coverage(x, y));
    const front = coverage(0, 0);
    channels.forEach(([name, fill, x, y], index) => {
      const use = layer(svg, `glitch-${name}`)!;
      expect(use).toContain(`fill="${fill}"`);
      expect(use).toContain(`translate(${x} ${y})`);
      expect(use).toContain('shape-rendering="crispEdges"');
      expect(use).not.toMatch(/filter=|opacity=/);
      const exposed = [...masks[index]].filter((cell) => !front.has(cell) && !masks.slice(index + 1).some((mask) => mask.has(cell)));
      expect(exposed.length).toBeGreaterThan(3);
    });
    expect(layer(svg, 'front')).toContain('opacity=".18"');
    expect(layer(svg, 'front')).not.toContain('filter=');
  });

  it('scans once with a bright two-cell highlight and a separate sharp leading band', () => {
    let previous = 0;
    for (const phase of [0.01, 0.2, 0.5, 0.79, 0.89]) {
      const svg = render({ effect: 'Scan', phase });
      const rows = [...new Set(positions(svg).map(([, y]) => y))];
      const scan = rows[Math.floor(framePlan('Scan', phase).scan / 15 * rows.length)];
      expect(scan).toBeGreaterThanOrEqual(previous);
      expect(svg).toContain(`y="${scan}" width="20" height="2"`);
      expect(svg).toContain(`y="${scan}" width="20" height="0.25"`);
      expect(layer(svg, 'scan')).toContain('fill="#FFF4CE" opacity=".9"');
      expect(layer(svg, 'scan-edge')).toContain('fill="#ffffff"');
      previous = scan;
    }
  });

  it('hits with one broad contrasting flash and two-cell knockback, then settles', () => {
    for (const phase of [0.01, 0.2, 0.5]) {
      expect(framePlan('Hit', phase).knock).toBe(-2);
      expect(layer(render({ effect: 'Hit', phase }), 'front')).toContain('fill="#FFF4CE"');
      expect(positions(render({ effect: 'Hit', phase }))).toEqual(positions(render()).map(([x, y]) => [x - 2, y]));
    }
    expect(framePlan('Hit', 0.79)).toMatchObject({ hit: false, knock: -1 });
    const flashes = Array.from({ length: 1000 }, (_, i) => framePlan('Hit', i / 1000).hit);
    expect(flashes.filter((on, i) => on && !flashes[i - 1])).toHaveLength(1);
  });

  it('travels two cells with two trailing silhouettes, then steps home', () => {
    const svg = render({ effect: 'Ghost', phase: 0.5 });
    expect(framePlan('Ghost', 0.5).ghost).toBe(2);
    expect(positions(svg)).toEqual(positions(render()).map(([x, y]) => [x + 2, y]));
    expect(layer(svg, 'ghost')).toContain('translate(-2 0)');
    expect(layer(svg, 'ghost')).toContain('opacity=".35"');
    expect(layer(svg, 'ghost-far')).toContain('translate(-4 0)');
    expect(layer(svg, 'ghost-far')).toContain('opacity=".18"');
    expect(framePlan('Ghost', 0.79).ghost).toBe(1);
    expect(framePlan('Ghost', 0.9).ghost).toBe(0);
  });
});
