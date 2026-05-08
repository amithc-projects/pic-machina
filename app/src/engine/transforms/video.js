/**
 * PicMachina — Per-Frame Video Effect Transforms (Phase 3 + 4)
 *
 * Each transform here wraps an existing image effect transform and applies it
 * to every frame of a video via mediabunny's process callback.
 *
 * The `sourceTransformId` field tells processor.js which image transform's
 * apply() function to call per frame. Params are passed through unchanged, so
 * each video transform uses the same param definitions as its source transform.
 *
 * `strengthParam` (Phase 6): names the single param that the timeRange envelope
 * will scale from 0 → configured value. Params that naturally represent "no
 * effect" at 0 are ideal (blurRadius, strength, opacity, offset, etc.).
 * Transforms without a sensible scalar param omit this field — their timeRange
 * envelope is binary (effect on / off).
 *
 * Handled by Processor._runTransformNode (main-thread only — WebCodecs + DOM).
 */

import { registry } from '../registry.js';
import { interpolate } from '../../utils/variables.js';

const COMMON_PARAMS = [
  { name: 'suffix',  label: 'Filename Suffix', type: 'text',   defaultValue: '' },
  { name: 'bitrate', label: 'Bitrate (bps)',   type: 'number', defaultValue: 8000000 },
];

// ─── Colour & Tone Effects ────────────────────────────────

