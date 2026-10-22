import { useRef, useState, type CSSProperties } from 'react';
import { useDialKitController, type DialConfig } from 'dialkit';
import { DialControls } from '../DialControls';
import { screenPalettes } from '../palettes';
import { icons, iconPath, iconSvg, drawPixelIcon } from './library';
import { PixelGlyph } from './PixelGlyph';
import { ArtworkGlyph } from './ArtworkGlyph';
import { IconMotionPreview, type FrameHandle } from './IconMotionPreview';
import type { Surface, IconEffect } from './artwork';
import './icons.css';

const controls = {
  appearance: {
    ink: '#2d612d', paper: '#477e43',
    surface: { type: 'select', options: ['Flat', 'LCD', 'Backlit'], default: 'LCD' },
    depth: [1, 0, 2, 0.05], glow: [0.45, 0, 1, 0.05],
    pixelScale: [8, 1, 20, 1],
    grid: false, transparentPng: true,
  },
} satisfies DialConfig;
const palettes = screenPalettes;
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export default function IconLab() {
  const dial = useDialKitController('Pixel icon controls', controls, { id: 'pixel-icons-v2', persist: true });
  const v = dial.values.appearance;
  const frame = useRef<FrameHandle>(null);
  const [capturing, setCapturing] = useState(false);
  const [animatingExport, setAnimatingExport] = useState(false);
  const [loopExport, setLoopExport] = useState(true);
  const [animatedEffect, setAnimatedEffect] = useState<IconEffect>('Glitch');
  const look = { ink: v.ink, paper: v.paper, surface: v.surface as Surface, depth: v.depth, glow: v.glow };
  const [selected, setSelected] = useState(icons[0]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const categories = ['All', ...new Set(icons.map(icon => icon.category))];
  const visible = icons.filter(icon => (category === 'All' || icon.category === category) && `${icon.name} ${icon.category}`.toLowerCase().includes(search.toLowerCase()));
  const style = { '--screen-glow': v.glow, '--icon-ink': v.ink, '--icon-paper': v.paper, '--icon-label': (parseInt(v.paper.slice(1, 3), 16) * 0.299 + parseInt(v.paper.slice(3, 5), 16) * 0.587 + parseInt(v.paper.slice(5, 7), 16) * 0.114) > 140 ? '#1b2119' : '#f4f0dc' } as CSSProperties;
  function svgExport() {
    download(new Blob([iconSvg(selected, v.ink, v.pixelScale)], { type: 'image/svg+xml' }), `igp-${selected.id}.svg`);
    setNotice(`${selected.name} SVG downloaded.`);
  }
  async function copySvg() {
    try { await navigator.clipboard.writeText(iconSvg(selected, v.ink, v.pixelScale)); setNotice('SVG copied to clipboard.'); }
    catch { setError('Clipboard unavailable. Download the SVG instead.'); }
  }
  function pngExport() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16 * v.pixelScale;
    const ctx = canvas.getContext('2d')!;
    if (!v.transparentPng) { ctx.fillStyle = v.paper; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    drawPixelIcon(ctx, selected, 0, 0, v.pixelScale, v.ink);
    canvas.toBlob(blob => {
      if (!blob) { setError('PNG export failed. Try again.'); return; }
      download(blob, `igp-${selected.id}-${canvas.width}px.png`); setNotice(`${selected.name} PNG downloaded.`);
    });
  }
  async function frameExport() {
    if (!frame.current || capturing) return;
    setCapturing(true); setError('');
    // Snapshot the displayed phase before asynchronous image decoding.
    const markup = frame.current.svg(20 * v.pixelScale, !v.transparentPng);
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 20 * v.pixelScale;
      canvas.getContext('2d')!.drawImage(image, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve));
      if (!blob) throw new Error('Frame export failed.');
      download(blob, `igp-${selected.id}-lcd-frame.png`);
      setNotice('Current frame captured with screen depth. PNG is a still image, not an animation.');
    } catch { setError('Could not export the frame. Try again.'); }
    finally { URL.revokeObjectURL(url); setCapturing(false); }
  }
  async function animationExport() {
    if (!frame.current || animatingExport || animatedEffect === 'None') return;
    setAnimatingExport(true); setError('');
    try {
      const blob = await frame.current.animation(20 * v.pixelScale, loopExport, (current, total) => setNotice(`Rendering transparent animation · ${current}/${total} frames`));
      download(blob, `igp-${selected.id}-${animatedEffect.toLowerCase()}.apng`);
      setNotice('Transparent APNG saved with full alpha and the selected motion speed. Loops include a quiet hold.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Animated export failed.'); setNotice(''); }
    finally { setAnimatingExport(false); }
  }
  function sheetExport() {
    const paths = icons.map((icon, i) => `<g transform="translate(${64 + (i % 8) * 152} ${76 + Math.floor(i / 8) * 160}) scale(6)"><path d="${iconPath(icon)}"/></g>`).join('');
    download(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" shape-rendering="crispEdges"><title>Indie Go Punk pixel icon sheet</title><rect width="1280" height="720" fill="${v.paper}"/><g fill="${v.ink}">${paths}</g></svg>`], { type: 'image/svg+xml' }), 'igp-pixel-icons-sheet.svg');
    setNotice('1280 × 720 icon sheet downloaded.');
  }
  return <div className="icon-lab" style={style}>
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">igp<span>✳</span></span><span>INDIE GO PUNK<span className="brand-sub">THUMBNAIL EXPERIMENTS</span></span></a><nav className="lcd-nav" aria-label="Experiments"><a href="/">Cutout</a><a href="/icons" aria-current="page">Icons</a><a href="/lcd">LCD</a><a href="/compose">Compose ↗</a></nav></header>
    <main className="icon-layout">
      <section className="icon-workspace" aria-label="Icon library">
        <div className="icon-heading"><div><span className="eyebrow">THE GAME-DEV TOOLBOX</span><h1>Small pixels. Big character.</h1><p>Original 16 × 16 glyphs for the things we make, play, and talk about.</p></div><span className="icon-edition">{icons.length} ICONS<br/>ONE COLOR<br/>NO SOFT EDGES</span></div>
        <div className="icon-palette" role="group" aria-label="Color presets">{palettes.map(p => <button key={p.name} title={p.name} aria-label={p.name} aria-pressed={p.ink === v.ink && p.paper === v.paper} onClick={() => { dial.setValue('appearance.ink', p.ink); dial.setValue('appearance.paper', p.paper); dial.setValue('appearance.surface', p.surface); }} style={{ background: p.paper, color: p.ink }}><span>▟</span></button>)}<span>CHOOSE A SCREEN →</span></div>
        <div className="icon-search"><label><span className="visually-hidden">Search icons</span><input type="search" placeholder="Find an icon…" value={search} onChange={e => setSearch(e.target.value)} /></label><span>{visible.length} / {icons.length}</span></div>
        <div className="icon-filters" role="group" aria-label="Icon categories">{categories.map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className="icon-grid">{visible.map((icon) => <button key={icon.id} className={`icon-card icon-material ${look.surface.toLowerCase()} ${selected.id === icon.id ? 'is-selected' : ''}`} aria-pressed={selected.id === icon.id} aria-label={`Select ${icon.name}`} onClick={() => { setSelected(icon); setNotice(''); setError(''); if (window.innerWidth <= 780) document.querySelector('.icon-inspector')?.scrollIntoView({ block: 'start' }); }}><span className="icon-index">{String(icons.indexOf(icon) + 1).padStart(2, '0')}</span><ArtworkGlyph icon={icon} options={{ ...look, size: 80, background: false, effect: 'None', phase: 0 }}/><span className="icon-name">{icon.name}</span><span className="icon-category">{icon.category}</span></button>)}</div>
        {visible.length === 0 && <p className="icon-empty">No glyphs found. Try another name or category.</p>}
        <div className="icon-library-note"><span>16 × 16 NATIVE GRID / SVG + PNG</span><button onClick={sheetExport}>Download full SVG sheet ↗</button></div>
      </section>
      <aside className="icon-inspector" aria-label="Selected icon">
        <button className="icon-back" onClick={() => document.querySelector('.icon-filters')?.scrollIntoView({ block: 'start' })}>↑ Back to icons</button>
        <div className="icon-inspector-heading"><span className="eyebrow">GLYPH INSPECTOR</span><h2>{selected.name}</h2><span>{selected.category} / {selected.id}</span></div>
        <IconMotionPreview ref={frame} icon={selected} look={look} grid={v.grid} onEffectChange={setAnimatedEffect}/>
        <p className="icon-material-note">{v.surface === 'Flat' ? 'Flat vector · no screen depth' : v.surface === 'LCD' ? 'Reflective LCD · sharp front, soft displaced rear pixels' : 'Amber backlight · dark pixels, warm screen bloom'}</p>
        <div className="icon-native"><span>NATIVE SIZE</span><PixelGlyph icon={selected} size={16}/><PixelGlyph icon={selected} size={32}/><PixelGlyph icon={selected} size={48}/></div>
        <DialControls />
        <div className="icon-exports"><button className="button primary" onClick={svgExport}>Download SVG ↗</button><button className="button" onClick={pngExport}>PNG · {v.pixelScale * 16} × {v.pixelScale * 16}</button><button className="button icon-frame-export" disabled={capturing} onClick={() => void frameExport()}>{capturing ? 'Capturing…' : 'Capture LCD frame PNG'}</button><button className="button icon-animation-export" disabled={animatingExport || animatedEffect === 'None'} onClick={() => void animationExport()}>{animatingExport ? 'Encoding animation…' : 'Download transparent APNG'}</button><label className="icon-loop-export"><input type="checkbox" checked={loopExport} onChange={e => setLoopExport(e.target.checked)}/> Loop downloaded animation</label><button className="icon-copy" onClick={() => void copySvg()}>Copy SVG code</button><p>SVG / PNG export clean, static glyphs.<br/>Capture saves the shown motion frame with LCD depth; turn Transparent Png off to include the lit screen. APNG exports animate with real transparency and no screen background. Open them in a browser or APNG-compatible editor.</p><div role="status" className="icon-status">{notice}</div>{error && <p role="alert">{error}</p>}</div>
      </aside>
    </main>
    <footer><span>INDIE GO PUNK <span className="footer-star">✳</span> PIXEL FIELD NOTES / 02</span><span>ORIGINAL GLYPHS · LOCAL EXPORTS · BUILT FOR REUSE</span></footer>
  </div>;
}
