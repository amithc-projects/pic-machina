/**
 * ImageChef — WebGL Video Stitcher
 * Temporal timeline assembler with WebGL transitions and Ken Burns motion.
 */

// --- Base Shaders ---
const VERTEX_SHADER = `
precision highp float;
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  // WebGL clip space: -1 to 1
  gl_Position = vec4(a_position, 0.0, 1.0);
  // UV space: 0 to 1
  v_uv = a_position * 0.5 + 0.5;
  // Invert Y because WebGL reads textures bottom-to-top natively,
  // but our UV coordinate logic assumes 0,0 is top-left
  v_uv.y = 1.0 - v_uv.y; 
}`;

const FRAGMENT_BASE = `
precision highp float;
varying vec2 v_uv;

uniform sampler2D fromTex;
uniform sampler2D toTex;
uniform float progress;      // 0.0 to 1.0 over the transition
uniform float ratio;         // canvas aspect ratio (width/height)

// Ken burns transforms for both the incoming and outgoing slides
uniform vec2 fromScale;
uniform vec2 fromOffset;
uniform vec2 toScale;
uniform vec2 toOffset;

vec4 getFromColor(vec2 uv) {
  vec2 transformed = (uv - 0.5) * fromScale + 0.5 + fromOffset;
  if(transformed.x < 0. || transformed.x > 1. || transformed.y < 0. || transformed.y > 1.) return vec4(0.0,0.0,0.0,1.0);
  return texture2D(fromTex, transformed);
}

vec4 getToColor(vec2 uv) {
  vec2 transformed = (uv - 0.5) * toScale + 0.5 + toOffset;
  if(transformed.x < 0. || transformed.x > 1. || transformed.y < 0. || transformed.y > 1.) return vec4(0.0,0.0,0.0,1.0);
  return texture2D(toTex, transformed);
}

// ------ TRANSITION INJECTED HERE ------
___TRANSITION_GLSL___
// --------------------------------------

void main() {
  gl_FragColor = transition(v_uv);
}
`;

