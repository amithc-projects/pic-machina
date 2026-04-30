/**
 * Parse a standard SRT or VTT block into an array of subtitle objects.
 * Format: [ { start: (seconds), end: (seconds), text: "Caption lines..." } ]
 */

function parseTime(timeStr) {
  // Matches HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm
  const parts = timeStr.trim().split(/[:,.]/);
  if (parts.length < 3) return 0;

  let h = 0, m = 0, s = 0, ms = 0;
  if (parts.length === 4) {
    [h, m, s, ms] = parts.map(Number);
  } else if (parts.length === 3) {
    [m, s, ms] = parts.map(Number);
  }

  return (h * 3600) + (m * 60) + s + (ms / 1000);
}

export function parseSubtitles(rawText) {
  const blocks = rawText.trim().replace(/\r\n/g, '\n').split(/\n\s*\n+/);
  const subs = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;

    // VTT "WEBVTT" header block
    if (lines[0].startsWith('WEBVTT')) continue;

    // First line might be an index number or the timing row (in some loose VTTs)
    let timingLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timingLineIndex = i;
        break;
      }
    }

    if (timingLineIndex === -1) continue;

    const timingStr = lines[timingLineIndex];
    const [startStr, endStr] = timingStr.split('-->');

    if (startStr && endStr) {
      const text = lines.slice(timingLineIndex + 1).join('\n').trim();
      subs.push({
        start: parseTime(startStr),
        end: parseTime(endStr),
        text
      });
    }
  }

  return subs;
}
