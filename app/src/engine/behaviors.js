// Extensible Property Behaviors Registry

const behaviors = {};

export function registerBehavior(def) {
  behaviors[def.id] = def;
}

export function getBehavior(id) {
  return behaviors[id];
}

export function getAllBehaviors() {
  return Object.values(behaviors);
}

// ─── Apply Behavior ────────────────────────────────────────────────
// Evaluates a single behavior against a base value over time
export function applyBehavior(behaviorData, baseValue, time) {
  const def = behaviors[behaviorData.id];
  if (!def || typeof baseValue !== 'number') return baseValue;
  return def.apply(baseValue, time, behaviorData.params || {});
}

// ─── Default Behaviors ─────────────────────────────────────────────

// 1. Wiggle
registerBehavior({
  id: 'wiggle',
  name: 'Wiggle',
  icon: 'show_chart',
  description: 'Randomly fluctuate the value over time.',
  params: [
    { name: 'frequency', label: 'Frequency (Hz)', type: 'range', min: 0.1, max: 20, step: 0.1, defaultValue: 2 },
    { name: 'amplitude', label: 'Amplitude', type: 'range', min: 1, max: 500, defaultValue: 50 }
  ],
  apply(baseValue, time, params) {
    const freq = params.frequency ?? 2;
    const amp = params.amplitude ?? 50;
    // Simple 1D noise approximation for wiggle (sum of offset sines)
    const noise = Math.sin(time * freq * Math.PI) * 0.5 + Math.sin(time * freq * Math.PI * 1.5 + 43.12) * 0.5;
    return baseValue + (noise * amp);
  }
});

// 2. Sine Wave (Oscillate)
registerBehavior({
  id: 'sine',
  name: 'Oscillate (Sine)',
  icon: 'waves',
  description: 'Smoothly bounce back and forth in a perfect wave.',
  params: [
    { name: 'frequency', label: 'Frequency (Hz)', type: 'range', min: 0.1, max: 20, step: 0.1, defaultValue: 1 },
    { name: 'amplitude', label: 'Amplitude', type: 'range', min: 1, max: 500, defaultValue: 50 },
    { name: 'phase', label: 'Phase (Offset °)', type: 'range', min: 0, max: 360, defaultValue: 0 }
  ],
  apply(baseValue, time, params) {
    const freq = params.frequency ?? 1;
    const amp = params.amplitude ?? 50;
    const phase = (params.phase ?? 0) * (Math.PI / 180);
    return baseValue + Math.sin(time * freq * Math.PI * 2 + phase) * amp;
  }
});

// 3. Linear Ramp
registerBehavior({
  id: 'ramp',
  name: 'Linear Ramp',
  icon: 'moving',
  description: 'Steadily increase or decrease the value constantly over time.',
  params: [
    { name: 'rate', label: 'Rate (per sec)', type: 'range', min: -500, max: 500, defaultValue: 10 }
  ],
  apply(baseValue, time, params) {
    const rate = params.rate ?? 10;
    return baseValue + (time * rate);
  }
});