// --- Standard GL-Transitions ---
const TRANSITIONS = {
  crossfade: `
    vec4 transition(vec2 uv) {
      return mix(getFromColor(uv), getToColor(uv), progress);
    }
  `,
  wipeRight: `
    vec4 transition(vec2 uv) {
      vec2 p = uv;
      return mix(getFromColor(p), getToColor(p), step(p.x, progress));
    }
  `,
  circleCrop: `
    vec4 transition(vec2 uv) {
      vec2 center = vec2(0.5, 0.5);
      float sqDist = dot((uv - center) * vec2(ratio, 1.0), (uv - center) * vec2(ratio, 1.0));
      if (sqDist < progress * progress) {
        return getToColor(uv);
      }
      return getFromColor(uv);
    }
  `,
  pixelize: `
    uniform float squaresMin; /* default 20.0 */
    uniform int steps; /* default 50 */
    
    vec4 transition(vec2 uv) {
      float d = min(progress, 1.0 - progress);
      float dist = steps > 0 ? ceil(d * float(steps)) / float(steps) : d;
      vec2 squareSize = 2.0 * dist / vec2(20.0);
      vec2 p = dist > 0.0 ? (floor(uv / squareSize) + 0.5) * squareSize : uv;
      return mix(getFromColor(p), getToColor(p), progress);
    }
  `,
  dipToBlack: `
    vec4 transition(vec2 uv) {
      if (progress < 0.5) {
        return mix(getFromColor(uv), vec4(0.0, 0.0, 0.0, 1.0), progress * 2.0);
      } else {
        return mix(vec4(0.0, 0.0, 0.0, 1.0), getToColor(uv), (progress - 0.5) * 2.0);
      }
    }
  `,
  pushLeft: `
    vec4 transition(vec2 uv) {
      vec2 f_uv = uv + vec2(progress, 0.0);
      vec2 t_uv = uv + vec2(progress - 1.0, 0.0);
      if (uv.x < 1.0 - progress) {
        return getFromColor(f_uv);
      } else {
        return getToColor(t_uv);
      }
    }
  `,
  pushRight: `
    vec4 transition(vec2 uv) {
      vec2 f_uv = uv + vec2(-progress, 0.0);
      vec2 t_uv = uv + vec2(1.0 - progress, 0.0);
      if (uv.x > progress) {
        return getFromColor(f_uv);
      } else {
        return getToColor(t_uv);
      }
    }
  `,
  whipPan: `
    vec4 transition(vec2 uv) {
      // 1. Calculate base push
      vec2 f_uv = uv + vec2(progress, 0.0);
      vec2 t_uv = uv + vec2(progress - 1.0, 0.0);
      
      // 2. Base color choice (like Push Left)
      vec4 color = vec4(0.0);
      
      // 3. Apply heavy directional blur near the middle of the transition
      // Max blur amount at progress = 0.5
      float blurLevel = sin(progress * 3.14159);
      float blurScale = blurLevel * 0.15; // Max 15% UV shift per tap
      
      // Multi-tap horizontal blur
      int taps = 7;
      float weightSum = 0.0;
      
      for(int i = -3; i <= 3; i++) {
        float offset = float(i) * blurScale / 3.0;
        vec2 sample_uv = uv + vec2(offset, 0.0);
        
        vec2 sf_uv = sample_uv + vec2(progress, 0.0);
        vec2 st_uv = sample_uv + vec2(progress - 1.0, 0.0);
        
        vec4 sampleColor = vec4(0.0);
        if (sample_uv.x < 1.0 - progress) {
          sampleColor = getFromColor(sf_uv);
        } else {
          sampleColor = getToColor(st_uv);
        }
        
        // Simple Gaussian distribution approx
        float weight = exp(-float(i*i)*0.2); 
        color += sampleColor * weight;
        weightSum += weight;
      }
      return color / weightSum;
    }
  `,
  filmBurn: `
    vec4 transition(vec2 uv) {
      vec4 f = getFromColor(uv);
      vec4 t = getToColor(uv);
      vec4 color = mix(f, t, progress);
      float flash = smoothstep(0.0, 0.5, progress) * (1.0 - smoothstep(0.5, 1.0, progress));
      vec3 burnColor = vec3(1.0, 0.8, 0.6) * flash * 1.5;
      return min(color + vec4(burnColor, 0.0), 1.0);
    }
  `,
  zoomFade: `
    vec4 transition(vec2 uv) {
      vec2 center = vec2(0.5, 0.5);
      float s1 = 1.0 - progress * 0.5;
      vec2 uv1 = (uv - center) * s1 + center;
      float s2 = 1.5 - progress * 0.5;
      vec2 uv2 = (uv - center) * s2 + center;
      return mix(getFromColor(uv1), getToColor(uv2), progress);
    }
  `,
  lumaWipe: `
    vec4 transition(vec2 uv) {
      vec4 f = getFromColor(uv);
      vec4 t = getToColor(uv);
      float luma = dot(t.rgb, vec3(0.299, 0.587, 0.114));
      float p = smoothstep(luma * 0.5, luma * 0.5 + 0.5, progress);
      return mix(f, t, p);
    }
  `,
  vhsGlitch: `
    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }
    vec4 transition(vec2 uv) {
      float env = smoothstep(0.0, 0.5, progress) * (1.0 - smoothstep(0.5, 1.0, progress));
      float glitchLine = rand(vec2(floor(uv.y * 20.0), 1.0)) * 2.0 - 1.0;
      vec2 disp = vec2(glitchLine * env * 0.15, 0.0);
      vec4 f = getFromColor(uv + disp);
      vec4 t = getToColor(uv - disp);
      float r = mix(getFromColor(uv + disp + vec2(0.02*env, 0)).r, getToColor(uv - disp + vec2(0.02*env, 0)).r, progress);
      float g = mix(f.g, t.g, progress);
      float b = mix(getFromColor(uv + disp - vec2(0.02*env, 0)).b, getToColor(uv - disp - vec2(0.02*env, 0)).b, progress);
      return vec4(r, g, b, 1.0);
    }
  `,
  venetianBlinds: `
    vec4 transition(vec2 uv) {
      float stripes = 12.0;
      float stripIndex = floor(uv.y * stripes);
      float p = progress * 1.2 - (stripIndex / stripes) * 0.2;
      p = clamp(p, 0.0, 1.0);
      float localY = fract(uv.y * stripes);
      if (localY < p) {
        return getToColor(uv);
      } else {
        return getFromColor(uv);
      }
    }
  `,
  liquidSwirl: `
    vec4 transition(vec2 uv) {
      vec2 center = vec2(0.5, 0.5);
      vec2 toCenter = uv - center;
      float dist = length(toCenter);
      float angle = progress * 3.14159 * 2.5 * (1.0 - dist);
      float s = sin(angle);
      float c = cos(angle);
      vec2 swirled = vec2(toCenter.x * c - toCenter.y * s, toCenter.x * s + toCenter.y * c);
      swirled += center;
      return mix(getFromColor(swirled), getToColor(uv), progress);
    }
  `,
  radialWipe: `
    vec4 transition(vec2 uv) {
      vec2 toCenter = uv - vec2(0.5);
      float angle = atan(toCenter.y, toCenter.x);
      angle = (angle / (2.0 * 3.14159)) + 0.5; 
      if (angle <= progress) {
        return getToColor(uv);
      } else {
        return getFromColor(uv);
      }
    }
  `
};

