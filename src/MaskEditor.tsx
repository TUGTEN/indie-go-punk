import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import './mask-editor.css';

type Props = {
  original: ImageBitmap;
  cutout: ImageBitmap;
  onApply: (image: ImageBitmap) => void;
  onClose: () => void;
};
type Point = { x: number; y: number };
type Session = {
  source: ImageData;
  output: ImageData;
  mask: Uint8ClampedArray;
  initial: Uint8ClampedArray;
  history: Uint8ClampedArray[];
  capacity: number;
  brush: CanvasRenderingContext2D;
  preview: CanvasRenderingContext2D;
  pointer: number | null;
  last: Point | null;
  tool: 'erase' | 'restore';
  radius: number;
};
const UNDO_BYTES = 24 * 1024 * 1024;

function context(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas editing is unavailable in this browser.');
  return ctx;
}

export function MaskEditor({ original, cutout, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const firstControl = useRef<HTMLButtonElement>(null);
  const session = useRef<Session | null>(null);
  const applying = useRef(false);
  const callbacks = useRef({ onClose, onApply });
  callbacks.current = { onClose, onApply };
  const [tool, setTool] = useState<'erase' | 'restore'>('erase');
  const [radius, setRadius] = useState(10);
  const [guide, setGuide] = useState(true);
  const guideRef = useRef(guide);
  guideRef.current = guide;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [undoAvailable, setUndoAvailable] = useState(true);
  const [error, setError] = useState('');
  const titleId = useId();
  const noteId = useId();

  function render(s: Session) {
    const { width, height } = s.source;
    for (let p = 0; p < s.mask.length; p++) {
      s.output.data[p * 4 + 3] = Math.min(s.mask[p], s.source.data[p * 4 + 3]);
    }
    s.preview.putImageData(s.output, 0, 0);
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) throw new Error('Could not display the mask preview.');
    ctx.clearRect(0, 0, width, height);
    if (guideRef.current) {
      ctx.globalAlpha = 0.22;
      ctx.drawImage(original, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(s.preview.canvas, 0, 0);
  }

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    firstControl.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    setReady(false);
    setError('');
    setUndoCount(0);
    setDrawing(false);
    try {
      const { width, height } = original;
      if (!width || !height || width !== cutout.width || height !== cutout.height) {
        throw new Error('Original and cutout must have the same non-zero dimensions.');
      }
      const preview = context(width, height);
      preview.drawImage(original, 0, 0);
      const source = preview.getImageData(0, 0, width, height);
      preview.clearRect(0, 0, width, height);
      preview.drawImage(cutout, 0, 0);
      const input = preview.getImageData(0, 0, width, height);
      const mask = new Uint8ClampedArray(width * height);
      for (let p = 0; p < mask.length; p++) {
        mask[p] = Math.min(input.data[p * 4 + 3], source.data[p * 4 + 3]);
      }
      const s: Session = {
        source, output: new ImageData(new Uint8ClampedArray(source.data), width, height),
        mask, initial: mask.slice(), history: [],
        capacity: Math.min(12, Math.floor(UNDO_BYTES / mask.byteLength)),
        brush: context(width, height), preview, pointer: null, last: null, tool: 'erase', radius: 10,
      };
      session.current = s;
      setUndoAvailable(s.capacity > 0);
      render(s);
      setReady(true);
    } catch (cause) {
      session.current = null;
      setError(cause instanceof Error ? cause.message : 'Could not initialize the mask editor.');
    }
    return () => { session.current = null; };
    // A new bitmap pair starts a new editing session; tool changes must not reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, cutout]);

  useEffect(() => {
    if (session.current) render(session.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide]);

  function remember(s: Session) {
    if (s.capacity) {
      // Evict before allocating so retained snapshots never exceed the budget.
      if (s.history.length >= s.capacity) s.history.shift();
      s.history.push(s.mask.slice());
    }
    setUndoCount(s.history.length);
  }

  function point(event: PointerEvent<HTMLCanvasElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * event.currentTarget.width / bounds.width,
      y: (event.clientY - bounds.top) * event.currentTarget.height / bounds.height,
    };
  }

  function paint(s: Session, next: Point) {
    const last = s.last ?? next;
    const { width, height } = s.source;
    const r = s.radius;
    const x = Math.max(0, Math.floor(Math.min(last.x, next.x) - r - 1));
    const y = Math.max(0, Math.floor(Math.min(last.y, next.y) - r - 1));
    const right = Math.min(width, Math.ceil(Math.max(last.x, next.x) + r + 1));
    const bottom = Math.min(height, Math.ceil(Math.max(last.y, next.y) + r + 1));
    s.last = next;
    if (right <= x || bottom <= y) return;
    const brush = s.brush;
    brush.clearRect(x, y, right - x, bottom - y);
    brush.fillStyle = '#fff';
    brush.strokeStyle = '#fff';
    brush.lineWidth = r * 2;
    brush.lineCap = 'round';
    brush.lineJoin = 'round';
    brush.beginPath();
    if (last.x === next.x && last.y === next.y) {
      brush.arc(next.x, next.y, r, 0, Math.PI * 2);
      brush.fill();
    } else {
      brush.moveTo(last.x, last.y);
      brush.lineTo(next.x, next.y);
      brush.stroke();
    }
    const coverage = brush.getImageData(x, y, right - x, bottom - y).data;
    for (let row = y; row < bottom; row++) {
      for (let col = x; col < right; col++) {
        const p = row * width + col;
        const amount = coverage[((row - y) * (right - x) + col - x) * 4 + 3] / 255;
        const target = s.tool === 'erase' ? 0 : s.source.data[p * 4 + 3];
        s.mask[p] += (target - s.mask[p]) * amount;
      }
    }
    render(s);
  }

  function finish(event: PointerEvent<HTMLCanvasElement>) {
    const s = session.current;
    if (!s || s.pointer !== event.pointerId) return;
    s.pointer = null;
    s.last = null;
    setDrawing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function apply() {
    const s = session.current;
    if (!s || applying.current || s.pointer !== null) return;
    applying.current = true;
    setBusy(true);
    setError('');
    try {
      render(s);
      const image = await createImageBitmap(s.output);
      if (session.current !== s) {
        image.close(); // Only dispose our own result when its session has gone away.
        return;
      }
      // Ownership transfers to the parent; never close input bitmaps or a delivered result.
      callbacks.current.onApply(image);
    } catch (cause) {
      if (session.current === s) {
        setError(cause instanceof Error ? cause.message : 'Could not apply the mask. Please try again.');
      }
    } finally {
      applying.current = false;
      if (session.current) setBusy(false);
    }
  }

  return createPortal(
    <dialog ref={dialog} className="mask-editor" tabIndex={-1} aria-labelledby={titleId} aria-describedby={noteId}
      aria-modal="true" aria-busy={busy}
      onCancel={event => { event.preventDefault(); if (!applying.current) callbacks.current.onClose(); }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); event.currentTarget.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
          event.preventDefault(); first.focus();
        }
      }}>
      <div className="mask-editor__header">
        <div><span className="mask-editor__eyebrow">MANUAL CUTOUT</span><h2 id={titleId}>Refine your mask</h2></div>
        <button type="button" disabled={busy} onClick={() => { if (!applying.current) onClose(); }} aria-label="Close mask editor">Close</button>
      </div>
      <p id={noteId} className="mask-editor__note">Edit the raw mask here. Live automatic cleanup and edge controls apply afterward. Restore reveals the original image, limited by its transparency.</p>
      <div className="mask-editor__tools" role="group" aria-label="Mask editing tools">
        <button ref={firstControl} type="button" aria-pressed={tool === 'erase'} disabled={busy || drawing} onClick={() => setTool('erase')}>Erase</button>
        <button type="button" aria-pressed={tool === 'restore'} disabled={busy || drawing} onClick={() => setTool('restore')}>Restore</button>
        <label className="mask-editor__radius">Brush radius <output>{radius} source px</output>
          <input type="range" aria-label="Brush radius in source pixels" min="1" max="150" value={radius} disabled={busy || drawing} onChange={event => setRadius(Number(event.target.value))} />
        </label>
        <label className="mask-editor__guide"><input type="checkbox" checked={guide} disabled={busy} onChange={event => setGuide(event.target.checked)} />Dim original guide</label>
      </div>
      <div className="mask-editor__stage">
        <canvas ref={canvas} width={original.width || 1} height={original.height || 1}
          style={{ aspectRatio: `${original.width || 1} / ${original.height || 1}` }}
          aria-label="Cutout preview. Drag to erase or restore the mask with the selected brush."
          onPointerDown={event => {
            const s = session.current;
            if (!s || applying.current || s.pointer !== null || event.button !== 0) return;
            event.preventDefault();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
              remember(s);
              s.pointer = event.pointerId; s.last = null; s.tool = tool; s.radius = radius;
              setDrawing(true);
              paint(s, point(event));
            } catch { finish(event); setError('Could not draw this stroke. Try a smaller image.'); }
          }}
          onPointerMove={event => {
            const s = session.current;
            if (!s || s.pointer !== event.pointerId) return;
            event.preventDefault();
            try { paint(s, point(event)); }
            catch { finish(event); setError('Could not draw this stroke. Try undoing it.'); }
          }}
          onPointerUp={event => {
            const s = session.current;
            if (s && s.pointer === event.pointerId) {
              try { paint(s, point(event)); } catch { setError('Could not finish this stroke. Try undoing it.'); }
            }
            finish(event);
          }} onPointerCancel={finish} onLostPointerCapture={finish} />
      </div>
      <p className="mask-editor__hint">Drag on the preview to paint. Brush size uses original image pixels.{!undoAvailable && ' Undo is unavailable: one mask exceeds the 24 MB history budget.'}</p>
      {error && <p role="alert" className="mask-editor__error">{error}</p>}
      <div className="mask-editor__footer">
        <button type="button" disabled={!ready || busy || drawing || !undoCount} onClick={() => {
          const s = session.current;
          const previous = s?.history.pop();
          if (s && previous) { s.mask = previous; setUndoCount(s.history.length); render(s); }
        }}>Undo{undoCount > 0 ? ` (${undoCount})` : ''}</button>
        <button type="button" disabled={!ready || busy || drawing} onClick={() => {
          const s = session.current;
          if (s) { remember(s); s.mask.set(s.initial); render(s); }
        }}>Reset mask</button>
        <span className="mask-editor__status" role="status">{busy ? 'Creating cutout…' : ''}</span>
        <button type="button" className="mask-editor__apply" disabled={!ready || busy || drawing} onClick={() => void apply()}>{busy ? 'Applying…' : 'Apply mask'}</button>
      </div>
    </dialog>, document.body,
  );
}
