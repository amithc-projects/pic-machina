import { describe, test, expect } from 'vitest';
import { parseSubtitles } from '../../../src/utils/subtitles.js';

const BASIC_SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,500 --> 00:00:08,200
Second caption line`;

const VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world`;

const CRLF_SRT = `1\r\n00:00:01,000 --> 00:00:04,000\r\nHello world\r\n\r\n2\r\n00:00:05,500 --> 00:00:08,200\r\nSecond caption line`;

const MULTILINE = `1
00:00:01,000 --> 00:00:03,000
Line one
Line two`;

const THREE_PART_VTT = `WEBVTT

00:01:30.500 --> 00:01:35.000
Test caption`;

describe('parseSubtitles — SRT format', () => {
  test('parses a standard 2-block SRT correctly', () => {
    const result = parseSubtitles(BASIC_SRT);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ start: 1.0, end: 4.0, text: 'Hello world' });
    expect(result[1]).toMatchObject({ start: 5.5, end: 8.2, text: 'Second caption line' });
  });

  test('handles CRLF line endings', () => {
    const result = parseSubtitles(CRLF_SRT);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Hello world');
  });

  test('multi-line text in a block is joined with newline', () => {
    const result = parseSubtitles(MULTILINE);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Line one\nLine two');
  });

  test('returns empty array for non-SRT input', () => {
    expect(parseSubtitles('plain text with no timecodes')).toEqual([]);
  });

  test('returns empty array for empty string', () => {
    expect(parseSubtitles('')).toEqual([]);
  });
});

describe('parseSubtitles — VTT format', () => {
  test('parses WebVTT format', () => {
    const result = parseSubtitles(VTT);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ start: 1.0, end: 4.0, text: 'Hello world' });
  });

  test('handles three-part VTT timing (HH:MM:SS.mmm)', () => {
    const result = parseSubtitles(THREE_PART_VTT);
    expect(result).toHaveLength(1);
    expect(result[0].start).toBeCloseTo(90.5, 2);
    expect(result[0].end).toBeCloseTo(95.0, 2);
    expect(result[0].text).toBe('Test caption');
  });
});

describe('parseSubtitles — timing precision', () => {
  test('parses milliseconds correctly', () => {
    const srt = `1\n00:00:00,500 --> 00:00:01,250\nTest`;
    const result = parseSubtitles(srt);
    expect(result[0].start).toBeCloseTo(0.5, 3);
    expect(result[0].end).toBeCloseTo(1.25, 3);
  });
});