export class WebGLCompositor {
  constructor(width, height) {
    this.canvas = new OffscreenCanvas(width, height);
    this.gl = this.canvas.getContext('webgl');
    this.width = width;
    this.height = height;

    this.programs = {};
    this.initGeometry();
    
    // Compile built-in transitions
    for (const [name, glsl] of Object.entries(TRANSITIONS)) {
      this.compileTransition(name, glsl);
    }
  }

  initGeometry() {
    const gl = this.gl;
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Shader failed: ' + gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  compileTransition(name, transitionGLSL) {
    const gl = this.gl;
    const fragSrc = FRAGMENT_BASE.replace('___TRANSITION_GLSL___', transitionGLSL);
    
    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
    
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(program));
    }

    this.programs[name] = {
      program,
      locs: {
        position:   gl.getAttribLocation(program, 'a_position'),
        fromTex:    gl.getUniformLocation(program, 'fromTex'),
        toTex:      gl.getUniformLocation(program, 'toTex'),
        progress:   gl.getUniformLocation(program, 'progress'),
        ratio:      gl.getUniformLocation(program, 'ratio'),
        fromScale:  gl.getUniformLocation(program, 'fromScale'),
        fromOffset: gl.getUniformLocation(program, 'fromOffset'),
        toScale:    gl.getUniformLocation(program, 'toScale'),
        toOffset:   gl.getUniformLocation(program, 'toOffset')
      }
    };
  }

  createTexture(bitmap) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    // To use non-power-of-two textures, we must use CLAMP_TO_EDGE and linear filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // WebGL flips textures natively. 
    // Usually handled by GL flag, but we handled it in vertex shader flip.
    if (bitmap) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    return tex;
  }

  renderFrame({ programName, fromTex, toTex, progress, fromMotion, toMotion }) {
    const gl = this.gl;
    const pInfo = this.programs[programName] || this.programs['crossfade'];
    gl.useProgram(pInfo.program);

    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set uniforms
    gl.uniform1f(pInfo.locs.progress, progress);
    gl.uniform1f(pInfo.locs.ratio, this.width / this.height);
    
    // Set motion uniforms
    const applyMotion = (motionState, scaleLoc, offsetLoc) => {
       if (!motionState) {
          gl.uniform2f(scaleLoc, 1.0, 1.0);
          gl.uniform2f(offsetLoc, 0.0, 0.0);
       } else {
          gl.uniform2f(scaleLoc, motionState.scale.x, motionState.scale.y);
          gl.uniform2f(offsetLoc, motionState.offset.x, motionState.offset.y);
       }
    };
    applyMotion(fromMotion, pInfo.locs.fromScale, pInfo.locs.fromOffset);
    applyMotion(toMotion, pInfo.locs.toScale, pInfo.locs.toOffset);

    // Bind textures
    if (fromTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fromTex);
      gl.uniform1i(pInfo.locs.fromTex, 0);
    }
    if (toTex) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, toTex);
      gl.uniform1i(pInfo.locs.toTex, 1);
    }

    // Draw full screen quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(pInfo.locs.position);
    gl.vertexAttribPointer(pInfo.locs.position, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

/**
 * Calculates current scale and offset for Ken Burns
 */
function evaluateMotion(type, progress) {
  // progress is 0.0 to 1.0 linearly across the slide's LIFE
  // scale multiplier e.g. 1.0 -> 0.85 (zooming in means the UV scales down!)
  switch (type) {
    case 'zoom-in': { // UV scales down to zoom image in
      const s = 1.0 - (progress * 0.15); // zooms 15%
      return { scale: { x: s, y: s }, offset: { x: 0, y: 0 } };
    }
    case 'zoom-out': { // UV scales up to zoom image out
      const s = 0.85 + (progress * 0.15); 
      return { scale: { x: s, y: s }, offset: { x: 0, y: 0 } };
    }
    case 'pan-left': { // UV shifts right to view left side
      return { scale: { x: 0.9, y: 0.9 }, offset: { x: (progress - 0.5) * 0.1, y: 0 } };
    }
    case 'pan-right': { 
      return { scale: { x: 0.9, y: 0.9 }, offset: { x: (0.5 - progress) * 0.1, y: 0 } };
    }
    default:
      return { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } };
  }
}

