import { describe, test, expect } from 'vitest';
import { interpolate, resolveKey } from '../../../src/utils/variables.js';

describe('interpolate — basic tokens', () => {
  test('{{filename}} resolves to context filename', () => {
    expect(interpolate('output_{{filename}}', { filename: 'photo', ext: 'jpg' }))
      .toBe('output_photo');
  });
  test('{{ext}} resolves to file extension', () => {
    expect(interpolate('file.{{ext}}', { filename: 'photo', ext: 'jpg' }))
      .toBe('file.jpg');
  });
  test('unknown token is preserved as-is', () => {
    expect(interpolate('{{unknown_token}}', {})).toBe('{{unknown_token}}');
  });
  test('non-string template is coerced safely (null → empty string)', () => {
    expect(() => interpolate(null, {})).not.toThrow();
    // null ?? '' → '' per the implementation
    expect(interpolate(null, {})).toBe('');
  });
  test('template with no tokens is returned unchanged', () => {
    expect(interpolate('hello world', {})).toBe('hello world');
  });
  test('multiple tokens in one string', () => {
    expect(interpolate('{{filename}}.{{ext}}', { filename: 'img', ext: 'png' }))
      .toBe('img.png');
  });
});

describe('interpolate — exif / meta namespace', () => {
  test('nested exif key resolution', () => {
    expect(interpolate('ISO: {{exif.iso}}', { exif: { iso: 400 } }))
      .toBe('ISO: 400');
  });
  test('missing exif key preserves token', () => {
    expect(interpolate('{{exif.missing}}', { exif: {} }))
      .toBe('{{exif.missing}}');
  });
  test('meta namespace resolution', () => {
    expect(interpolate('{{meta.author}}', { meta: { author: 'Alice' } }))
      .toBe('Alice');
  });
});

describe('interpolate — pipe / fallback', () => {
  test('pipe fallback when value is null', () => {
    expect(interpolate('{{exif.author | "Unknown"}}', { exif: {} }))
      .toBe('Unknown');
  });
  test('pipe fallback not used when value is present', () => {
    expect(interpolate('{{exif.author | "Unknown"}}', { exif: { author: 'Bob' } }))
      .toBe('Bob');
  });
});

describe('interpolate — sidecar namespace', () => {
  test('sidecar dotted path resolution', () => {
    const ctx = { sidecar: { geo: { city: 'Paris' } } };
    expect(interpolate('{{sidecar.geo.city}}', ctx)).toBe('Paris');
  });
  test('sidecar annotation tags array joined with comma-space', () => {
    const ctx = { sidecar: { annotation: { tags: ['travel', 'nature'] } } };
    expect(interpolate('{{sidecar.annotation.tags}}', ctx)).toBe('travel, nature');
  });
  test('missing sidecar path preserves token', () => {
    expect(interpolate('{{sidecar.geo.city}}', { sidecar: {} }))
      .toBe('{{sidecar.geo.city}}');
  });
});

describe('interpolate — newline handling', () => {
  test('{{br}} produces actual newline', () => {
    expect(interpolate('Line1{{br}}Line2', {})).toBe('Line1\nLine2');
  });
  test('{{newline}} produces actual newline', () => {
    expect(interpolate('Line1{{newline}}Line2', {})).toBe('Line1\nLine2');
  });
  test('literal \\n in template is converted to newline', () => {
    expect(interpolate('A\\nB', {})).toBe('A\nB');
  });
});

describe('resolveKey', () => {
  test('loop.index returns reserved literal (not blank)', () => {
    expect(resolveKey('loop.index', {})).toBe('{{loop.index}}');
  });
  test('filename returns context filename', () => {
    expect(resolveKey('filename', { filename: 'test' })).toBe('test');
  });
  test('ext returns context ext', () => {
    expect(resolveKey('ext', { ext: 'jpg' })).toBe('jpg');
  });
});
