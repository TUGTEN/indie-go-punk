import { describe, expect, it } from 'vitest';
import { animationFrames } from './animation-export';
describe('icon animation timing', () => {
  it.each([0.5, 1, 1.5, 2, 3, 4])('preserves speed %s and a quiet loop hold', speed => {
    const frames = animationFrames(speed);
    expect(frames[0]).toEqual({ phase: 0, duration: 60 });
    expect(frames.at(-1)).toEqual({ phase: 0, duration: 1000 });
    expect(frames.slice(1, -1).reduce((sum, frame) => sum + frame.duration, 0)).toBe(Math.round(1200 / speed));
    expect(frames.length).toBeLessThanOrEqual(62);
    expect(frames.every(frame => Number.isInteger(frame.duration) && frame.duration > 0)).toBe(true);
    expect(frames.slice(1, -1).some(frame => frame.phase > 0 && frame.phase < 0.9)).toBe(true);
  });
  it('rejects invalid speed rather than producing unbounded exports', () => {
    for (const speed of [0, -1, Infinity, NaN, 0.1, 5]) expect(() => animationFrames(speed)).toThrow();
  });
});