/**
 * The core Stitcher engine. Receives pre-processed Blobs from the aggregator.
 */
export async function createWebGLStitcher(blobs, {
  width,
  height,
  fps = 30,
  durationPerSlide = 3.0,
  transitionDuration = 1.0,
  transitionMode = "crossfade",     // or "random" or array
  motionMode = "random",            // or "zoom-in", etc
  onProgress,
  onLog
} = {}) {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  
  let w = width ? parseInt(width, 10) : null;
  let h = height ? parseInt(height, 10) : null;

  if (!w || !h) {
    const firstBmp = await createImageBitmap(blobs[0]);
    w = w || firstBmp.width;
    h = h || firstBmp.height;
    firstBmp.close?.();
  }

  // Ensure even dimensions
  w = w % 2 === 0 ? w : w - 1;
  h = h % 2 === 0 ? h : h - 1;

  const compositor = new WebGLCompositor(w, h);
  
  // Pre-load bitmaps and WebGL Textures for all inputs to keep render loop sync
  // In production with 1000s of images, this should be chunked/streamed!
  const slides = [];
  const motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'];
  const transKeys = Object.keys(TRANSITIONS);

  onLog?.(`Loading and cropping ${blobs.length} images to GPU memory...`);
  for (let i = 0; i < blobs.length; i++) {
    // scale cover
    console.log('[Stitcher] Decoding frame', i+1, 'of', blobs.length);
    const bmp = await createImageBitmap(blobs[i]);
    
    // We want the image to completely cover WxH (Cropping excess)
    const cw = document.createElement('canvas'); cw.width = w; cw.height = h;
    const ctx = cw.getContext('2d');
    const scale = Math.max(w / bmp.width, h / bmp.height);
    const sw = bmp.width * scale, sh = bmp.height * scale;
    ctx.drawImage(bmp, (w-sw)/2, (h-sh)/2, sw, sh);
    const coverBmp = await createImageBitmap(cw);
    
    slides.push({
      tex: compositor.createTexture(coverBmp),
      motion: motionMode === 'random' ? motions[Math.floor(Math.random() * motions.length)] : motionMode,
      transition: transitionMode === 'random' ? transKeys[Math.floor(Math.random() * transKeys.length)] : transitionMode
    });
    
    bmp.close(); coverBmp.close();
  }
  onLog?.(`Finished loading ${blobs.length} images to GPU.`);

  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });

  await new Promise((resolve, reject) => {
    let completedFrames = 0;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
        completedFrames++;
        onProgress?.(completedFrames, slides.length * Math.round(fps * durationPerSlide));
      },
      error:  err => reject(new Error(`VideoEncoder: ${err.message}`)),
    });
    encoder.configure({ codec: 'avc1.64002a', width: w, height: h, bitrate: 6_000_000, framerate: fps });

    // Timeline logic
    const slideFrames = Math.round(fps * durationPerSlide);
    const transFrames = Math.round(fps * transitionDuration);
    let masterFrameIdx = 0;
    const totalFrames = slides.length * slideFrames;

    (async () => {
      try {
        for (let i = 0; i < slides.length; i++) {
            const current = slides[i];
            const next    = i < slides.length - 1 ? slides[i+1] : null;

            // Frame counts for this segment
            // A slide plays standalone, then transitions. 
            // Usually, slide 1 holds, then overlaps with slide 2.
            const standaloneFrames = slideFrames - transFrames;
            
            // 1. Standalone Phase (No ToTex)
            for (let f = 0; f < standaloneFrames; f++) {
                // local progress over the entire slide duration for motion calculations
                const progressSlide = f / slideFrames; 
                const fromMotion = evaluateMotion(current.motion, progressSlide);

                compositor.renderFrame({
                    programName: transKeys[0], // doesn't matter, we pass 0 progress
                    fromTex: current.tex,
                    toTex: null,
                    progress: 0.0,
                    fromMotion,
                    toMotion: null
                });

                const bmp = await createImageBitmap(compositor.canvas);
                const vf = new VideoFrame(bmp, { timestamp: masterFrameIdx * (1_000_000 / fps) });
                encoder.encode(vf, { keyFrame: masterFrameIdx % 30 === 0 });
                vf.close(); bmp.close();
                masterFrameIdx++;
            }

            // 2. Transition Phase (Overlap with Next Slide)
            if (next) {
                for (let f = 0; f < transFrames; f++) {
                    const transProgress = f / transFrames; // 0 to 1 for shader
                    
                    const progressSlideFrom = (standaloneFrames + f) / slideFrames; // 0.something to 1.0
                    const progressSlideTo   = f / slideFrames;                      // 0.0 to 0.something

                    const fromMotion = evaluateMotion(current.motion, progressSlideFrom);
                    const toMotion   = evaluateMotion(next.motion, progressSlideTo);

                    compositor.renderFrame({
                        programName: current.transition, 
                        fromTex: current.tex,
                        toTex: next.tex,
                        progress: transProgress,
                        fromMotion,
                        toMotion
                    });

                    const bmp = await createImageBitmap(compositor.canvas);
                    const vf = new VideoFrame(bmp, { timestamp: masterFrameIdx * (1_000_000 / fps) });
                    encoder.encode(vf, { keyFrame: masterFrameIdx % 30 === 0 });
                    vf.close(); bmp.close();
                    masterFrameIdx++;
                }
            } else {
                // If it's the very last slide, just hold it statically to fade to black or end gracefully
                for (let f = 0; f < transFrames; f++) {
                    const progressSlide = (standaloneFrames + f) / slideFrames; 
                    const fromMotion = evaluateMotion(current.motion, progressSlide);

                    compositor.renderFrame({
                        programName: transKeys[0],
                        fromTex: current.tex,
                        toTex: null,
                        progress: 0.0,
                        fromMotion,
                        toMotion: null
                    });
                    const bmp = await createImageBitmap(compositor.canvas);
                    const vf = new VideoFrame(bmp, { timestamp: masterFrameIdx * (1_000_000 / fps) });
                    encoder.encode(vf, { keyFrame: masterFrameIdx % 30 === 0 });
                    vf.close(); bmp.close();
                    masterFrameIdx++;
                }
            }
        }
        await encoder.flush(); encoder.close(); resolve();
      } catch (err) { reject(err); }
    })();
  });

  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}