registry.register({
  id: 'video-tuning',
  name: 'Video Tuning',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'tune',
  sourceTransformId: 'color-tuning',
  strengthParam: 'saturation',
  description: 'Adjust contrast, saturation, vibrance and invert — applied to every video frame.',
  params: [
    { name: 'contrast',   label: 'Contrast',   type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'saturation', label: 'Saturation', type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'vibrance',   label: 'Vibrance',   type: 'range', min: -100, max: 100, defaultValue: 0 },
    { name: 'invert',     label: 'Invert',     type: 'boolean', defaultValue: false },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-duotone',
  name: 'Video Duotone',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'tonality',
  sourceTransformId: 'color-duotone',
  description: 'Replace tones with two colours — applied to every video frame.',
  params: [
    { name: 'darkColor',  label: 'Shadow Color',    type: 'color', defaultValue: '#1a0533' },
    { name: 'lightColor', label: 'Highlight Color', type: 'color', defaultValue: '#e8f4d4' },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-tint',
  name: 'Video Tint',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'format_color_fill',
  sourceTransformId: 'color-tint',
  strengthParam: 'strength',
  description: 'Overlay a colour tint over every video frame.',
  params: [
    { name: 'color',     label: 'Tint Color',   type: 'color',  defaultValue: '#ff8800' },
    { name: 'strength',  label: 'Strength (%)', type: 'range',  min: 0, max: 100, defaultValue: 20 },
    { name: 'blendMode', label: 'Blend Mode',   type: 'select',
      options: [
        { label: 'Normal',     value: 'source-over' },
        { label: 'Multiply',   value: 'multiply'    },
        { label: 'Screen',     value: 'screen'      },
        { label: 'Overlay',    value: 'overlay'     },
        { label: 'Soft Light', value: 'soft-light'  },
      ],
      defaultValue: 'source-over' },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-vignette',
  name: 'Video Vignette',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'vignette',
  sourceTransformId: 'color-vignette',
  strengthParam: 'amount',
  description: 'Darken the edges of every video frame for a cinematic look.',
  params: [
    { name: 'amount', label: 'Strength (%)',    type: 'range', min: 0, max: 100, defaultValue: 40 },
    { name: 'radius', label: 'Inner Radius (%)', type: 'range', min: 0, max: 100, defaultValue: 65 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

// ─── Filter & Creative Effects ────────────────────────────

registry.register({
  id: 'video-advanced-effects',
  name: 'Video Advanced Effects',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'filter_vintage',
  sourceTransformId: 'filter-advanced',
  strengthParam: 'blurRadius',
  description: 'Apply blur, sharpen, film grain, or pixelation to every video frame.',
  params: [
    { name: 'blurRadius',    label: 'Blur Radius (px)',   type: 'range', min: 0, max: 40, defaultValue: 0 },
    { name: 'sharpenAmount', label: 'Sharpen Amount (%)', type: 'range', min: 0, max: 100, defaultValue: 0 },
    { name: 'noiseLevel',    label: 'Noise / Grain (%)',  type: 'range', min: 0, max: 50, defaultValue: 0 },
    { name: 'pixelSize',     label: 'Pixel Size (px)',    type: 'range', min: 1, max: 40, defaultValue: 1 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-bloom',
  name: 'Video Bloom / Glow',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'flare',
  sourceTransformId: 'filter-bloom',
  strengthParam: 'strength',
  description: 'Add a cinematic glow by blooming the bright highlights of every frame.',
  params: [
    { name: 'threshold',  label: 'Highlight Threshold (%)', type: 'range', min: 0, max: 100, defaultValue: 75 },
    { name: 'blurRadius', label: 'Blur Radius (px)',         type: 'range', min: 2, max: 60,  defaultValue: 20 },
    { name: 'strength',   label: 'Strength (%)',             type: 'range', min: 0, max: 100, defaultValue: 70 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-color-grade',
  name: 'Video Color Grade',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'palette',
  sourceTransformId: 'filter-color-grade',
  description: 'Cinematic colour grading — lift, shadow tint, and highlight tint — on every frame.',
  params: [
    { name: 'lift',              label: 'Lift (Black Point)',    type: 'range', min: 0, max: 50,  defaultValue: 0 },
    { name: 'shadowColor',       label: 'Shadow Tint',           type: 'color', defaultValue: '#000000' },
    { name: 'shadowStrength',    label: 'Shadow Tint (%)',        type: 'range', min: 0, max: 100, defaultValue: 0 },
    { name: 'highlightColor',    label: 'Highlight Tint',         type: 'color', defaultValue: '#ffffff' },
    { name: 'highlightStrength', label: 'Highlight Tint (%)',     type: 'range', min: 0, max: 100, defaultValue: 0 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-chromatic-aberration',
  name: 'Video Chromatic Aberration',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'lens_blur',
  sourceTransformId: 'filter-chromatic-aberration',
  strengthParam: 'offset',
  description: 'Split R/B channels to simulate lens chromatic aberration on every frame.',
  params: [
    { name: 'offset',    label: 'Channel Offset (px)', type: 'range', min: 1, max: 30, defaultValue: 8 },
    { name: 'direction', label: 'Direction',            type: 'select',
      options: [
        { label: 'Horizontal', value: 'horizontal' },
        { label: 'Vertical',   value: 'vertical' },
        { label: 'Diagonal',   value: 'diagonal' },
      ], defaultValue: 'horizontal' },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-posterize',
  name: 'Video Posterize',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'gradient',
  sourceTransformId: 'color-posterize',
  description: 'Quantise each colour channel to a fixed number of levels — applied to every frame.',
  params: [
    { name: 'levels', label: 'Levels', type: 'range', min: 2, max: 8, defaultValue: 4 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-auto-levels',
  name: 'Video Auto Levels',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'brightness_auto',
  sourceTransformId: 'color-auto-levels',
  description: 'Normalise exposure by stretching the histogram — applied to every frame.',
  params: [
    { name: 'tolerance', label: 'Clipping Tolerance (%)', type: 'range', min: 0, max: 10, step: 0.1, defaultValue: 0.5 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-channel-swap',
  name: 'Video Channel Swap',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'swap_horiz',
  sourceTransformId: 'color-channel-swap',
  description: 'Reassign RGB channels on every frame. Swap R↔G to simulate infrared film.',
  params: [
    { name: 'redSource',   label: 'Red ← Source',   type: 'select',
      options: [{ label: 'Red', value: 'R' }, { label: 'Green', value: 'G' }, { label: 'Blue', value: 'B' }],
      defaultValue: 'G' },
    { name: 'greenSource', label: 'Green ← Source', type: 'select',
      options: [{ label: 'Red', value: 'R' }, { label: 'Green', value: 'G' }, { label: 'Blue', value: 'B' }],
      defaultValue: 'R' },
    { name: 'blueSource',  label: 'Blue ← Source',  type: 'select',
      options: [{ label: 'Red', value: 'R' }, { label: 'Green', value: 'G' }, { label: 'Blue', value: 'B' }],
      defaultValue: 'B' },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-halftone',
  name: 'Video Halftone',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'blur_on',
  sourceTransformId: 'filter-halftone',
  strengthParam: 'opacity',
  description: 'Overlay a halftone dot screen on every frame — dot size varies with brightness.',
  params: [
    { name: 'dotSpacing', label: 'Dot Spacing (px)', type: 'range',   min: 4, max: 40, defaultValue: 10 },
    { name: 'dotColor',   label: 'Dot Color',        type: 'color',   defaultValue: '#000000' },
    { name: 'opacity',    label: 'Opacity (%)',       type: 'range',   min: 5, max: 100, defaultValue: 40 },
    { name: 'invert',     label: 'Invert (bright = big dots)', type: 'boolean', defaultValue: false },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-tilt-shift',
  name: 'Video Tilt-Shift',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'filter_center_focus',
  sourceTransformId: 'filter-tilt-shift',
  strengthParam: 'blurAmount',
  description: 'Miniature/tilt-shift effect — sharp horizontal band, blurred top and bottom.',
  params: [
    { name: 'centerY',    label: 'Focus Centre (%)',  type: 'range', min: 10, max: 90, defaultValue: 50 },
    { name: 'bandWidth',  label: 'Sharp Band (%)',     type: 'range', min: 5,  max: 80, defaultValue: 25 },
    { name: 'blurAmount', label: 'Blur Amount (px)',   type: 'range', min: 2,  max: 40, defaultValue: 12 },
    { name: 'feather',    label: 'Feather (%)',        type: 'range', min: 0,  max: 50, defaultValue: 30 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-dither',
  name: 'Video Dither',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'grain',
  sourceTransformId: 'filter-dither',
  description: 'Floyd-Steinberg palette dithering on every frame — retro 8-bit look.',
  params: [
    { name: 'palette', label: 'Palette', type: 'select',
      options: [
        { label: 'Mono (2 colors)',     value: 'mono'    },
        { label: 'CGA (16 colors)',     value: 'cga'     },
        { label: 'Game Boy (4 greens)', value: 'gameboy' },
        { label: 'C64 (16 colors)',     value: 'c64'     },
      ], defaultValue: 'mono' },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-kuwahara',
  name: 'Video Oil Paint (Kuwahara)',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'brush',
  sourceTransformId: 'filter-kuwahara',
  strengthParam: 'radius',
  description: 'Kuwahara filter — painterly oil effect — applied to every frame. Intensive.',
  params: [
    { name: 'radius', label: 'Radius (stroke size)', type: 'range', min: 1, max: 5, defaultValue: 3 },
    { name: 'passes', label: 'Passes (intensity)',    type: 'range', min: 1, max: 2, defaultValue: 1 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-pixel-sort',
  name: 'Video Pixel Sort',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'sort',
  sourceTransformId: 'filter-pixel-sort',
  description: 'Sort pixels by luminance within horizontal strips — digital glitch aesthetic.',
  params: [
    { name: 'threshold',   label: 'Threshold (0–255)', type: 'range',  min: 0, max: 255, defaultValue: 80 },
    { name: 'direction',   label: 'Sort Direction',     type: 'select',
      options: [{ label: 'Light to Dark', value: 'light-to-dark' }, { label: 'Dark to Light', value: 'dark-to-light' }],
      defaultValue: 'light-to-dark' },
    { name: 'stripHeight', label: 'Strip Height (px)',  type: 'number', defaultValue: 1 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-mesh-warp',
  name: 'Video Mesh Warp',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'waves',
  description: 'Distort the video frame using WebGL mesh warping (bulge/pinch and wave distortions).',
  params: [
    { name: 'bulgeAmount', label: 'Bulge / Pinch', type: 'range', min: -1.0, max: 1.0, step: 0.05, defaultValue: 0.5 },
    { name: 'bulgeRadius', label: 'Bulge Radius (%)', type: 'range', min: 0, max: 100, defaultValue: 50 },
    { name: 'waveAmplitude', label: 'Wave Amplitude', type: 'range', min: 0, max: 0.5, step: 0.01, defaultValue: 0 },
    { name: 'waveFrequency', label: 'Wave Frequency', type: 'range', min: 0, max: 50, step: 0.5, defaultValue: 10 },
    { name: 'waveSpeed', label: 'Wave Speed', type: 'range', min: -10, max: 10, step: 0.5, defaultValue: 2 },
    ...COMMON_PARAMS,
  ],
  async applyPerFrame(ctx, p, context) {
      if (!context._glCanvas) {
          context._glCanvas = new OffscreenCanvas(ctx.canvas.width, ctx.canvas.height);
          context._gl = context._glCanvas.getContext('webgl', { premultipliedAlpha: false });
          const gl = context._gl;
          if (!gl) return;
          
          const vsSource = `
              attribute vec2 a_position;
              varying vec2 v_uv;
              void main() {
                  gl_Position = vec4(a_position, 0.0, 1.0);
                  v_uv = a_position * 0.5 + 0.5;
                  v_uv.y = 1.0 - v_uv.y;
              }
          `;
          const fsSource = `
              precision highp float;
              varying vec2 v_uv;
              uniform sampler2D u_image;
              uniform float u_bulgeAmount;
              uniform float u_bulgeRadius;
              uniform float u_waveAmplitude;
              uniform float u_waveFrequency;
              uniform float u_time;
              uniform vec2 u_resolution;

              void main() {
                  vec2 uv = v_uv;
                  
                  // Wave Distortion
                  if (u_waveAmplitude > 0.0) {
                      uv.x += sin(uv.y * u_waveFrequency + u_time) * u_waveAmplitude;
                  }
                  
                  // Bulge / Pinch Distortion
                  if (u_bulgeRadius > 0.0 && u_bulgeAmount != 0.0) {
                      vec2 center = vec2(0.5, 0.5);
                      vec2 toCenter = uv - center;
                      // Account for aspect ratio in distance calculation
                      float aspect = u_resolution.x / u_resolution.y;
                      vec2 toCenterScaled = vec2(toCenter.x * aspect, toCenter.y);
                      float dist = length(toCenterScaled);
                      
                      if (dist < u_bulgeRadius) {
                          float percent = dist / u_bulgeRadius;
                          if (u_bulgeAmount > 0.0) {
                              // Bulge (Puff out)
                              uv = center + toCenter * mix(1.0, smoothstep(0.0, 1.0, percent), u_bulgeAmount);
                          } else {
                              // Pinch (Suck in)
                              uv = center + toCenter * mix(1.0, pow(percent, 1.0 - u_bulgeAmount), -u_bulgeAmount);
                          }
                      }
                  }

                  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
                  } else {
                      gl_FragColor = texture2D(u_image, uv);
                  }
              }
          `;
          
          const compileShader = (type, source) => {
              const shader = gl.createShader(type);
              gl.shaderSource(shader, source);
              gl.compileShader(shader);
              return shader;
          };
          
          const vs = compileShader(gl.VERTEX_SHADER, vsSource);
          const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
          const prog = gl.createProgram();
          gl.attachShader(prog, vs); gl.attachShader(prog, fs);
          gl.linkProgram(prog);
          context._glProgram = prog;
          
          context._posBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, context._posBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
          
          context._glTexture = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, context._glTexture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }

      const gl = context._gl;
      if (!gl) return;
      const prog = context._glProgram;
      
      if (context._glCanvas.width !== ctx.canvas.width || context._glCanvas.height !== ctx.canvas.height) {
          context._glCanvas.width = ctx.canvas.width;
          context._glCanvas.height = ctx.canvas.height;
          gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      }

      gl.useProgram(prog);

      gl.bindTexture(gl.TEXTURE_2D, context._glTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);

      const posLoc = gl.getAttribLocation(prog, "a_position");
      gl.bindBuffer(gl.ARRAY_BUFFER, context._posBuffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1i(gl.getUniformLocation(prog, "u_image"), 0);
      gl.uniform1f(gl.getUniformLocation(prog, "u_bulgeAmount"), p.bulgeAmount !== undefined ? p.bulgeAmount : 0.5);
      gl.uniform1f(gl.getUniformLocation(prog, "u_bulgeRadius"), (p.bulgeRadius !== undefined ? p.bulgeRadius : 50) / 100.0);
      gl.uniform1f(gl.getUniformLocation(prog, "u_waveAmplitude"), p.waveAmplitude !== undefined ? p.waveAmplitude : 0);
      gl.uniform1f(gl.getUniformLocation(prog, "u_waveFrequency"), p.waveFrequency !== undefined ? p.waveFrequency : 10);
      gl.uniform1f(gl.getUniformLocation(prog, "u_time"), (context.timestampSec || 0) * (p.waveSpeed !== undefined ? p.waveSpeed : 2));
      gl.uniform2f(gl.getUniformLocation(prog, "u_resolution"), gl.canvas.width, gl.canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(context._glCanvas, 0, 0);
  },
  apply() { /* handled by Processor */ },
});

// ─── Pose Landmarks Overlay ──────────────────────────────────────────────────

// MediaPipe Pose skeleton connections (pairs of landmark indices).
const POSE_CONNECTIONS = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm + hand
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // Right arm + hand
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Left leg
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

registry.register({
  id: 'video-pose-landmarks',
  name: 'Video Pose Landmarks',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'accessibility_new',
  description: 'Overlay body pose skeleton (lines + keypoints) tracked across every video frame using MediaPipe.',
  params: [
    { name: 'lineColor',      label: 'Line Color',        type: 'color',   defaultValue: '#ffffff' },
    { name: 'lineWidth',      label: 'Line Width (px)',    type: 'range',   min: 1, max: 10, defaultValue: 3 },
    { name: 'showKeypoints',  label: 'Show Keypoints',     type: 'boolean', defaultValue: true },
    { name: 'keypointColor',  label: 'Keypoint Color',     type: 'color',   defaultValue: '#ffffff' },
    { name: 'keypointRadius', label: 'Keypoint Radius (px)', type: 'range', min: 1, max: 12, defaultValue: 4 },
    { name: 'minVisibility',  label: 'Min Visibility (%)', type: 'range',   min: 0, max: 100, defaultValue: 30 },
    ...COMMON_PARAMS,
  ],
  async applyPerFrame(ctx, p, context) {
    // Cache the PoseLandmarker across frames on the per-file context so
    // we load the model and wasm once per video, not once per frame.
    if (!context._poseLandmarker) {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      context._poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      context._poseTimestamp = -1; // Initialize to -1 so first frame can be 0
    }

    // MediaPipe VIDEO mode requires monotonically increasing timestamps (ms).
    // Use the actual frame timestamp (converted to ms), but ensure it is strictly greater than the last one.
    const actualTsMs = Math.round((context.timestampSec || 0) * 1000);
    context._poseTimestamp = Math.max(context._poseTimestamp + 1, actualTsMs);
    const ts = context._poseTimestamp;

    let result;
    try {
      result = context._poseLandmarker.detectForVideo(ctx.canvas, ts);
    } catch (err) {
      console.error('[video-pose-landmarks] detectForVideo error at ts', ts, err);
      return;
    }
    if (!result?.landmarks?.length) return;

    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const minVis = (Number(p.minVisibility) ?? 30) / 100;
    const lineColor = p.lineColor || '#ffffff';
    const lineWidth = Number(p.lineWidth) || 3;
    const showKp    = p.showKeypoints !== false;
    const kpColor   = p.keypointColor || '#ffffff';
    const kpRadius  = Number(p.keypointRadius) || 4;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const lm of result.landmarks) {
      // Draw skeleton lines
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      for (const [i, j] of POSE_CONNECTIONS) {
        const a = lm[i], b = lm[j];
        if (!a || !b) continue;
        if ((a.visibility ?? 1) < minVis || (b.visibility ?? 1) < minVis) continue;
        ctx.beginPath();
        ctx.moveTo(a.x * W, a.y * H);
        ctx.lineTo(b.x * W, b.y * H);
        ctx.stroke();
      }

      // Draw keypoints
      if (showKp) {
        ctx.fillStyle = kpColor;
        for (const kp of lm) {
          if ((kp.visibility ?? 1) < minVis) continue;
          ctx.beginPath();
          ctx.arc(kp.x * W, kp.y * H, kpRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  },
  apply() { /* handled by Processor */ },
});

// ─── Overlay / Compositing Effects ───────────────────────────────────────────

registry.register({
  id: 'video-watermark',
  name: 'Video Watermark',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'branding_watermark',
  sourceTransformId: 'overlay-watermark',
  strengthParam: 'opacity',
  description: 'Burn a watermark onto every frame of a video.',
  params: [
    { name: 'type',    label: 'Watermark Type', type: 'select',
      options: [{ label: 'Text', value: 'text' }, { label: 'Image', value: 'image' }], defaultValue: 'text' },
    { name: 'imageUrl', label: 'Image File',    type: 'file',    defaultValue: '' },
    { name: 'repeat',  label: 'Repeat Pattern', type: 'boolean', defaultValue: true },
    { name: 'text',    label: 'Text',           type: 'text',    defaultValue: '© PicMachina' },
    { name: 'font',    label: 'Font',           type: 'font-select',    defaultValue: 'Inter' },
    { name: 'size',    label: 'Size (px)',       type: 'number',  defaultValue: 28 },
    { name: 'color',   label: 'Color',          type: 'color',   defaultValue: '#ffffff' },
    { name: 'opacity', label: 'Opacity (%)',     type: 'range',   min: 0, max: 100, defaultValue: 25 },
    { name: 'angle',   label: 'Angle (°)',       type: 'range',   min: -90, max: 90, defaultValue: -35 },
    ...COMMON_PARAMS,
  ],
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'video-caption',
  name: 'Video Caption / Text',
  category: 'Video Effects',
  categoryKey: 'video-effect',
  timeline: 'native',
  icon: 'closed_caption',
  description: 'Burn styled text onto every frame — supports {{variable}} injection.',
  params: [
    { name: 'content',   label: 'Text ({{vars}} supported)', type: 'textarea',   defaultValue: '{{filename}}' },
    { name: 'textStyle', label: 'Text Style',   type: 'text-style-select', defaultValue: 'none' },
    { name: 'font',      label: 'Font Family', type: 'font-select', textStyleOverride: true, defaultValue: 'Inter' },
    { name: 'size',    label: 'Font Size (px)', type: 'number', defaultValue: 48, textStyleOverride: true },
    { name: 'color',   label: 'Text Color',     type: 'color',  defaultValue: '#ffffff', textStyleOverride: true },
    { name: 'weight',  label: 'Font Weight', type: 'select', textStyleOverride: true,
      options: [{ label: 'Normal', value: '400' }, { label: 'Bold', value: '700' }, { label: 'Light', value: '300' }],
      defaultValue: '400' },
    { name: 'bgBox',   label: 'Background Box', type: 'select', textStyleOverride: true,
      options: [
        { label: 'None',       value: 'none' },
        { label: 'Wrap text',  value: 'wrap' },
        { label: 'Full width', value: 'full-width' },
      ], defaultValue: 'none' },
    { name: 'bgColor',   label: 'Box Color',       type: 'color',  defaultValue: '#000000', textStyleOverride: true },
    { name: 'bgOpacity', label: 'Box Opacity (%)', type: 'range',  min: 0, max: 100, defaultValue: 60, textStyleOverride: true },
    { name: 'bgPadding', label: 'Box Padding (px)', type: 'number', defaultValue: 8, textStyleOverride: true },
    { name: 'shadow',      label: 'Text Shadow',  type: 'boolean', defaultValue: true, textStyleOverride: true },
    { name: 'shadowColor', label: 'Shadow Color', type: 'color',   defaultValue: '#000000', textStyleOverride: true },

    { name: 'anchor',  label: 'Position', type: 'select',
      options: [
        { label: 'Bottom Centre', value: 'bottom-center' },
        { label: 'Bottom Left',   value: 'bottom-left' },
        { label: 'Bottom Right',  value: 'bottom-right' },
        { label: 'Top Centre',    value: 'top-center' },
        { label: 'Top Left',      value: 'top-left' },
        { label: 'Top Right',     value: 'top-right' },
        { label: 'Centre',        value: 'center' },
      ], defaultValue: 'bottom-center' },
    { name: 'offsetX', label: 'Offset X (px)', type: 'number', defaultValue: 20 },
    { name: 'offsetY', label: 'Offset Y (px)', type: 'number', defaultValue: 20 },
    ...COMMON_PARAMS,
  ],
  // Direct per-frame rendering — avoids any indirect overlay-rich-text delegation issues.
  applyPerFrame(ctx, rawP, context) {
    let p = { ...rawP };
    if (p.textStyle && p.textStyle !== 'none') {
        try {
            const settingsStr = localStorage.getItem('ic-global-settings');
            if (settingsStr) {
                const settings = JSON.parse(settingsStr);
                const ts = (settings.textStyles || []).find(s => s.id === p.textStyle);
                if (ts) {
                    p = {
                        font: ts.fontFamily,
                        sizeMode: ts.sizeMode,
                        size: ts.size,
                        color: ts.color,
                        weight: ts.weight,
                        bgBox: ts.bgBox,
                        bgColor: ts.bgColor,
                        bgOpacity: ts.bgOpacity,
                        bgPadding: ts.bgPadding,
                        shadow: ts.shadow,
                        shadowColor: ts.shadowColor,
                        ...rawP
                    };
                }
            }
        } catch(e) {}
    }

    const text = interpolate(p.content || '{{filename}}', context);
    if (!text) return;

    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const size = p.size || 48;
    const font = p.font || 'Inter';
    const weight = p.weight || '400';

    ctx.save();
    ctx.font = `${weight} ${size}px ${font}, sans-serif`;
    ctx.textBaseline = 'alphabetic';

    const metrics = ctx.measureText(text);
    const tw      = metrics.width;
    const ascent  = metrics.actualBoundingBoxAscent  || size * 0.8;
    const descent = metrics.actualBoundingBoxDescent || size * 0.2;

    const anchor = p.anchor || 'bottom-center';
    const ox     = Number(p.offsetX) || 20;
    const oy     = Number(p.offsetY) || 20;
    const pad    = Number(p.bgPadding) || 8;

    // Horizontal origin
    let x;
    if (anchor === 'center' || anchor.endsWith('-center')) {
      x = (W - tw) / 2;
    } else if (anchor.endsWith('-right')) {
      x = W - tw - ox;
    } else {
      x = ox;
    }

    // Vertical baseline
    let y;
    if (anchor === 'center') {
      y = (H + ascent) / 2;
    } else if (anchor.startsWith('bottom')) {
      y = H - oy;
    } else {
      y = ascent + oy;
    }

    // Background box
    const bgBox = p.bgBox || 'none';
    if (bgBox !== 'none' && p.bgColor) {
      ctx.save();
      ctx.globalAlpha = (Number(p.bgOpacity) || 60) / 100;
      ctx.fillStyle   = p.bgColor;
      const boxY = y - ascent - pad;
      const boxH = ascent + descent + pad * 2;
      if (bgBox === 'full-width') {
        ctx.fillRect(0, boxY, W, boxH);
      } else {
        ctx.fillRect(x - pad, boxY, tw + pad * 2, boxH);
      }
      ctx.restore();
    }

    // Shadow — on by default unless explicitly disabled
    if (p.shadow !== false) {
      ctx.shadowColor   = p.shadowColor || '#000000';
      ctx.shadowBlur    = Math.max(size * 0.3, 4);
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }

    ctx.fillStyle = p.color || '#ffffff';
    ctx.fillText(text, x, y);
    ctx.restore();
  },
  apply() { /* handled by Processor */ },
});

registry.register({
  id: 'flow-video-replace-audio',
  name: 'Video: Replace Audio',
  category: 'Flow Control',
  description: 'Replaces the entire audio track of a video with a custom audio file or generated audio from a variable (e.g. {{ttsAudio}}).',
  icon: 'queue_music',
  params: [
    { name: 'audioSource', label: 'Audio Source (Variable or File)', type: 'file', accept: 'audio/*', defaultValue: '{{ttsAudio}}' },
    { name: 'bitrate', label: 'Video Bitrate (bps)', type: 'number', defaultValue: 8000000 },
    { name: 'audioBitrate', label: 'Audio Bitrate (bps)', type: 'number', defaultValue: 128000 }
  ],
  apply() { /* handled by Processor — runs mediabunny Conversion per file */ }
});

// ─── Video to GIF ─────────────────────────────────────────
registry.register({
  id: 'flow-video-to-gif', name: 'Video: Convert to GIF', category: 'Flow Control', categoryKey: 'flow',
  icon: 'gif',
  description: 'Convert a full video into an animated GIF. Automatically resizes and samples frames to keep file sizes manageable.',
  params: [
    { name: 'fps',    label: 'Frame Rate (FPS)',  type: 'number', defaultValue: 12 },
    { name: 'width',  label: 'Max Width (px)',    type: 'number', defaultValue: 480 },
    { name: 'loop',   label: 'Loop',              type: 'boolean', defaultValue: true },
    { name: 'suffix', label: 'Filename Suffix',   type: 'text',   defaultValue: '' }
  ],
  apply() { /* handled by Processor — per file */ }
});
