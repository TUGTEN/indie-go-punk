import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useDialKitController, type DialConfig } from 'dialkit';
import { DialControls } from '../DialControls';
import { screenPalettes } from '../palettes';
import { icons } from '../icons/library';
import { algorithms, advanceField, createArtwork, nextSeed, type Algorithm, type SimulationConfig } from './model';
import { renderLcd, type LcdRenderOptions } from './renderer';
import './lcd.css';

const controls = {
  simulation: {
    algorithm: { type: 'select', options: [...algorithms], default: 'Cyclic CA' },
    resolution: { type: 'select', options: ['80 × 45', '160 × 90', '240 × 135'], default: '160 × 90' },
    density: [0.32, 0.05, 0.8, 0.01], rule: [90, 0, 255, 1], randomStart: false,
    states: [8, 3, 16, 1], threshold: [1, 1, 8, 1], settle: [36, 0, 100, 1],
    wrap: true, speed: [8, 1, 20, 1],
  },
  screen: {
    paper: '#477e43', ink: '#2d612d',
    surface: { type: 'select', options: ['Flat', 'LCD', 'Backlit'], default: 'LCD' },
    tones: { type: 'select', options: ['Two tone', 'Shaded'], default: 'Shaded' },
    depth: [1, 0, 2, 0.05], glow: [0.45, 0, 1, 0.05],
    gap: [0.12, 0, 0.45, 0.01], threshold: [0.5, 0.05, 0.95, 0.05], invert: false,
  },
  motif: {
    icon: { type: 'select', options: ['None', ...icons.map(icon => icon.name)], default: 'None' },
    scale: [2, 1, 4, 1],
  },
} satisfies DialConfig;
const palettes = screenPalettes;
const algorithmNotes: Record<Algorithm, string> = {
  'Game of Life': 'B3/S23. Density sets the initial population; Settle advances it before the first frame.',
  'Elementary CA': 'Rule 0–255 builds a one-dimensional history. Random Start toggles a seeded row instead of one center cell (which ignores the seed). Initial history uses dead edges; Wrap applies when stepping.',
  'Cyclic CA': 'Each cell advances to the next state when enough of its eight neighbors already have that state. States, Threshold, and Settle shape the waves.',
  'WFC circuits': 'Lowest-entropy tile collapse with matching edge ports. This is a completed constraint solve, not a time simulation. Regenerate for another layout.',
};
export default function LcdLab() {
  const dial = useDialKitController('LCD artwork controls', controls, { id: 'procedural-lcd-v1', persist: true });
  const s = dial.values.simulation; const v = dial.values.screen; const m = dial.values.motif;
  const [seed, setSeed] = useState(41); const [draftSeed, setDraftSeed] = useState('41'); const [reset, setReset] = useState(0);
  const [playing, setPlaying] = useState(false); const [notice, setNotice] = useState('');
  const [error, setError] = useState(''); const [exporting, setExporting] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(document.visibilityState === 'visible');
  const canvas = useRef<HTMLCanvasElement>(null);
  const config: SimulationConfig = useMemo(() => {
    const [width, height] = s.resolution.split(' × ').map(Number);
    return { algorithm: s.algorithm as Algorithm, width, height, density: s.density, rule: s.rule,
      randomStart: s.randomStart, states: s.states, threshold: s.threshold, wrap: s.wrap, settle: s.settle };
  }, [s.algorithm, s.resolution, s.density, s.rule, s.randomStart, s.states, s.threshold, s.wrap, s.settle]);
  const key = `${JSON.stringify(config)}:${seed}:${reset}`;
  const initial = useMemo(() => {
    try { return createArtwork(config, seed); }
    catch (cause) { return { field: null, description: cause instanceof Error ? cause.message : 'Could not create artwork.' }; }
  }, [config, seed, reset]);
  const [run, setRun] = useState({ key, field: initial.field });
  const field = run.key === key ? run.field : initial.field;
  const isWfc = config.algorithm === 'WFC circuits';
  const options: LcdRenderOptions = useMemo(() => ({ paper: v.paper, ink: v.ink, surface: v.surface as LcdRenderOptions['surface'],
    tones: v.tones as LcdRenderOptions['tones'], depth: v.depth, glow: v.glow, gap: v.gap,
    threshold: v.threshold, invert: v.invert, motif: icons.find(icon => icon.name === m.icon) ?? null, motifScale: m.scale,
  }), [v.paper, v.ink, v.surface, v.tones, v.depth, v.glow, v.gap, v.threshold, v.invert, m.icon, m.scale]);
  useEffect(() => { setPlaying(false); setNotice(''); }, [key]);
  useEffect(() => { setDraftSeed(String(seed)); }, [seed]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => { setReduced(media.matches); if (media.matches) setPlaying(false); };
    const visibility = () => setVisible(document.visibilityState === 'visible');
    media.addEventListener('change', changed); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', changed); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useLayoutEffect(() => {
    const target = canvas.current; if (!target) return;
    if (!field) { target.getContext('2d')?.clearRect(0, 0, 1280, 720); setError(''); return; }
    try { renderLcd(target, field, options); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Rendering failed.'); setPlaying(false); }
  }, [field, options]);
  function step() {
    if (!field || isWfc) return;
    setRun(previous => ({ key, field: advanceField(previous.key === key && previous.field ? previous.field : field, config) }));
  }
  useEffect(() => {
    if (!playing || reduced || !visible || isWfc || !field) return;
    const timer = window.setInterval(() => {
      setRun(previous => ({ key, field: advanceField(previous.key === key && previous.field ? previous.field : field, config) }));
    }, 1000 / s.speed);
    return () => window.clearInterval(timer);
    // The interval steps the latest field through its updater; do not restart per generation.
  }, [playing, reduced, visible, isWfc, key, config, s.speed, initial.field]);
  function applySeed() {
    const value = Number(draftSeed);
    if (!/^\d+$/.test(draftSeed) || !Number.isInteger(value) || value < 0 || value > 4294967295) { setNotice('Seed must be a whole number from 0 to 4294967295.'); return; }
    setSeed(value); setReset(n => n + 1); setNotice('');
  }
  function preset(algorithm: Algorithm) {
    dial.setValue('simulation.algorithm', algorithm);
    if (algorithm === 'Elementary CA') { dial.setValue('simulation.rule', 90); dial.setValue('simulation.randomStart', false); }
    if (algorithm === 'Cyclic CA') { dial.setValue('simulation.states', 8); dial.setValue('simulation.threshold', 1); }
    setReset(n => n + 1);
  }
  async function exportPng() {
    if (!canvas.current || !field || error) return;
    setPlaying(false); setExporting(true);
    const snapshot = document.createElement('canvas'); snapshot.width = 1280; snapshot.height = 720;
    snapshot.getContext('2d')!.drawImage(canvas.current, 0, 0);
    try {
      const blob = await new Promise<Blob | null>(resolve => snapshot.toBlob(resolve));
      if (!blob) throw new Error('PNG encoding failed.');
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
      link.download = `igp-lcd-${config.algorithm.toLowerCase().replaceAll(' ', '-')}-${seed}.png`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000); setNotice('1280 × 720 PNG saved. Export freezes the visible frame.');
    } catch { setNotice('Could not export PNG. Please try again.'); }
    finally { setExporting(false); }
  }
  const occupied = field ? field.cells.reduce((sum, value) => sum + Number(value > 0), 0) : 0;
  return <div className="lcd-lab" style={{ '--lcd-paper': v.paper, '--lcd-ink': v.ink } as CSSProperties}>
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">igp<span>✳</span></span><span>INDIE GO PUNK<span className="brand-sub">INDEPENDENT BY DESIGN</span></span></a><nav className="lcd-nav" aria-label="Experiments"><a href="/">Cutout</a><a href="/icons">Icons</a><a href="/lcd" aria-current="page">LCD</a><a href="/compose">Compose ↗</a></nav><button className="button primary lcd-export" disabled={!field || !!error || exporting} onClick={() => void exportPng()}>{exporting ? 'Saving…' : 'Export PNG ↗'}</button></header>
    <main className="lcd-layout"><section className="lcd-workspace" aria-label="Procedural artwork">
      <div className="lcd-heading"><div><span className="eyebrow">EXPERIMENT 03 / PROCEDURAL SCREENS</span><h1>A little order. A little chaos.</h1><p>Seed a system. Let the pixels find their own way.</p></div><span className="lcd-edition">1280 × 720<br/>SEEDED / LOCAL<br/>SHARP BY DESIGN</span></div>
      <div className="lcd-algorithms" role="group" aria-label="Artwork algorithms">{algorithms.map((algorithm, index) => <button key={algorithm} aria-pressed={s.algorithm === algorithm} onClick={() => preset(algorithm)}><span>0{index + 1}</span><strong>{algorithm}</strong><small>{['Clusters & oscillators', 'Rules & branching history', 'Waves & state cycles', 'Connected circuit tiles'][index]}</small></button>)}</div>
      <div className="lcd-toolbar"><div className="lcd-transport"><button className="button" disabled={isWfc || !field || reduced || !!error} onClick={() => setPlaying(p => !p)}>{playing ? 'Pause' : 'Play'}</button><button className="button" disabled={isWfc || !field || !!error} onClick={() => { setPlaying(false); step(); }}>Step +1</button><button className="button" onClick={() => { setPlaying(false); setReset(n => n + 1); }}>Reset</button></div><span className="lcd-generation" data-generation={field?.generation ?? 0}>{isWfc ? 'DECISIONS' : 'GENERATION'} {String(field?.generation ?? 0).padStart(4, '0')}</span></div>
      <div className={`lcd-stage ${v.surface.toLowerCase()}`}><canvas ref={canvas} width={1280} height={720} aria-label="1280 by 720 procedural LCD artwork"/><div className="lcd-canvas-caption"><span>{v.surface.toUpperCase()} / {v.tones.toUpperCase()}</span><span>{config.width} × {config.height} CELLS · SEED {seed}</span></div></div>
      <div className="lcd-seed"><form onSubmit={e => { e.preventDefault(); applySeed(); }}><label htmlFor="lcd-seed">SEED</label><input id="lcd-seed" inputMode="numeric" value={draftSeed} onChange={e => setDraftSeed(e.target.value)} aria-label="Artwork seed"/><button className="button" type="submit">Apply</button></form><button className="button" onClick={() => { setSeed(n => nextSeed(n)); setPlaying(false); }}>Regenerate ↻</button><span>{field ? `${Math.round(100 * occupied / field.cells.length)}% NONZERO CELLS` : 'NO VALID FIELD'}</span></div>
      <div className="lcd-palettes" role="group" aria-label="Screen palettes">{palettes.map(p => <button key={p.name} aria-label={p.name} title={p.name} aria-pressed={v.paper === p.paper && v.ink === p.ink && v.surface === p.surface} onClick={() => { dial.setValue('screen.paper', p.paper); dial.setValue('screen.ink', p.ink); dial.setValue('screen.surface', p.surface); }}><span style={{ background: p.paper, color: p.ink }}>▟</span><small>{p.name}</small></button>)}</div>
      <div className="lcd-notes"><span className="eyebrow">FIELD NOTES</span><p>{algorithmNotes[config.algorithm]}</p><p>{initial.description}</p><p>Shaded maps every state between the two screen colors. Two tone uses a cutoff. Flat black/white gives exact binary pixels; LCD and Backlit intentionally add lighting and depth.</p>{reduced && <p>Reduced motion is enabled. Use Step to inspect individual generations.</p>}</div>
      <div className="lcd-status" role="status">{notice || (playing ? visible ? 'Running locally. Pause to choose a still.' : 'Suspended while this tab is hidden.' : 'Paused. Export captures the current visible frame.')}</div>{error && <div className="error-box" role="alert">{error}</div>}{!field && <div className="error-box" role="alert">{initial.description}</div>}
    </section><aside className="lcd-sidebar" aria-label="LCD artwork controls"><div className="sidebar-heading"><div><span className="eyebrow">TUNE THE SYSTEM</span><h2>Pixel chemistry.</h2></div></div><p className="sidebar-note">Algorithm controls reseed the field. Screen controls keep its current generation.</p><DialControls/><div className="lcd-sidebar-note"><p><strong>Life:</strong> Density + Settle.<br/><strong>Elementary:</strong> Rule + Random Start.<br/><strong>Cyclic:</strong> States + Threshold + Settle.<br/><strong>WFC:</strong> Resolution + Wrap + Seed.</p><p>Motif adds an original game-dev icon with a clean clearing. It changes the artwork, not the simulation.</p><a href="/icons">Explore the icon library ↗</a></div></aside></main>
    <footer><span>INDIE GO PUNK <span className="footer-star">✳</span> PROCEDURAL FIELD NOTES / 03</span><span>NO API · REPRODUCIBLE SEEDS · LOCAL PNG EXPORTS</span></footer>
  </div>;
}
