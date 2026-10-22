import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PixelIcon } from './library';
import { iconArtworkSvg, effects, type ArtworkOptions, type IconEffect } from './artwork';
import { ArtworkGlyph } from './ArtworkGlyph';
import { exportIconAnimation } from './animation-export';

export type FrameHandle = { svg: (size: number, background: boolean) => string; animation: (size: number, loop: boolean, progress?: (current: number, total: number) => void) => Promise<Blob> };
export type IconLook = Pick<ArtworkOptions, 'ink' | 'paper' | 'surface' | 'depth' | 'glow'>;
const durationMs = 1200;

export const IconMotionPreview = forwardRef<FrameHandle, {
  icon: PixelIcon; look: IconLook; grid: boolean; onEffectChange?: (effect: IconEffect) => void;
}> (function IconMotionPreview({ icon, look, grid, onEffectChange }, ref) {
  const [effect, setEffect] = useState<IconEffect>('Glitch');
  const [speed, setSpeed] = useState(3);
  const [playing, setPlaying] = useState(false);
  const [trigger, setTrigger] = useState(0);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [phase, setPhase] = useState(0);
  const elapsed = useRef(0);
  const [visible, setVisible] = useState(document.visibilityState === 'visible');
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => {
      setReduced(media.matches);
      if (media.matches) { setPlaying(false); elapsed.current = 0; setPhase(0); }
    };
    const visibility = () => setVisible(document.visibilityState === 'visible');
    media.addEventListener('change', changed); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', changed); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => { elapsed.current = 0; setPlaying(false); setPhase(0); }, [icon.id, effect]);
  useEffect(() => {
    if (!playing || reduced || !visible || effect === 'None') return;
    let frame = 0; let previous = 0; let drawn = 0;
    const tick = (now: number) => {
      if (previous) elapsed.current += Math.min(now - previous, 100) * speed;
      previous = now;
      if (elapsed.current >= durationMs) { setPhase(0); setPlaying(false); return; }
      if (now - drawn >= 1000 / 30) { drawn = now; setPhase(0.01 + 0.99 * elapsed.current / durationMs); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced, visible, speed, effect, trigger]);
  function fire() {
    elapsed.current = 0; setPhase(0.01); setPlaying(true); setTrigger(value => value + 1);
  }
  useImperativeHandle(ref, () => ({
    svg: (size, background) => iconArtworkSvg(icon, { ...look, size, background, effect, phase }),
    animation: (size, loop, progress) => exportIconAnimation(icon, look, effect, speed, size, loop, progress),
  }), [icon, look, effect, phase, speed]);
  return <>
    <div className={`icon-preview icon-material ${look.surface.toLowerCase()}`} data-phase={phase.toFixed(4)} data-effect={effect} data-playing={playing}>
      <ArtworkGlyph icon={icon} options={{ ...look, size: 240, background: true, grid, effect, phase }} />
    </div>
    <section className="icon-motion" aria-label="Icon animation controls">
      <div className="icon-motion-heading"><span className="eyebrow">MOTION CARTRIDGE</span><span>{playing && !reduced ? visible ? 'FIRING' : 'SUSPENDED' : 'READY'}</span></div>
      <label className="icon-effect-label">Effect<select aria-label="Animation effect" value={effect} onChange={e => { const next = e.target.value as IconEffect; setEffect(next); onEffectChange?.(next); }}>{effects.map(e => <option key={e} value={e}>{e === 'Glitch' ? 'Glitch · RGB split' : e}</option>)}</select></label>
      <div className="icon-transport"><button className="button primary icon-trigger" disabled={reduced || effect === 'None'} onClick={fire}>⚡ Trigger effect</button><label>Speed<select aria-label="Animation speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option><option value={3}>3×</option><option value={4}>4×</option></select></label></div>
      <p>{reduced ? 'Reduced motion is on. Effects stay still; LCD depth and backlight remain visible.' : 'Click to fire immediately. One pronounced effect, then back to rest. Click again to retrigger; 0.5× makes it easier to inspect.'}</p>
    </section>
  </>;
});
