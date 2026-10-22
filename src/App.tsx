import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useDialKitController } from 'dialkit';
import { controls, presets, type Preset } from './settings';
import { DialControls } from './DialControls';
import { ModeControls } from './ModeControls';
import { MaskEditor } from './MaskEditor';
import { PortraitRenderer, asBlob, decodeFile, hasTransparency, readableInk, outputSize, type Format } from './renderer';
import { saveCutout } from './composition/assets';
import 'dialkit/styles.css';
import './styles.css';

function Icon({ name, size = 18 }: { name: 'upload' | 'download' | 'reset' | 'shuffle' | 'arrow'; size?: number }) {
  const paths = {
    upload: <><path d="M12 16V3m-5 5 5-5 5 5" /><path d="M4 15v5h16v-5" /></>,
    download: <><path d="M12 3v13m-5-5 5 5 5-5" /><path d="M4 16v5h16v-5" /></>,
    reset: <><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" /></>,
    shuffle: <><path d="m3 5 4 0 10 14h4m-4-4 4 4-4 4M3 19h4l3-4m4-6 3-4h4m-4-4 4 4-4 4" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try another image.';

export default function App() {
  const dial = useDialKitController('Cutout controls', controls, {
    id: 'cutout-lab-v1', persist: true,
    onAction: path => { if (path === 'cutout.recut') void retryRemoval(); },
  });
  const values = dial.values;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const renderer = useRef(new PortraitRenderer());
  const original = useRef<ImageBitmap | null>(null);
  const cutout = useRef<ImageBitmap | null>(null);
  const generation = useRef(0);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [revision, setRevision] = useState(0);
  const [seed, setSeed] = useState(31);
  const [format, setFormat] = useState<Format>('Square');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Your image stays on this device.');
  const [error, setError] = useState('');
  const [autoRemove, setAutoRemove] = useState(true);
  const [compare, setCompare] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [editingMask, setEditingMask] = useState(false);
  const [sourceSize, setSourceSize] = useState<[number, number] | null>(null);
  const [modelUsed, setModelUsed] = useState('');
  const selectedPreset = presets.find(preset =>
    (Object.keys(preset.values) as (keyof Preset['values'])[]).every(group =>
      Object.entries(preset.values[group]).every(([key, expected]) => {
        const actual = (values[group] as Record<string, unknown>)[key];
        return typeof expected === 'number' && typeof actual === 'number'
          ? Math.abs(actual - expected) < 0.00001 : actual === expected;
      }),
    ),
  )?.id;
  const hasImage = revision > 0;
  const [width, height] = outputSize(format);

  useEffect(() => {
    clearTimeout(cleanupTimer.current);
    return () => {
      // React refresh re-runs effects while retaining refs. Defer disposal so a
      // refresh can reclaim them; a genuine unmount still releases the bitmaps.
      cleanupTimer.current = setTimeout(() => {
        generation.current++;
        original.current?.close();
        cutout.current?.close();
      }, 0);
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = canvasRef.current;
      if (!target) return;
      try {
        renderer.current.render(target, values, format, seed);
        if (compare && original.current) {
          const ctx = target.getContext('2d')!;
          const image = original.current;
          ctx.clearRect(0, 0, width, height);
          const scale = Math.min(width / image.width, height / image.height);
          ctx.drawImage(image, (width - image.width * scale) / 2, (height - image.height * scale) / 2,
            image.width * scale, image.height * scale);
        }
        setRenderError('');
      } catch (cause) {
        setRenderError(errorMessage(cause));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [values, format, seed, revision, compare, width, height]);
  useEffect(() => { setExportNotice(''); }, [values, format, seed, revision]);

  function commit(image: ImageBitmap) {
    renderer.current.setSource(image);
    cutout.current?.close();
    cutout.current = image;
    setRevision(value => value + 1);
    setCompare(false);
  }

  async function remove(image: ImageBitmap, id: number) {
    const quality = dial.getValues().cutout.quality;
    const model = quality === 'Fast' ? 'isnet_quint8' : 'isnet_fp16';
    setStatus(`Loading ${quality.toLowerCase()} model… First run downloads about ${quality === 'Fast' ? '40' : '80'} MB + runtime.`);
    const { removeBackground } = await import('@imgly/background-removal');
    const input = await asBlob(image);
    let lastUpdate = 0;
    const result = await removeBackground(input, {
      model, device: 'cpu', proxyToWorker: true,
      progress: (key, current, total) => {
        if (generation.current !== id || performance.now() - lastUpdate < 150) return;
        lastUpdate = performance.now();
        if (key.startsWith('fetch:')) {
          setStatus(`Downloading cutout model · ${total ? Math.round(current / total * 100) : 0}% of current asset`);
        } else {
          setStatus('Separating your subject… This can take a minute on the first run.');
        }
      },
      output: { format: 'image/png', quality: 1 },
    });
    const bitmap = await decodeFile(result);
    if (generation.current !== id) { bitmap.close(); return; }
    try { commit(bitmap); } catch (cause) { bitmap.close(); throw cause; }
    setModelUsed(quality);
    setStatus(`${quality} background removed · cleanup is live; adjust Crop bottom for head + chest.`);
  }

  async function upload(file: File) {
    if (busy) return;
    setError('');
    setExportNotice('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      setError('Choose a JPG, PNG, WebP, or AVIF image.'); return;
    }
    if (file.size > 20 * 1024 * 1024) { setError('Please choose an image under 20 MB.'); return; }
    const id = ++generation.current;
    setBusy(true);
    setStatus('Preparing your portrait…');
    try {
      const image = await decodeFile(file);
      if (generation.current !== id) { image.close(); return; }
      original.current?.close();
      original.current = image;
      setFileName(file.name);
      setSourceSize([image.width, image.height]);
      setModelUsed('');
      setEditingMask(false);
      renderer.current = new PortraitRenderer();
      cutout.current?.close();
      cutout.current = null;
      setRevision(0);
      setCompare(false);
      dial.setValues({ portrait: { flip: false, zoom: 0.86, horizontal: 0, vertical: 0, cropBottom: 0 } });
      if (!autoRemove || hasTransparency(image)) {
        const copy = await createImageBitmap(image);
        try { commit(copy); } catch (cause) { copy.close(); throw cause; }
        setStatus(autoRemove ? 'Transparent image detected · cutout kept as-is.' : 'Image kept as-is · automatic removal is off.');
        setModelUsed(autoRemove ? 'Transparent input' : 'Original kept');
      } else {
        await remove(image, id);
      }
    } catch (cause) {
      if (generation.current === id) {
        setError(`Could not prepare cutout: ${errorMessage(cause)} You can retry, or use a pre-cut transparent PNG.`);
        setStatus('Cutout not completed.');
      }
    } finally {
      if (generation.current === id) setBusy(false);
    }
  }

  async function retryRemoval() {
    if (!original.current || busy) return;
    const id = ++generation.current;
    setBusy(true); setError('');
    try { await remove(original.current, id); }
    catch (cause) { setError(`Background removal failed: ${errorMessage(cause)} Try a transparent PNG instead.`); setStatus('Cutout not completed.'); }
    finally { if (generation.current === id) setBusy(false); }
  }

  async function useOriginal() {
    if (!original.current || busy) return;
    try {
      const copy = await createImageBitmap(original.current);
      try { commit(copy); } catch (cause) { copy.close(); throw cause; }
      setError(''); setStatus('Original image kept as-is.');
    } catch (cause) { setError(errorMessage(cause)); }
  }

  function rescuePortrait() {
    dial.setValues({
      recovery: { exposure: 0.3, shadows: 65, localContrast: 15, sharpen: 25, denoise: 15 },
      treatment: { contrast: 1.03, brightness: 0, grain: 3 },
    });
    setStatus('Shadow recovery applied · tune Recovery for your photo; no invented facial detail.');
  }

  function applyManualMask(image: ImageBitmap) {
    try { commit(image); }
    catch (cause) { image.close(); throw cause; }
    setEditingMask(false);
    setStatus('Manual mask applied · automatic edge cleanup still applies. Re-cut resets manual edits.');
  }
  function choosePreset(preset: Preset) {
    dial.setValues(preset.values);
  }

  async function download() {
    if (!hasImage || busy || exporting) return;
    setExporting(true); setExportNotice('');
    try {
      // Render afresh: export always uses current controls, even in original view.
      const output = document.createElement('canvas');
      renderer.current.render(output, dial.getValues(), format, seed);
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(
        value => value ? resolve(value) : reject(new Error('PNG export failed.')), 'image/png'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const name = fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 60) || 'portrait';
      link.href = url;
      link.download = `igp-${name}-${width}x${height}.png`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExportNotice(`PNG downloaded · ${width} × ${height}`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setExporting(false); }
  }

  async function sendCutout() {
    if (!hasImage || busy || exporting) return;
    setExporting(true); setError('');
    try {
      const current = dial.getValues();
      const output = document.createElement('canvas');
      renderer.current.render(output, { ...current, background: { ...current.background, transparent: true } }, format, seed);
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare the cutout.')), 'image/png'));
      await saveCutout(blob, fileName || 'Cutout Lab portrait');
      window.location.assign('/compose?cutout=latest');
    } catch (cause) { setError(`Could not transfer cutout: ${errorMessage(cause)} You can export a transparent PNG and upload it in Compose instead.`); }
    finally { setExporting(false); }
  }
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void upload(file);
    event.target.value = '';
  }
  function drop(event: DragEvent) {
    event.preventDefault(); setDragging(false);
    if (event.dataTransfer.files[0]) void upload(event.dataTransfer.files[0]);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="/" className="brand" aria-label="Indie Go Punk home"><span className="brand-mark" aria-hidden="true">igp<span>✳</span></span><span>INDIE GO PUNK<span className="brand-sub">INDEPENDENT BY DESIGN</span></span></a>
        <nav className="lcd-nav" aria-label="Experiments"><a href="/" aria-current="page">Cutout</a><a href="/icons">Icons</a><a href="/lcd">LCD</a><a href="/compose">Compose ↗</a></nav>
        <button className="button primary" disabled={!hasImage || busy || exporting || !!renderError} onClick={() => void download()}><Icon name="download" />{exporting ? 'Exporting…' : 'Export PNG'}</button>
      </header>

      <main>
        <section className="workspace" aria-label="Portrait editor">
          <div className="workspace-heading"><div><span className="eyebrow">THE PORTRAIT PLAYGROUND</span><h1>A little rough around the edges.</h1></div><span className="edition">VOL. 002<br />PEOPLE & PIXELS</span></div>
          <div className="editor-toolbar">
            <button className="button upload-button" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="upload" />{fileName ? 'Replace portrait' : 'Upload portrait'}</button>
            <button className="button upload-button" disabled={!hasImage || busy || exporting || !!renderError} onClick={() => void sendCutout()}>Send cutout ↗</button>
            <button className="button upload-button" disabled={!hasImage || busy} aria-pressed={values.portrait.flip} onClick={() => dial.setValue('portrait.flip', !values.portrait.flip)}>Mirror cutout ⇄</button>
            <input ref={fileRef} id="portrait-upload" className="visually-hidden" aria-label="Upload portrait" type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={handleFile} disabled={busy} />
            <label className="auto-toggle"><input type="checkbox" checked={autoRemove} onChange={event => setAutoRemove(event.target.checked)} disabled={busy} />Remove background</label>
            <div className="toolbar-end"><label className="format-label"><span className="visually-hidden">Output format</span><select value={format} onChange={event => setFormat(event.target.value as Format)}><option>Square</option><option>Landscape</option><option>Portrait</option></select></label><button className={`compare-button ${compare ? 'is-active' : ''}`} disabled={!hasImage || busy} aria-pressed={compare} onClick={() => setCompare(value => !value)}>Original</button></div>
          </div>

          {sourceSize && <div className="source-tools">
            <span className="source-info">{sourceSize[0]} × {sourceSize[1]} source{Math.min(...sourceSize) < 600 && <strong>LOW RES</strong>}{modelUsed && <span> / {modelUsed}</span>}</span>
            <div className="source-actions">
              <button disabled={busy} onClick={() => void retryRemoval()}>Re-cut</button>
              <button disabled={!hasImage || busy} onClick={rescuePortrait}>Lift face shadows</button>
              <button disabled={!hasImage || busy} onClick={() => setEditingMask(true)}>Refine mask</button>
            </div>
          </div>}
          <ModeControls values={values} setValue={dial.setValue} />
          <div className={`stage ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
            <div className="canvas-wrap" style={{ aspectRatio: `${width}/${height}`, maxWidth: format === 'Landscape' ? 800 : format === 'Portrait' ? 470 : 580 }}>
              <canvas ref={canvasRef} aria-label={hasImage ? 'Edited portrait preview' : 'Background preview; upload a portrait to begin'} />
              {!hasImage && !busy && <div className="empty-state" style={{ color: readableInk(values.background.transparent ? '#ededdf' : values.background.color) }}><svg className="pixel-bust" viewBox="0 0 128 128" fill="none" aria-hidden="true"><path d="M42 12h44v8h12v12h8v40H94v16H82v12h18v8h12v20H16v-20h12v-8h18V88H34V72H22V32h8V20h12Z" fill="currentColor" /><path d="M48 40h32v8h8v24h-8v12H48V72h-8V48h8Z" fill={values.background.transparent ? '#ededdf' : values.background.color} /><path d="M50 55h8v8h-8zm22 0h8v8h-8zM56 74h18v4H56z" fill="currentColor" /></svg><h2>Good faces.<br />Rough edges.</h2><p>Drop a portrait here.<br />We’ll take care of the background.</p><button className="empty-upload" onClick={() => fileRef.current?.click()}>Choose an image <Icon name="arrow" size={17} /></button><span className="empty-meta">JPG, PNG, WEBP, AVIF · UP TO 20 MB</span></div>}
              {busy && <div className="busy-overlay" role="status"><span className="processing-mark">✳</span><strong>Making the cut.</strong><p>{status}</p><span>Processing locally. Your portrait is not uploaded.</span></div>}
              {compare && <span className="canvas-tag">ORIGINAL · EXPORT USES EDITED VERSION</span>}
              {dragging && <div className="drop-overlay">Drop to make the cut ↙</div>}
            </div>
            <div className="stage-caption"><span><span className="tiny-cross">+</span> {hasImage ? `${values.treatment.style.toUpperCase()} / ${values.border.style.toUpperCase()} EDGE` : 'YOUR NEXT MAIN CHARACTER'}</span><span>{width} × {height} PX</span></div>
          </div>

          <div className="preset-heading"><span className="eyebrow">START SOMEWHERE. MAKE IT YOURS.</span><span>Pick a direction. Make it yours.</span></div>
          <div className="presets">{presets.map((preset, index) => <button key={preset.id} className={`preset ${selectedPreset === preset.id ? 'selected' : ''}`} onClick={() => choosePreset(preset)}><span className={`preset-swatch swatch-${preset.id}`} style={{ background: preset.swatch }} aria-hidden="true">{['▟', '◒', '〰', '▦', '✳'][index]}</span><span className="preset-copy"><strong>{preset.name}</strong><small>{preset.description}</small></span><span className="preset-number">0{index + 1}</span></button>)}</div>
          <div className="status-row" aria-live="polite"><span className="status-dot" /><span>{exportNotice || (busy ? 'Cutout in progress…' : status)}</span></div>
          {(error || renderError) && <div className="error-box" role="alert">{error || renderError}{original.current && !busy && <div className="recovery-actions"><button onClick={() => void retryRemoval()}>Retry removal</button><button onClick={() => void useOriginal()}>Keep original as-is</button></div>}</div>}
        </section>

        <aside className="control-sidebar" aria-label="DialKit adjustments">
          <div className="sidebar-heading"><div><span className="eyebrow">TWEAK DEPARTMENT</span><h2>Dial it in.</h2></div><button className="icon-button" title="Reset all controls" aria-label="Reset all controls" onClick={() => dial.resetValues()}><Icon name="reset" /></button></div>
          <p className="sidebar-note">Keep the face. Change the feeling.</p>
          <DialControls />
          <div className="sidebar-bottom">
            <button className="button texture-button" onClick={() => setSeed(value => value + 1)}><Icon name="shuffle" size={16} />Reseed texture</button>
            <details><summary>Notes from the lab</summary>
              <p><strong>Cutout:</strong> High quality is recommended for difficult images (about 80 MB model download). Changing quality requires Re-cut; it replaces manual mask edits. Keep Main removes disconnected components: turn it off for multiple people or detached accessories.</p>
              <p><strong>Edges:</strong> Trim and Feather are in source-image pixels, before enlargement. Start small. Cutoff removes weak-alpha residue. Refine Mask lets you erase or restore missed areas; automatic cleanup applies afterward.</p>
              <p><strong>Low resolution:</strong> Lift Face Shadows is a starting point, not face detection. Recovery affects the whole cutout, protects highlights, and runs before smooth enlargement. No AI reconstruction or invented facial features.</p>
              <p><strong>Head + chest:</strong> use a portrait crop, or increase Portrait → Crop Bottom, then adjust zoom and position. Framing is manual, not anatomical detection.</p>
              <p><strong>Pixel:</strong> block size changes only the border, not facial detail. Width snaps to whole blocks. Sketch Pen Width controls brush thickness independently of Width / outline gap. A zero gap is allowed.</p>
              <p><strong>Print:</strong> Halftone Size controls dot pitch; Dither Pixel Size directly controls each bitmap cell. Newsprint uses random ink screening with Print Grain Size / Ink Density. Sizes are output pixels, not source pixels; tiny patterns can alias when scaled.</p>
              <p><strong>Street press:</strong> black / cream portrait plus a generated blue / magenta grunge background. Grunge Ink is the second color; Patch Size, Coverage, Distress and Edge Bias shape the patches. It does not generate trees, typography, or stars from the reference.</p>
              <p><strong>Privacy:</strong> images are processed in your browser. First removal downloads model/runtime assets from IMG.LY. No paid API or account required.</p>
            </details>
          </div>
        </aside>
      </main>
      {editingMask && original.current && cutout.current && <MaskEditor original={original.current} cutout={cutout.current} onApply={applyManualMask} onClose={() => setEditingMask(false)} />}
      <footer><span>MADE FOR THE PEOPLE MAKING GAMES.</span><span>INDIE GO PUNK <span className="footer-star">✳</span> AN EXPERIMENT, NOT A TEMPLATE.</span></footer>
    </div>
  );
}
