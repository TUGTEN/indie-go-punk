import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useDialKitController } from 'dialkit';
import { DialControls } from '../DialControls';
import { createArtwork, nextSeed } from '../lcd/model';
import { renderLcd } from '../lcd/renderer';
import { renderComposition, compositionLayout } from './renderer';
import { compositionControls, compositionSettings, compositionPalettes } from './settings';
import { compositionLayouts } from './layouts';
import { decodeCompositionAsset, loadCutout, forgetCutout } from './assets';
import type { CompositionAssets, CompositionText } from './types';
import './composition.css';

type AssetKind = 'portrait' | 'gameplay';
export default function CompositionLab() {
  const dial = useDialKitController('Composition controls', compositionControls, { id: 'split-composition-v1', persist: true });
  const valuesKey = JSON.stringify(dial.values);
  const settings = useMemo(() => compositionSettings(dial.values), [valuesKey]);
  const [text, setText] = useState<CompositionText>({ quote: 'We made the game we wanted to play.', person: 'Alex Rivera', role: 'Independent developer', game: 'Some long game name' });
  const [seed, setSeed] = useState(41);
  const assets = useRef<CompositionAssets>({ portrait: null, gameplay: null });
  const [assetNames, setAssetNames] = useState({ portrait: '', gameplay: '' });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState({ portrait: false, gameplay: false });
  const request = useRef({ portrait: 0, gameplay: 0 });
  const cleanup = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [notice, setNotice] = useState('Start with the placeholders, or bring in your cutout and a gameplay screenshot.');
  const [error, setError] = useState(''); const [renderError, setRenderError] = useState('');
  const [truncated, setTruncated] = useState<string[]>([]); const [exporting, setExporting] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const simulationKey = JSON.stringify(settings.simulation); const screenKey = JSON.stringify(settings.screen);
  const generated = useMemo(() => {
    try { return createArtwork(settings.simulation, seed); }
    catch (cause) { return { field: null, description: cause instanceof Error ? cause.message : 'Background generation failed.' }; }
  }, [simulationKey, seed]);
  const background = useMemo(() => {
    try {
      if (!generated.field) return { canvas: null, error: generated.description };
      const target = document.createElement('canvas');
      renderLcd(target, generated.field, { ...settings.screen, motif: null, motifScale: 1 });
      return { canvas: target, error: '' };
    } catch (cause) { return { canvas: null, error: cause instanceof Error ? cause.message : 'Background rendering failed.' }; }
  }, [generated, screenKey]);
  useLayoutEffect(() => {
    if (!canvas.current || !background.canvas) return;
    try {
      const result = renderComposition(canvas.current, background.canvas, assets.current, text, settings);
      setTruncated(result.truncated); setRenderError('');
    } catch (cause) { setRenderError(cause instanceof Error ? cause.message : 'Composition rendering failed.'); }
  }, [background, text, settings, revision]);
  useEffect(() => {
    clearTimeout(cleanup.current);
    return () => { cleanup.current = setTimeout(() => {
      request.current.portrait++; request.current.gameplay++;
      for (const asset of Object.values(assets.current)) if (asset instanceof ImageBitmap) asset.close();
      assets.current = { portrait: null, gameplay: null };
    }, 0); };
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('cutout') === 'latest') void latestCutout();
  }, []);
  async function setAsset(kind: AssetKind, blob: Blob, name: string) {
    const id = ++request.current[kind]; setBusy(previous => ({ ...previous, [kind]: true })); setError('');
    try {
      const result = await decodeCompositionAsset(blob, kind === 'portrait');
      if (request.current[kind] !== id) { result.bitmap.close(); return; }
      const previous = assets.current[kind]; assets.current[kind] = result.bitmap;
      if (previous instanceof ImageBitmap) previous.close();
      setAssetNames(previousNames => ({ ...previousNames, [kind]: name })); setRevision(n => n + 1);
      setNotice(kind === 'portrait' && !result.transparent ? 'Portrait is opaque. For a real cutout, use Cutout Lab and Send cutout, or upload a transparent PNG.' : `${kind === 'portrait' ? 'Cutout' : 'Gameplay'} loaded locally. Adjust framing in DialKit.`);
    } catch (cause) { if (request.current[kind] === id) setError(cause instanceof Error ? cause.message : 'Could not load this image.'); }
    finally { if (request.current[kind] === id) setBusy(previous => ({ ...previous, [kind]: false })); }
  }
  async function latestCutout() {
    const id = ++request.current.portrait;
    setBusy(previous => ({ ...previous, portrait: true })); setError('');
    try {
      const saved = await loadCutout();
      if (id !== request.current.portrait) return;
      if (!saved) { setNotice('No saved cutout yet. Open Cutout Lab, upload a portrait, then click Send cutout.'); return; }
      await setAsset('portrait', saved.blob, saved.name);
    } catch { if (id === request.current.portrait) setError('Local cutout storage is unavailable. Upload a transparent PNG instead.'); }
    finally { if (id === request.current.portrait) setBusy(previous => ({ ...previous, portrait: false })); }
  }
  function upload(kind: AssetKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (file) void setAsset(kind, file, file.name);
  }
  function clearAsset(kind: AssetKind) {
    ++request.current[kind]; const image = assets.current[kind]; if (image instanceof ImageBitmap) image.close();
    assets.current[kind] = null; setAssetNames(previous => ({ ...previous, [kind]: '' }));
    setBusy(previous => ({ ...previous, [kind]: false })); setRevision(n => n + 1);
  }
  async function forgetSaved() {
    try { await forgetCutout(); setNotice('Saved cutout removed from this browser. The current in-memory portrait is unchanged.'); }
    catch { setError('Could not clear local storage. Your browser may have disabled it.'); }
  }
  async function exportPng() {
    if (!canvas.current || renderError || background.error) return;
    setExporting(true); setError('');
    const snapshot = document.createElement('canvas'); snapshot.width = 1280; snapshot.height = 720;
    snapshot.getContext('2d')!.drawImage(canvas.current, 0, 0);
    try {
      const blob = await new Promise<Blob | null>(resolve => snapshot.toBlob(resolve)); if (!blob) throw new Error('PNG export failed.');
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
      link.download = `igp-composition-${seed}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice('1280 × 720 composition saved. It matches the current preview.');
    } catch { setError('Could not export this composition. Please try again.'); }
    finally { setExporting(false); }
  }
  function updateText(key: keyof CompositionText, value: string) { setText(previous => ({ ...previous, [key]: value })); }
  const failed = error || renderError || background.error;
  return <div className="composition-lab">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">igp<span>✳</span></span><span>INDIE GO PUNK<span className="brand-sub">INDEPENDENT BY DESIGN</span></span></a><nav className="lcd-nav" aria-label="Experiments"><a href="/">Cutout</a><a href="/icons">Icons</a><a href="/lcd">LCD</a><a href="/compose" aria-current="page">Compose</a></nav><button className="button primary composition-export" disabled={!!renderError || !!background.error || exporting || busy.portrait || busy.gameplay} onClick={() => void exportPng()}>{exporting ? 'Saving…' : 'Export PNG ↗'}</button></header>
    <main className="composition-layout"><section className="composition-workspace" aria-label="Split thumbnail composer">
      <div className="composition-heading"><div><span className="eyebrow">EXPERIMENT 04 / PEOPLE, GAMES & PIXELS</span><h1>A face. A game. A point of view.</h1><p>A split-layout sketchbook for the next Indie Go Punk episode.</p></div><span className="composition-edition">1280 × 720<br/>NEGATIVE TYPE<br/>LOCAL ASSETS</span></div>
      <div className="composition-layout-presets" role="group" aria-label="Layout alternatives">{compositionLayouts.map(preset => {
        const selected = Object.entries(preset.values.layout).every(([key, value]) => { const actual = settings.layout[key as keyof typeof settings.layout]; return typeof value === 'number' && typeof actual === 'number' ? Math.abs(actual - value) < 0.001 : actual === value; });
        const boxes = compositionLayout({ ...settings, layout: { ...settings.layout, ...preset.values.layout }, gameplay: { ...settings.gameplay, ...preset.values.gameplay } });
        return <button key={preset.id} aria-pressed={selected} aria-label={`Layout: ${preset.name}`} title={preset.description} onClick={() => dial.setValues(preset.values)}><svg viewBox="0 0 1280 720" aria-hidden="true"><rect width="1280" height="720" fill="#b0c29b"/><rect {...boxes.portrait} fill="#658353"/><rect {...boxes.gameplay} fill="#344e32"/><rect {...boxes.bubble} fill="#203722"/><rect {...boxes.gameTitle} fill="#203722"/>{boxes.nameplate.height > 0 && <rect {...boxes.nameplate} fill="#203722"/>}</svg><strong>{preset.name}</strong><small>{preset.description}</small></button>;
      })}</div>
      <div className="composition-assets"><div><span className="eyebrow">01 / THE PERSON</span><label className="button"><input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/avif" aria-label="Upload cutout portrait" onChange={e => upload('portrait', e)}/>{busy.portrait ? 'Loading…' : assetNames.portrait ? 'Replace cutout' : 'Upload cutout PNG'}</label><button className="composition-text-button" disabled={busy.portrait} onClick={() => void latestCutout()}>Use latest cutout ↗</button>{assetNames.portrait && <button className="composition-text-button" onClick={() => clearAsset('portrait')}>Clear portrait</button>}<small>{assetNames.portrait || 'Transparent PNG, or send from Cutout Lab.'}</small></div><div><span className="eyebrow">02 / THE GAME</span><label className="button"><input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/avif" aria-label="Upload gameplay image" onChange={e => upload('gameplay', e)}/>{busy.gameplay ? 'Loading…' : assetNames.gameplay ? 'Replace gameplay' : 'Upload gameplay image'}</label>{assetNames.gameplay && <button className="composition-text-button" onClick={() => clearAsset('gameplay')}>Clear gameplay</button>}<small>{assetNames.gameplay || 'Pinned to the layout corner. Crop and aspect are editable.'}</small></div></div>
      <div className="composition-stage"><canvas ref={canvas} width={1280} height={720} aria-label="1280 by 720 split-layout thumbnail preview"/><div className="composition-caption"><span>SOLID SCREEN-COLORED LETTERS / DARK PIXEL PANELS</span><span>SEED {seed}</span></div></div>
      <div className="composition-quick"><div className="composition-attribution" role="group" aria-label="Name placement"><button aria-pressed={settings.layout.attribution === 'Nameplate'} onClick={() => dial.setValue('layout.attribution', 'Nameplate')}>{settings.layout.arrangement === 'Reversed' ? 'Nameplate ↘' : 'Nameplate ↙'}</button><button aria-pressed={settings.layout.attribution === 'In bubble'} onClick={() => dial.setValue('layout.attribution', 'In bubble')}>Name in bubble</button></div><button className="button composition-mirror" aria-pressed={settings.portrait.flip} onClick={() => dial.setValue('portrait.flip', !settings.portrait.flip)}>Mirror cutout ⇄</button><button className="button" onClick={() => setSeed(n => nextSeed(n))}>New background ↻</button></div>
      <div className="composition-copy"><label>QUOTE <textarea aria-label="Person quote" maxLength={180} rows={3} value={text.quote} onChange={e => updateText('quote', e.target.value)}/><small>Keep it short. Pixel text auto-fits and wraps.</small></label><div><label>PERSON <input aria-label="Person name" maxLength={48} value={text.person} onChange={e => updateText('person', e.target.value)}/></label><label>ROLE / STUDIO <input aria-label="Person role or studio" maxLength={64} value={text.role} onChange={e => updateText('role', e.target.value)}/></label></div><label>GAME NAME <textarea aria-label="Game name" maxLength={80} rows={3} value={text.game} onChange={e => updateText('game', e.target.value)}/><small>Below gameplay. Line breaks are respected.</small></label></div>
      <div className="composition-palettes" role="group" aria-label="Composition color presets">{compositionPalettes.map(p => <button key={p.name} title={p.name} aria-label={p.name} aria-pressed={settings.screen.paper === p.paper && settings.screen.ink === p.ink} style={{ background: p.paper, color: p.ink }} onClick={() => { dial.setValue('screen.paper', p.paper); dial.setValue('screen.ink', p.ink); dial.setValue('screen.surface', p.surface); }}><span aria-hidden="true">▟</span><small>{p.name}</small></button>)}</div>
      <div className="composition-status" role="status">{notice}</div>{truncated.length > 0 && <p className="composition-warning" role="status">Text shortened to fit: {truncated.join(', ')}. Reduce text or increase panel space.</p>}{failed && <div className="error-box" role="alert">{failed}</div>}
      <details className="composition-details"><summary>How this experiment works</summary><p>Letter shapes use the plain screen color, never the procedural pattern. Dark panels clear the texture behind your text. Gameplay uses cover-cropping; its corner anchor stays fixed (top left in Reverse split). If a tall aspect would hit the game title, the frame shrinks to fit.</p><p>Prepare the portrait in <a href="/">Cutout Lab</a> and click Send cutout. That explicit transfer stores one PNG locally in this browser. Gameplay and direct uploads remain in memory; reloading clears them. Nothing is uploaded to a server. Fonts are original bitmap uppercase glyphs; accents are normalized and unsupported characters appear as ?.</p><button className="composition-text-button" onClick={() => void forgetSaved()}>Forget saved cutout in this browser</button></details>
    </section><aside className="composition-sidebar" aria-label="Composition controls"><div className="sidebar-heading"><div><span className="eyebrow">THE SPLIT LAB</span><h2>Move the pieces.</h2></div></div><p className="sidebar-note">Layout, framing, and type first. LCD material and procedural controls below.</p><DialControls/><div className="composition-sidebar-notes"><p><strong>Portrait X / Y:</strong> move the cutout inside the portrait column.<br/><strong>Gameplay X / Y:</strong> pan inside the pinned frame.<br/><strong>Aspect:</strong> width divided by height.</p><p>Tail X slides the bubble's speech pointer toward the head. Attribution switches the name between its own nameplate and the quote bubble.</p><p>Life: Density + Settle. Elementary: Rule + Random Start. Cyclic: States + Threshold + Settle. WFC: regenerate a static constrained layout. A centered elementary start ignores seed.</p></div></aside></main>
    <footer><span>INDIE GO PUNK <span className="footer-star">✳</span> COMPOSITION FIELD NOTES / 04</span><span>PORTRAIT + GAMEPLAY + PROCEDURAL LCD</span></footer>
  </div>;
}
