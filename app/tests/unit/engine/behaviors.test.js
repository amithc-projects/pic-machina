import { describe, test, expect } from 'vitest';
import { applyBehavior, getAllBehaviors, getBehavior } from '../../../src/engine/behaviors.js';

describe('getBehavior / getAllBehaviors', () => {
  test('built-in behaviors are registered', () => {
    const all = getAllBehaviors();
    const ids = all.map(b => b.id);
    expect(ids).toContain('wiggle');
    expect(ids).toContain('sine');
    expect(ids).toContain('ramp');
  });

  test('getBehavior returns the correct definition', () => {
    const sine = getBehavior('sine');
    expect(sine).not.toBeNull();
    expect(sine.name).toBe('Oscillate (Sine)');
  });

  test('getBehavior returns undefined for unknown id', () => {
    expect(getBehavior('nonexistent')).toBeUndefined();
  });
});

describe('applyBehavior — sine', () => {
  test('at t=0, phase=0: returns baseValue unchanged (sin(0)=0)', () => {
    const result = applyBehavior(
      { id: 'sine', params: { frequency: 1, amplitude: 50, phase: 0 } },
      100,
      0
    );
    expect(result).toBeCloseTo(100, 5);
  });

  test('at t=0.25 (quarter wave), adds amplitude', () => {
    // sin(0.25 * 1 * 2π) = sin(π/2) = 1
    const result = applyBehavior(
      { id: 'sine', params: { frequency: 1, amplitude: 50, phase: 0 } },
      0,
      0.25
    );
    expect(result).toBeCloseTo(50, 1); // ~50 (amplitude at peak)
  });

  test('non-numeric baseValue is returned unchanged', () => {
    const result = applyBehavior({ id: 'sine', params: {} }, 'text', 1);
    expect(result).toBe('text');
  });
});

describe('applyBehavior — ramp', () => {
  test('increments linearly: rate=10 at t=3 adds 30', () => {
    const result = applyBehavior({ id: 'ramp', params: { rate: 10 } }, 0, 3);
    expect(result).toBeCloseTo(30, 5);
  });

  test('negative rate decrements value', () => {
    const result = applyBehavior({ id: 'ramp', params: { rate: -5 } }, 100, 2);
    expect(result).toBeCloseTo(90, 5);
  });

  test('at t=0 returns baseValue unchanged', () => {
    const result = applyBehavior({ id: 'ramp', params: { rate: 10 } }, 42, 0);
    expect(result).toBeCloseTo(42, 5);
  });
});

describe('applyBehavior — wiggle', () => {
  test('at any time, result is baseValue +/- amplitude', () => {
    const base = 100;
    const amplitude = 50;
    for (let t = 0; t < 5; t += 0.1) {
      const result = applyBehavior(
        { id: 'wiggle', params: { frequency: 2, amplitude } },
        base,
        t
      );
      expect(result).toBeGreaterThanOrEqual(base - amplitude);
      expect(result).toBeLessThanOrEqual(base + amplitude);
    }
  });
});

describe('applyBehavior — unknown id', () => {
  test('returns baseValue unchanged for unknown behavior', () => {
    const result = applyBehavior({ id: 'nonexistent', params: {} }, 42, 1);
    expect(result).toBe(42);
  });
});
