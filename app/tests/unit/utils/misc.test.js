import { describe, test, expect, vi } from 'vitest';
import { uuid, clamp, deepClone, formatBytes, formatDate, formatDateTime, debounce, now } from '../../../src/utils/misc.js';

describe('clamp', () => {
  test('value within range is unchanged', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
  test('value below min is clamped to min', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });
  test('value above max is clamped to max', () => {
    expect(clamp(200, 0, 100)).toBe(100);
  });
  test('value equal to min is returned as-is', () => {
    expect(clamp(0, 0, 100)).toBe(0);
  });
  test('value equal to max is returned as-is', () => {
    expect(clamp(100, 0, 100)).toBe(100);
  });
  test('works with floating point values', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-0.1, 0, 1)).toBe(0);
    expect(clamp(1.1, 0, 1)).toBe(1);
  });
});

describe('formatBytes', () => {
  test('bytes below 1 KB shows as "X B"', () => {
    expect(formatBytes(512)).toBe('512 B');
  });
  test('1 byte shows as "1 B"', () => {
    expect(formatBytes(1)).toBe('1 B');
  });
  test('kilobytes range', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
  test('megabytes range', () => {
    expect(formatBytes(5242880)).toBe('5.0 MB');
  });
  test('exactly 1024 bytes is 1.0 KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });
});

describe('deepClone', () => {
  test('produces a deep copy, not a reference', () => {
    const original = { a: 1, b: { c: 2 } };
    const clone = deepClone(original);
    clone.b.c = 99;
    expect(original.b.c).toBe(2);
  });
  test('arrays inside objects are cloned', () => {
    const original = { tags: ['a', 'b'] };
    const clone = deepClone(original);
    clone.tags.push('c');
    expect(original.tags).toHaveLength(2);
  });
  test('result is not the same reference', () => {
    const original = { x: 1 };
    expect(deepClone(original)).not.toBe(original);
  });
});

describe('uuid', () => {
  test('produces a valid v4 UUID string', () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  test('two consecutive calls produce different values', () => {
    expect(uuid()).not.toBe(uuid());
  });
});

describe('formatDate', () => {
  test('formats epoch ms to a readable date string containing year and month', () => {
    const epochMs = new Date('2024-03-15').getTime();
    const result = formatDate(epochMs);
    expect(result).toContain('2024');
    expect(result).toMatch(/Mar|March|03/);
  });
});

describe('formatDateTime', () => {
  test('includes both date and time components', () => {
    const epochMs = new Date('2024-03-15T10:30:00').getTime();
    const result = formatDateTime(epochMs);
    expect(result).toContain('2024');
    expect(result).toMatch(/10|30/);
  });
});

describe('now', () => {
  test('returns a number close to Date.now()', () => {
    const before = Date.now();
    const result = now();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

describe('debounce', () => {
  test('delays function execution', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
  test('only fires once when called multiple times rapidly', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced();
    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
