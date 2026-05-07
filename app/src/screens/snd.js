import * as Tone from 'https://cdn.jsdelivr.net/npm/tone@14.7.77/+esm';
import JSZip from 'jszip';
import { TimelineView } from '../components/timeline-view.js';

// -------------- AUDIO HELPERS --------------
function audioBufferToWav(buffer, opt_channel) {
  const numChannels = opt_channel !== undefined ? 1 : buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; 
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  const channels = [];
  if (opt_channel !== undefined) {
    channels.push(buffer.getChannelData(opt_channel));
  } else {
    for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

const getAudioCtx = () => {
    if (!window.__sndAudioCtx) window.__sndAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return window.__sndAudioCtx;
};

function sliceAudioBuffer(buffer, startSec, endSec) {
  const ctx = getAudioCtx();
  const startFrame = Math.floor(startSec * buffer.sampleRate);
  const endFrame = Math.floor(endSec * buffer.sampleRate);
  const newLength = Math.max(1, endFrame - startFrame);
  const newBuffer = ctx.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    if (buffer.getChannelData(i).slice) {
      newBuffer.copyToChannel(buffer.getChannelData(i).slice(startFrame, endFrame), i);
    } else {
      newBuffer.copyToChannel(buffer.getChannelData(i).subarray(startFrame, endFrame), i);
    }
  }
  return newBuffer;
}

function extractChannel(buffer, channelIndex) {
    const ctx = getAudioCtx();
    const newBuf = ctx.createBuffer(1, buffer.length, buffer.sampleRate);
    newBuf.copyToChannel(buffer.getChannelData(channelIndex), 0);
    return newBuf;
}

function normalizeAudioBuffer(buffer) {
   let max = 0;
   for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
         const abs = Math.abs(data[i]);
         if (abs > max) max = abs;
      }
   }
   if (max === 0 || max === 1.0) return buffer; 
   const multiplier = 1.0 / max;
   const ctx = getAudioCtx();
   const newBuffer = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
   for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const inData = buffer.getChannelData(ch);
      const outData = newBuffer.getChannelData(ch);
      for (let i = 0; i < inData.length; i++) outData[i] = inData[i] * multiplier;
   }
   return newBuffer;
}

function reverseAudioBuffer(buffer) {
    const ctx = getAudioCtx();
    const newBuf = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for(let c=0; c<buffer.numberOfChannels; c++){
        const inData = buffer.getChannelData(c);
        const outData = newBuf.getChannelData(c);
        for(let i=0; i<buffer.length; i++) outData[i] = inData[buffer.length - 1 - i];
    }
    return newBuf;
}

function invertAudioBuffer(buffer) {
    const ctx = getAudioCtx();
    const newBuf = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for(let c=0; c<buffer.numberOfChannels; c++){
        const inData = buffer.getChannelData(c);
        const outData = newBuf.getChannelData(c);
        for(let i=0; i<buffer.length; i++) outData[i] = -inData[i];
    }
    return newBuf;
}

function applyFade(buffer, type, durationSec) {
    const ctx = getAudioCtx();
    const newBuf = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const fadeFrames = Math.min(buffer.length, Math.floor(durationSec * buffer.sampleRate));
    for(let c=0; c<buffer.numberOfChannels; c++){
        const inData = buffer.getChannelData(c);
        const outData = newBuf.getChannelData(c);
        for(let i=0; i<buffer.length; i++){
            let mult = 1.0;
            if (type === 'in' && i < fadeFrames) mult = i / fadeFrames;
            else if (type === 'out' && i > buffer.length - fadeFrames) mult = (buffer.length - i) / fadeFrames;
            outData[i] = inData[i] * mult;
        }
    }
    return newBuf;
}

function drawWaveformToCanvas(canvas, buffer, color, displayWidth, displayHeight, sourceStart = 0, sourceDuration = null) {
    if (!buffer) return;
    if (sourceDuration === null) sourceDuration = buffer.duration;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Hardware limits: Chrome fails to allocate canvas width > 32767
    // Cap backing buffer to 16000 pixels max to prevent browser crashes on long clips
    const MAX_CANVAS_WIDTH = 16000;
    const actualWidth = Math.min(displayWidth * dpr, MAX_CANVAS_WIDTH);
    const actualHeight = displayHeight * dpr;
    
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    // Transform coordinates so our loop still works cleanly up to displayWidth
    const scaleX = actualWidth / displayWidth;
    ctx.scale(scaleX, dpr);
    
    const startFrame = Math.floor(sourceStart * buffer.sampleRate);
    const endFrame = Math.floor((sourceStart + sourceDuration) * buffer.sampleRate);
    const channelData = buffer.getChannelData(0);
    const data = channelData.slice ? channelData.slice(startFrame, endFrame) : channelData.subarray(startFrame, endFrame);
    
    const step = Math.max(1, Math.floor(data.length / displayWidth));
    const amp = displayHeight / 2;
    
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = color;
    
    for(let i=0; i<displayWidth; i++){
        let min = 1.0;
        let max = -1.0;
        const offset = i * step;
        const end = Math.min(offset + step, data.length);
        for (let j=offset; j<end; j++) {
            const datum = data[j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        const y = (1 + min) * amp;
        const h = Math.max(1, (max - min) * amp);
        ctx.fillRect(i, y, 1, h);
    }
}

// -------------- UI HELPERS --------------

function showDialog(title, message, isDestructive, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    overlay.style.backdropFilter = 'blur(5px)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    const btnClass = isDestructive ? 'snd-btn-pink' : 'snd-btn-primary';
    const iconColor = isDestructive ? '#f472b6' : '#22d3ee';
    const icon = isDestructive ? 'warning' : 'info';
    
    overlay.innerHTML = `
        <div style="background: rgba(20,20,30,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 16px;">
           <div style="display: flex; align-items: center; gap: 12px;">
              <span class="material-symbols-outlined" style="color: ${iconColor}; font-size: 24px;">${icon}</span>
              <h3 style="margin: 0; font-size: 16px; color: #e2e8f0; font-family: system-ui, sans-serif;">${title}</h3>
           </div>
           <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.5; font-family: system-ui, sans-serif;">${message}</p>
           <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;">
              <button class="snd-btn" id="dlg-cancel">Cancel</button>
              <button class="snd-btn ${btnClass}" id="dlg-confirm">Confirm</button>
           </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.querySelector('#dlg-cancel').onclick = () => document.body.removeChild(overlay);
    overlay.querySelector('#dlg-confirm').onclick = () => {
        document.body.removeChild(overlay);
        if (onConfirm) onConfirm();
    };
}

let activeCtxMenu = null;
function showContextMenu(x, y, items) {
    if (activeCtxMenu) document.body.removeChild(activeCtxMenu);
    
    const menu = document.createElement('div');
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.background = 'rgba(20,20,30,0.95)';
    menu.style.border = '1px solid rgba(255,255,255,0.1)';
    menu.style.borderRadius = '8px';
    menu.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
    menu.style.zIndex = '99999';
    menu.style.padding = '4px';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    
    items.forEach(item => {
        const btn = document.createElement('button');
        btn.style.padding = '8px 16px';
        btn.style.background = 'none';
        btn.style.border = 'none';
        btn.style.color = '#e2e8f0';
        btn.style.fontSize = '13px';
        btn.style.textAlign = 'left';
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '8px';
        btn.style.borderRadius = '4px';
        btn.style.width = '100%';
        btn.style.whiteSpace = 'nowrap';
        
        btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.1)';
        btn.onmouseout = () => btn.style.background = 'none';
        
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px;">${item.icon}</span> ${item.label}`;
        btn.onclick = () => {
            document.body.removeChild(menu);
            activeCtxMenu = null;
            item.action();
        };
        menu.appendChild(btn);
    });
    
    document.body.appendChild(menu);
    activeCtxMenu = menu;
    
    setTimeout(() => {
        document.addEventListener('click', function onClickOutside() {
            if (activeCtxMenu && document.body.contains(activeCtxMenu)) {
                document.body.removeChild(activeCtxMenu);
                activeCtxMenu = null;
            }
            document.removeEventListener('click', onClickOutside);
        });
    }, 10);
}

// -------------- DATA MODEL --------------

const FX_CATALOG = {
    volume: { name: 'Gain', type: 'volume', params: { volume: { label: 'Gain (dB)', min: -24, max: 24, step: 0.1, default: 0 } } },
    eq3: { name: 'Paragrapic EQ3', type: 'eq3', params: { 
        low: { label: 'Low (dB)', min: -24, max: 24, step: 0.1, default: 0 },
        mid: { label: 'Mid (dB)', min: -24, max: 24, step: 0.1, default: 0 },
        high: { label: 'High (dB)', min: -24, max: 24, step: 0.1, default: 0 }
    }},
    compressor: { name: 'Compressor', type: 'compressor', params: {
        threshold: { label: 'Thresh (dB)', min: -60, max: 0, step: 1, default: -24 },
        ratio: { label: 'Ratio', min: 1, max: 20, step: 1, default: 4 }
    }},
    limiter: { name: 'Hard Limiter', type: 'limiter', params: {
        threshold: { label: 'Limit (dB)', min: -20, max: 0, step: 0.1, default: -1 }
    }},
    delay: { name: 'Delay', type: 'delay', params: {
        feedback: { label: 'Feedback', min: 0, max: 1, step: 0.05, default: 0.2 },
        wet: { label: 'Wet Mix', min: 0, max: 1, step: 0.05, default: 0.5 }
    }},
    distortion: { name: 'Distortion', type: 'distortion', params: {
        distortion: { label: 'Amount', min: 0, max: 1, step: 0.05, default: 0.5 },
        wet: { label: 'Wet Mix', min: 0, max: 1, step: 0.05, default: 1 }
    }},
    reverb: { name: 'Reverb', type: 'reverb', params: {
        wet: { label: 'Wet Mix', min: 0, max: 1, step: 0.05, default: 0.3 }
    }},
    pitch: { name: 'Pitch Shift', type: 'pitch', params: {
        pitch: { label: 'Semitones', min: -12, max: 12, step: 1, default: 0 }
    }}
};

function createFxNode(fxDef) {
    switch(fxDef.type) {
        case 'volume': return new Tone.Volume(fxDef.params.volume);
        case 'eq3': return new Tone.EQ3(fxDef.params.low, fxDef.params.mid, fxDef.params.high);
        case 'compressor': return new Tone.Compressor(fxDef.params.threshold, fxDef.params.ratio);
        case 'limiter': return new Tone.Limiter(fxDef.params.threshold);
        case 'delay': return new Tone.FeedbackDelay(0.25, fxDef.params.feedback).set({ wet: fxDef.params.wet });
        case 'distortion': return new Tone.Distortion(fxDef.params.distortion).set({ wet: fxDef.params.wet });
        case 'reverb': return new Tone.Freeverb({ roomSize: 0.8, dampening: 2000 }).set({ wet: fxDef.params.wet });
        case 'pitch': return new Tone.PitchShift(fxDef.params.pitch);
    }
}

function updateFxNodeParam(fxDef, paramName, value) {
    if (!fxDef._node) return;
    const n = fxDef._node;
    switch (fxDef.type) {
        case 'volume': n.volume.value = value; break;
        case 'eq3': n[paramName].value = value; break;
        case 'compressor': n[paramName].value = value; break;
        case 'limiter': n.threshold.value = value; break;
        case 'delay': 
            if (paramName === 'feedback') n.feedback.value = value;
            if (paramName === 'wet') n.wet.value = value;
            break;
        case 'distortion':
            if (paramName === 'distortion') n.distortion = value;
            if (paramName === 'wet') n.wet.value = value;
            break;
        case 'reverb':
            if (paramName === 'wet') {
                n.wet.value = value;
                if (window._debugAudio) console.log(`[FX UPDATE] Freeverb wet set to:`, n.wet.value);
            }
            break;
        case 'pitch':
            if (paramName === 'pitch') n.pitch = value;
            break;
    }
}

// -------------- MAIN RENDER --------------

export async function render(container) {
  container.innerHTML = `
    <style>
      .snd-root {
        width: 100%; height: 100%; display: flex; flex-direction: column;
        background-color: #0d0d14; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif;
        overflow: hidden; box-sizing: border-box;
      }
      .snd-root * { box-sizing: border-box; }
      
      .snd-header {
        padding: 20px 40px; display: flex; align-items: center; justify-content: space-between;
        background: rgba(18, 18, 26, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow: 0 4px 20px rgba(0,0,0,0.5); z-index: 10; flex-shrink: 0;
      }
      .snd-header-title { font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 12px; }
      
      .snd-btn {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0;
        padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;
        display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;
      }
      .snd-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
      .snd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .snd-btn-primary { background: #0891b2; border-color: #06b6d4; color: white; }
      .snd-btn-primary:hover:not(:disabled) { background: #06b6d4; }
      .snd-btn-pink { background: #db2777; border-color: #f472b6; color: white; }
      .snd-btn-pink:hover:not(:disabled) { background: #f472b6; }
      .snd-btn-blue { background: rgba(37, 99, 235, 0.2); border-color: rgba(59, 130, 246, 0.4); color: #bfdbfe; }
      .snd-btn-purple { background: rgba(147, 51, 234, 0.2); border-color: rgba(168, 85, 247, 0.4); color: #e9d5ff; }
      
      .snd-text-mono { font-family: monospace; font-size: 11px; }
      .snd-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .snd-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
      .snd-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      
      .snd-slider { -webkit-appearance: none; width: 100%; height: 4px; background: rgba(0,0,0,0.5); border-radius: 2px; outline: none; }
      .snd-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #06b6d4; cursor: pointer; border: 2px solid white; }
      
      .fx-title { font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #64748b; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; }
      .snd-select { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 8px 12px; border-radius: 8px; font-size: 13px; outline: none; width: 100%; cursor: pointer; }
      .fx-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden; }
      .fx-head { background: rgba(0,0,0,0.3); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; }
      .fx-body { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
      .fx-param { display: flex; flex-direction: column; gap: 6px; }
      .fx-param-label { display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
      
      .snd-track { height: 100px; border-bottom: 1px solid rgba(255,255,255,0.05); position: relative; display: flex; }
      .snd-track-header { width: 140px; background: #0b0b12; border-right: 1px solid rgba(255,255,255,0.1); position: sticky; left: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-weight: 600; font-size: 13px; color: #94a3b8; flex-shrink: 0; }
      .snd-track-content { flex: 1; position: relative; }
      
      .snd-clip { position: absolute; top: 10px; height: 80px; background: rgba(6,182,212,0.15); border: 1px solid #06b6d4; border-radius: 6px; overflow: hidden; cursor: grab; display: flex; flex-direction: column; transition: border-color 0.2s, box-shadow 0.2s; }
      .snd-clip:active { cursor: grabbing; }
      .snd-clip.selected { border-color: #f472b6; background: rgba(244,114,182,0.15); z-index: 2; box-shadow: 0 0 15px rgba(244,114,182,0.3); }
      .snd-clip-name { position: absolute; top: 0; left: 0; right: 0; background: rgba(0,0,0,0.5); font-size: 10px; padding: 2px 6px; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
    </style>

    <div class="snd-root">
      
      <!-- Header -->
      <div class="snd-header">
        <div class="snd-header-title">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #22d3ee, #a855f7); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(34,211,238,0.4);">
            <span class="material-symbols-outlined" style="color: white; font-size: 18px;">graphic_eq</span>
          </div>
          ZumiLabs <span style="opacity: 0.6; font-weight: 300;">Audio Studio</span>
        </div>
        <div style="display: flex; gap: 16px;">
          <button id="btn-new-proj" class="snd-btn" style="background: rgba(255,255,255,0.05);"><span class="material-symbols-outlined" style="font-size: 16px;">add</span> New</button>
          <button id="btn-save-proj" class="snd-btn" style="background: rgba(255,255,255,0.05);"><span class="material-symbols-outlined" style="font-size: 16px;">save</span> Save</button>
          <label class="snd-btn snd-btn-blue" style="cursor: pointer; margin: 0;">
             <span class="material-symbols-outlined" style="font-size: 18px;">audio_file</span> Import Clip
             <input type="file" id="snd-import" accept="audio/*,video/*" style="display: none;">
          </label>
          <button id="btn-export" class="snd-btn snd-btn-primary"><span class="material-symbols-outlined" style="font-size: 18px;">download_for_offline</span> Export</button>
          <button id="btn-close" class="snd-btn" style="background: rgba(255,255,255,0.05);"><span class="material-symbols-outlined" style="font-size: 16px;">eject</span> Close Audio</button>
        </div>
      </div>
      
      <!-- Body -->
      <div style="display: flex; flex: 1; overflow: hidden; position: relative;">
        
        <!-- Intro Overlay -->
        <div id="snd-intro" style="position: absolute; inset: 0; z-index: 50; background: #0d0d14; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: opacity 0.4s;">
            <div style="display: flex; gap: 24px;">
                <label class="snd-btn snd-btn-primary" style="padding: 24px 48px; font-size: 18px; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                   <span class="material-symbols-outlined" style="font-size: 32px;">audio_file</span> Import Audio
                   <input type="file" id="snd-upload" accept="audio/*,video/*" style="display: none;">
                </label>
                <label class="snd-btn snd-btn-purple" style="padding: 24px 48px; font-size: 18px; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                   <span class="material-symbols-outlined" style="font-size: 32px;">folder_open</span> Import Project
                   <input type="file" id="snd-upload-proj" accept=".audioproject,.json,.zip" style="display: none;">
                </label>
            </div>
            <p style="margin-top: 24px; color: #94a3b8;">Supports WAV, MP3, MP4, WebM or .audioproject files</p>
        </div>

        <!-- Sidebar Inspector -->
        <div class="snd-sidebar" style="width: 320px; background: rgba(18,18,26,0.8); border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; z-index: 10;">
          <div id="inspector-header" style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
             <!-- populated dynamically -->
          </div>
          
          <div class="snd-scroll" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 24px;">
            
            <div id="clip-tools-container" style="display:none; flex-direction: column; gap: 12px;">
                <div class="fx-title">ACTIONS</div>
                <div id="dynamic-actions-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"></div>
                <div id="rate-container" style="margin-top: 8px;">
                   <label class="snd-text-mono" style="color: #94a3b8; display: flex; justify-content: space-between;"><span>Playback Rate</span><span id="rate-val">1.0x</span></label>
                   <input type="range" id="clip-rate" class="snd-slider" min="0.5" max="2" step="0.1" value="1" style="margin-top: 8px;">
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div class="fx-title">EFFECTS RACK</div>
                <div id="fx-multi-msg" style="display:none; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                    <p style="margin-top: 0; margin-bottom: 8px;">Applying an effect will add it to all selected clips.</p>
                    <div id="fx-staging-area" style="display: flex; flex-direction: column; gap: 12px;"></div>
                    <label style="display: flex; align-items: center; gap: 8px; margin-top: 12px; color: #e2e8f0; cursor: pointer;">
                        <input type="checkbox" id="fx-replace-checkbox"> Replace existing effects
                    </label>
                    <button class="snd-btn snd-btn-blue" id="btn-apply-fx-multi" style="width: 100%; margin-top: 8px; display: none;">Apply to All Selected</button>
                </div>
                <div id="kf-navigator" style="display: none; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; margin-bottom: 12px;">
                    <button class="snd-btn" id="btn-kf-prev" style="padding: 4px 8px;">&lt;</button>
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <span id="kf-label" class="snd-text-mono" style="font-size: 12px; color: #22d3ee;">Base Settings</span>
                        <button id="btn-kf-delete" class="snd-btn snd-btn-pink" style="display:none; padding: 2px 6px; font-size: 10px; margin-top: 4px;">Delete KF</button>
                    </div>
                    <button class="snd-btn" id="btn-kf-next" style="padding: 4px 8px;">&gt;</button>
                </div>
                <div id="fx-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
                <select id="fx-add-select" class="snd-select">
                    <option value="">+ Add Effect...</option>
                    ${Object.keys(FX_CATALOG).map(k => `<option value="${k}">${FX_CATALOG[k].name}</option>`).join('')}
                </select>
            </div>

          </div>
        </div>

        <!-- Main Timeline -->
        <div style="flex: 1; display: flex; flex-direction: column; position: relative; min-width: 0; min-height: 0;">
            
            <!-- Toolbar -->
            <div style="height: 64px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; padding: 0 24px; gap: 16px; background: rgba(0,0,0,0.2); flex-shrink: 0;">
                <button id="btn-play" class="snd-btn snd-btn-primary" style="width: 44px; height: 44px; border-radius: 50%; padding: 0; box-shadow: 0 0 15px rgba(8,145,178,0.4);"><span class="material-symbols-outlined">play_arrow</span></button>
                <button id="btn-stop" class="snd-btn" style="width: 44px; height: 44px; border-radius: 50%; padding: 0;"><span class="material-symbols-outlined">stop</span></button>
                <span id="time-display" class="snd-text-mono" style="font-size: 14px; color: #06b6d4; background: rgba(0,0,0,0.5); padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">00:00.00</span>
                
                <div style="width: 1px; height: 32px; background: rgba(255,255,255,0.1); margin: 0 8px;"></div>
                

                
                
                <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 6px 16px; border-radius: 20px;">
                    <span class="material-symbols-outlined" style="font-size: 16px; color: #94a3b8;">zoom_out</span>
                    <input type="range" id="zoom-slider" class="snd-slider" min="10" max="200" value="50" style="width: 100px;">
                    <span class="material-symbols-outlined" style="font-size: 16px; color: #94a3b8;">zoom_in</span>
                </div>
            </div>

            <!-- Scrollable Tracks -->
            <div id="snd-timeline-wrapper" style="flex: 1; position: relative; background: #0b0b12;"></div>

            <div id="diarize-overlay" style="display:none; position: absolute; inset:0; background: rgba(0,0,0,0.8); z-index: 100; align-items: center; justify-content: center; flex-direction: column; color: #22d3ee;">
               <span class="material-symbols-outlined" style="font-size: 48px; animation: spin 2s linear infinite;">sync</span>
               <div id="diarize-status" style="margin-top: 16px; font-weight: 600;">Running AI Inference...</div>
            </div>

        </div>
      </div>
    </div>
  `;

  let project = {
      originalToneBuffer: null,
      tracks: [],
      masterFx: [],
      mediaPool: {}
  };
  let selectedItems = { tracks: new Set(), clips: new Set() };
  let stagedMultiFx = null;
  let activeKeyframeIdx = -1;
  let pixelsPerSecond = 50;
  let isPlaying = false;
  
  let activeToneNodes = [];
  let masterVolumeNode = null;
  let playLoopId = null;

  // DOM
  const timeDisplay = container.querySelector('#time-display');

  const formatTime = (secs) => {
      const m = Math.floor(secs / 60).toString().padStart(2, '0');
      const s = Math.floor(secs % 60).toString().padStart(2, '0');
      const ms = Math.floor((secs % 1) * 100).toString().padStart(2, '0');
      return `${m}:${s}.${ms}`;
  };

  const getAffectedClips = () => {
      let clips = new Set();
      project.tracks.forEach(t => {
          if (selectedItems.tracks.has(t.id)) {
              t.clips.forEach(c => clips.add(c));
          } else {
              t.clips.forEach(c => {
                  if (selectedItems.clips.has(c.id)) clips.add(c);
              });
          }
      });
      return Array.from(clips);
  };

  const cloneFx = (fxArr) => (fxArr || []).map(f => ({ id: 'fx_' + Date.now() + '_' + Math.floor(Math.random()*10000), type: f.type, params: {...f.params} }));

  const getClipById = (id) => {
      for(let t of project.tracks) {
          const c = t.clips.find(clip => clip.id === id);
          if (c) return c;
      }
      return null;
  };

  const recomputeClipBuffer = (clip) => {
      const actions = clip.appliedActions || new Set();
      
      if (actions.size === 0) {
          clip.buffer = null;
          return;
      }
      
      let buf;
      if (clip.poolId && project.mediaPool[clip.poolId]) {
          const start = clip.sourceStart || 0;
          buf = sliceAudioBuffer(project.mediaPool[clip.poolId], start, start + clip.duration);
      } else {
          return;
      }
      
      if (actions.has('norm')) buf = normalizeAudioBuffer(buf);
      if (actions.has('rev')) buf = reverseAudioBuffer(buf);
      if (actions.has('inv')) buf = invertAudioBuffer(buf);
      if (actions.has('fade-in')) buf = applyFade(buf, 'in', 1.0);
      if (actions.has('fade-out')) buf = applyFade(buf, 'out', 1.0);
      
      clip.buffer = buf;
  };

  // ---------------- RENDER UI ----------------

  const renderInspector = () => {
      const hdr = container.querySelector('#inspector-header');
      const tools = container.querySelector('#clip-tools-container');
      const fxList = container.querySelector('#fx-list');
      const fxMultiMsg = container.querySelector('#fx-multi-msg');
      const actionsGrid = container.querySelector('#dynamic-actions-grid');
      const kfNav = container.querySelector('#kf-navigator');
      const kfLabel = container.querySelector('#kf-label');
      const kfDelBtn = container.querySelector('#btn-kf-delete');
      
      const numTracks = selectedItems.tracks.size;
      const numClips = selectedItems.clips.size;
      const affectedClips = getAffectedClips();
      const isMulti = affectedClips.length > 1;
      const isSingleClip = affectedClips.length === 1 && numTracks === 0;
      
      if (numTracks > 0 || numClips > 0) {
          const title = numTracks > 0 ? (numTracks > 1 ? `${numTracks} Tracks Selected` : 'Track Selected') 
                                      : (numClips > 1 ? `${numClips} Clips Selected` : 'Clip Selected');
          const sub = numTracks > 0 ? `${affectedClips.length} total clips affected` : (isSingleClip ? affectedClips[0].name : `${affectedClips.length} clips affected`);
          
          hdr.innerHTML = `<h2 style="font-size: 16px; margin: 0; color: #f472b6;">${title}</h2>
                           <p style="font-size: 11px; margin: 4px 0 0; color: #94a3b8;">${sub}</p>`;
          tools.style.display = 'flex';
          
          const hasAction = (id) => isSingleClip ? affectedClips[0].appliedActions?.has(id) : affectedClips.every(c => c.appliedActions?.has(id));
          
          let actionsHtml = `
              <button class="snd-btn ${hasAction('norm') ? 'snd-btn-primary' : ''}" id="btn-norm">Normalize</button>
              <button class="snd-btn ${hasAction('rev') ? 'snd-btn-primary' : ''}" id="btn-rev">Reverse</button>
              <button class="snd-btn ${hasAction('inv') ? 'snd-btn-primary' : ''}" id="btn-inv">Invert Phase</button>
              <button class="snd-btn ${hasAction('fade-in') ? 'snd-btn-primary' : ''}" id="btn-fade-in">Fade In 1s</button>
              <button class="snd-btn ${hasAction('fade-out') ? 'snd-btn-primary' : ''}" id="btn-fade-out">Fade Out 1s</button>
              <button class="snd-btn" id="btn-auto-split"><span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">content_cut</span> Auto-Split</button>
          `;
          if (numTracks > 0) {
              actionsHtml += `<button class="snd-btn snd-btn-purple" id="btn-remove-gaps"><span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">compress</span> Remove Gaps</button>`;
          }
          if (numTracks === 1) {
              actionsHtml += `<button class="snd-btn snd-btn-blue" id="btn-diarize" style="grid-column: 1 / -1;"><span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">group</span> Diarize Track</button>`;
          }
          if (numClips === 2 && numTracks === 0) {
              // Only allow joining if they are on the same track
              const tracksWithSelection = project.tracks.filter(t => t.clips.some(c => affectedClips.includes(c)));
              if (tracksWithSelection.length === 1) {
                  actionsHtml += `<button class="snd-btn snd-btn-blue" id="btn-join-clips" style="grid-column: 1 / -1;"><span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">join_inner</span> Join Selected Clips</button>`;
              }
          }
          actionsHtml += `<button class="snd-btn snd-btn-pink" id="btn-delete" style="grid-column: 1 / -1;">Delete Selected</button>`;
          actionsGrid.innerHTML = actionsHtml;
          
          if (isSingleClip) {
              container.querySelector('#rate-container').style.display = 'block';
              container.querySelector('#clip-rate').value = affectedClips[0].rate || 1;
              container.querySelector('#rate-val').textContent = (affectedClips[0].rate || 1).toFixed(1) + 'x';
          } else {
              container.querySelector('#rate-container').style.display = 'none';
          }
      } else {
          hdr.innerHTML = `<h2 style="font-size: 16px; margin: 0; color: #22d3ee;">Master Bus</h2>
                           <p style="font-size: 11px; margin: 4px 0 0; color: #94a3b8;">Applied to final mixdown</p>`;
          tools.style.display = 'none';
      }
      
      const renderFxListHtml = (fxArr, kfObj = null) => {
          return fxArr.map((fx, idx) => {
              const def = FX_CATALOG[fx.type];
              const paramsHtml = Object.keys(def.params).map(pKey => {
                  const pDef = def.params[pKey];
                  // Determine value based on keyframe
                  let val = fx.params[pKey];
                  if (kfObj && kfObj.fxParams && kfObj.fxParams[fx.id] && kfObj.fxParams[fx.id][pKey] !== undefined) {
                      val = kfObj.fxParams[fx.id][pKey];
                  }
                  
                  return `
                    <div class="fx-param">
                       <div class="fx-param-label"><span>${pDef.label}</span> <span>${val}</span></div>
                       <input type="range" class="snd-slider param-slider" data-fx-idx="${idx}" data-param="${pKey}" min="${pDef.min}" max="${pDef.max}" step="${pDef.step}" value="${val}">
                    </div>
                  `;
              }).join('');
              return `
                <div class="fx-card">
                   <div class="fx-head">
                      <span style="color: #e2e8f0;">${def.name}</span>
                      <button class="snd-btn fx-del-btn" data-fx-idx="${idx}" style="padding: 4px; background: transparent; border: none; color: #ef4444;"><span class="material-symbols-outlined" style="font-size: 14px;">close</span></button>
                   </div>
                   <div class="fx-body">${paramsHtml}</div>
                </div>
              `;
          }).join('');
      };

      const bindFxSliders = (fxArr, kfObj = null) => {
          fxList.querySelectorAll('.param-slider').forEach(slider => {
              slider.addEventListener('input', e => {
                  const idx = parseInt(e.target.dataset.fxIdx);
                  const pKey = e.target.dataset.param;
                  const val = parseFloat(e.target.value);
                  e.target.previousElementSibling.children[1].textContent = val;
                  
                  if (kfObj) {
                      if (!kfObj.fxParams) kfObj.fxParams = {};
                      if (!kfObj.fxParams[fxArr[idx].id]) kfObj.fxParams[fxArr[idx].id] = {};
                      kfObj.fxParams[fxArr[idx].id][pKey] = val;
                  } else {
                      fxArr[idx].params[pKey] = val;
                      updateFxNodeParam(fxArr[idx], pKey, val); // update live node only for base
                  }
              });
              slider.addEventListener('change', () => {
                  rebuildPlayback(); // Rebuild always to bake automation natively
              });
          });
          fxList.querySelectorAll('.fx-del-btn').forEach(btn => {
              btn.addEventListener('click', e => {
                  const idx = parseInt(e.currentTarget.dataset.fxIdx);
                  fxArr.splice(idx, 1);
                  rebuildPlayback();
                  renderInspector();
                  renderTimeline();
              });
          });
      };

      if (!isMulti && affectedClips.length > 0) {
          const clip = affectedClips[0];
          fxMultiMsg.style.display = 'none';
          fxList.style.display = 'flex';
          
          if (clip.keyframes && clip.keyframes.length > 0) {
              kfNav.style.display = 'flex';
              if (activeKeyframeIdx >= clip.keyframes.length) activeKeyframeIdx = clip.keyframes.length - 1;
              if (activeKeyframeIdx === -1) {
                  kfLabel.textContent = 'Base Settings';
                  kfDelBtn.style.display = 'none';
                  fxList.innerHTML = renderFxListHtml(clip.fx);
                  bindFxSliders(clip.fx);
              } else {
                  kfLabel.textContent = `Keyframe ${activeKeyframeIdx + 1} of ${clip.keyframes.length}`;
                  kfDelBtn.style.display = 'block';
                  fxList.innerHTML = renderFxListHtml(clip.fx, clip.keyframes[activeKeyframeIdx]);
                  bindFxSliders(clip.fx, clip.keyframes[activeKeyframeIdx]);
              }
          } else {
              kfNav.style.display = 'none';
              activeKeyframeIdx = -1;
              fxList.innerHTML = renderFxListHtml(clip.fx);
              bindFxSliders(clip.fx);
          }
      } else if (isMulti) {
          kfNav.style.display = 'none';
          fxMultiMsg.style.display = 'block';
          fxList.style.display = 'none';
          fxList.innerHTML = '';
          
          const stagingArea = container.querySelector('#fx-staging-area');
          const applyBtn = container.querySelector('#btn-apply-fx-multi');
          if (stagedMultiFx) {
              stagingArea.innerHTML = renderFxListHtml([stagedMultiFx]);
              const delBtn = stagingArea.querySelector('.fx-del-btn');
              if (delBtn) delBtn.style.display = 'none';
              
              stagingArea.querySelectorAll('.param-slider').forEach(slider => {
                  slider.addEventListener('input', e => {
                      const pKey = e.target.dataset.param;
                      const val = parseFloat(e.target.value);
                      e.target.previousElementSibling.children[1].textContent = val;
                      stagedMultiFx.params[pKey] = val;
                  });
              });
              applyBtn.style.display = 'block';
          } else {
              stagingArea.innerHTML = '';
              applyBtn.style.display = 'none';
          }
      } else {
          kfNav.style.display = 'none';
          fxMultiMsg.style.display = 'none';
          fxList.style.display = 'flex';
          fxList.innerHTML = renderFxListHtml(project.masterFx);
          bindFxSliders(project.masterFx);
      }
  };
  let timelineView = null;
  const renderTimeline = () => {
      if (!timelineView) {
          timelineView = new TimelineView(container.querySelector('#snd-timeline-wrapper'), {
              pixelsPerSecond: pixelsPerSecond,
              onPlayheadMove: (time) => {
                  if (!isPlaying) Tone.Transport.seconds = time;
                  updatePlayheadDOM();
              },
              onClipSelect: (clipId, trackId, e) => {
                  if (e.shiftKey || e.metaKey) {
                      if (selectedItems.clips.has(clipId)) selectedItems.clips.delete(clipId);
                      else selectedItems.clips.add(clipId);
                  } else {
                      selectedItems.tracks.clear();
                      selectedItems.clips.clear();
                      selectedItems.clips.add(clipId);
                  }
                  renderInspector();
                  container.querySelectorAll('.snd-clip').forEach(el => {
                      if (selectedItems.clips.has(el.dataset.id)) el.classList.add('selected');
                      else el.classList.remove('selected');
                  });
              },
              onAddTrack: () => {
                  project.tracks.push({
                      id: 'trk_' + Date.now(),
                      name: `Track ${project.tracks.length + 1}`,
                      color: '#10b981',
                      clips: [],
                      muted: false
                  });
                  renderTimeline();
              },
              onZoom: (val) => {
                  pixelsPerSecond = val;
                  container.querySelector('#zoom-slider').value = val;
                  renderTimeline();
              },
              onSplitClip: () => {
                  const time = Tone.Transport.seconds;
                  let splitOccurred = false;
                  project.tracks.forEach(t => {
                      if (selectedItems.tracks.size > 0 && !selectedItems.tracks.has(t.id)) return;
                      const newClips = [];
                      t.clips.forEach(clip => {
                          if (time > clip.timelineStart && time < clip.timelineStart + clip.duration) {
                              if (selectedItems.clips.size > 0 && !selectedItems.clips.has(clip.id)) {
                                  newClips.push(clip);
                                  return;
                              }
                              const splitOffsetSec = time - clip.timelineStart;
                              const sourceOffset = splitOffsetSec * (clip.rate || 1);
                              
                              const clip2 = {
                                  id: 'clip_' + Date.now() + Math.random().toString(36).substr(2,5),
                                  name: clip.name + " (2)",
                                  buffer: null,
                                  poolId: clip.poolId,
                                  sourceStart: (clip.sourceStart || 0) + sourceOffset,
                                  timelineStart: clip.timelineStart + splitOffsetSec,
                                  duration: clip.duration - splitOffsetSec,
                                  rate: clip.rate,
                                  fx: cloneFx(clip.fx),
                                  keyframes: JSON.parse(JSON.stringify(clip.keyframes || [])),
                                  appliedActions: new Set(clip.appliedActions || [])
                              };
                              
                              clip.duration = splitOffsetSec;
                              
                              recomputeClipBuffer(clip);
                              recomputeClipBuffer(clip2);
                              
                              newClips.push(clip);
                              newClips.push(clip2);
                              splitOccurred = true;
                          } else {
                              newClips.push(clip);
                          }
                      });
                      t.clips = newClips;
                  });
                  if (splitOccurred) {
                      rebuildPlayback();
                      renderTimeline();
                  }
              },
              onDeleteSelected: () => {
                  if (selectedItems.clips.size > 0) {
                      showDialog('Delete Clip', 'Delete selected clip(s)?', true, () => {
                          project.tracks.forEach(t => {
                              t.clips = t.clips.filter(c => !selectedItems.clips.has(c.id));
                          });
                          selectedItems.clips.clear();
                          rebuildPlayback();
                          renderTimeline();
                          renderInspector();
                      });
                  } else if (selectedItems.tracks.size > 0) {
                      showDialog('Delete Track', 'Delete selected track(s)?', true, () => {
                          project.tracks = project.tracks.filter(t => !selectedItems.tracks.has(t.id));
                          selectedItems.tracks.clear();
                          rebuildPlayback();
                          renderTimeline();
                          renderInspector();
                      });
                  }
              },
              onClipDrag: (clipId, newTimeSec) => {
                  const clip = getClipById(clipId);
                  if (clip) clip.timelineStart = newTimeSec;
              },
              onClipDrop: (clipId) => {
                  rebuildPlayback();
                  renderTimeline();
              },
              onClipContextMenu: (clip, e) => {
                  e.preventDefault();
                  
                  if (!selectedItems.clips.has(clip.id)) {
                      selectedItems.tracks.clear();
                      selectedItems.clips.clear();
                      selectedItems.clips.add(clip.id);
                      
                      renderInspector();
                      container.querySelectorAll('.snd-clip').forEach(el => {
                          if (selectedItems.clips.has(el.dataset.id)) el.classList.add('selected');
                          else el.classList.remove('selected');
                      });
                  }
                  
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const splitOffsetSec = clickX / pixelsPerSecond;
                  
                  showContextMenu(e.clientX, e.clientY, [
                      { label: 'Add Keyframe Here', icon: 'key', action: () => {
                          if (!clip.keyframes) clip.keyframes = [];
                          const snapshot = getInterpolatedFxParams(clip, splitOffsetSec);
                          clip.keyframes.push({ offset: splitOffsetSec, fxParams: snapshot });
                          clip.keyframes.sort((a,b) => a.offset - b.offset);
                          rebuildPlayback();
                          renderTimeline();
                          renderInspector();
                      }},
                      { label: 'Split Clip Here', icon: 'content_cut', action: () => {
                          const sourceOffset = splitOffsetSec * (clip.rate || 1);
                          if (sourceOffset <= 0.1 || sourceOffset >= clip.duration - 0.1) return;
                          
                          const track = project.tracks.find(t => t.clips.includes(clip));
                          
                          const clip2 = {
                              id: 'clip_' + Date.now(),
                              name: clip.name + ' (2)',
                              buffer: null,
                              poolId: clip.poolId,
                              sourceStart: (clip.sourceStart || 0) + sourceOffset,
                              appliedActions: new Set(clip.appliedActions || []),
                              timelineStart: clip.timelineStart + splitOffsetSec,
                              duration: clip.duration - sourceOffset,
                              rate: clip.rate,
                              fx: cloneFx(clip.fx), 
                              keyframes: JSON.parse(JSON.stringify(clip.keyframes || []))
                          };
                          clip.duration = sourceOffset;
                          clip.name = clip.name + ' (1)';
                          
                          recomputeClipBuffer(clip);
                          recomputeClipBuffer(clip2);
                          
                          const idx = track.clips.indexOf(clip);
                          track.clips.splice(idx + 1, 0, clip2);
                          selectedItems.clips.clear();
                          rebuildPlayback();
                          renderTimeline();
                          renderInspector();
                      }}
                  ]);
              },
              onRenderTrackHeader: (track, hdr) => {
                  hdr.style.cursor = 'pointer';
                  hdr.onclick = (e) => {
                      if (e.target.closest('button')) return;
                      if (e.shiftKey || e.metaKey) {
                          if (selectedItems.tracks.has(track.id)) selectedItems.tracks.delete(track.id);
                          else selectedItems.tracks.add(track.id);
                      } else {
                          selectedItems.tracks.clear();
                          selectedItems.clips.clear();
                          selectedItems.tracks.add(track.id);
                      }
                      renderInspector();
                      renderTimeline();
                  };
                  
                  const tControls = document.createElement('div');
                  tControls.style.display = 'flex';
                  tControls.style.gap = '4px';
                  
                  const muteBtn = document.createElement('button');
                  muteBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px;">${track.muted ? 'volume_off' : 'volume_up'}</span>`;
                  muteBtn.style.background = 'none';
                  muteBtn.style.border = 'none';
                  muteBtn.style.color = track.muted ? '#f87171' : '#94a3b8';
                  muteBtn.style.cursor = 'pointer';
                  muteBtn.title = track.muted ? "Unmute Track" : "Mute Track";
                  muteBtn.onclick = () => {
                      track.muted = !track.muted;
                      rebuildPlayback();
                      renderTimeline();
                  };
                  
                  const delBtn = document.createElement('button');
                  delBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px;">delete</span>`;
                  delBtn.style.background = 'none';
                  delBtn.style.border = 'none';
                  delBtn.style.color = '#94a3b8';
                  delBtn.style.cursor = 'pointer';
                  delBtn.title = "Delete Track";
                  delBtn.onclick = () => {
                      showDialog('Delete Track?', `Are you sure you want to completely delete "${track.name}" and all its clips?`, true, () => {
                          project.tracks = project.tracks.filter(t => t.id !== track.id);
                          selectedItems.tracks.delete(track.id);
                          selectedItems.clips.forEach(cid => {
                              if (!getClipById(cid)) selectedItems.clips.delete(cid);
                          });
                          renderInspector();
                          rebuildPlayback();
                          renderTimeline();
                      });
                  };
                  
                  tControls.appendChild(muteBtn);
                  tControls.appendChild(delBtn);
                  hdr.appendChild(tControls);
              },
              onRenderClip: (clip, el) => {
                  const track = project.tracks.find(t => t.clips.includes(clip));
                  const isSelected = selectedItems.clips.has(clip.id) || (track && selectedItems.tracks.has(track.id));
                  
                  if (isSelected) {
                      el.style.borderColor = '#f472b6';
                      el.style.boxShadow = '0 0 0 2px #f472b6';
                  }
                  
                  const w = Math.max(1, (clip.duration / (clip.rate||1)) * pixelsPerSecond);
                  const cvs = document.createElement('canvas');
                  cvs.style.width = '100%';
                  cvs.style.height = '100%';
                  cvs.style.position = 'absolute';
                  cvs.style.inset = '0';
                  cvs.style.pointerEvents = 'none';
                  cvs.style.zIndex = '1';
                  el.appendChild(cvs);
                  
                  const buffer = clip.buffer || (clip.poolId ? project.mediaPool[clip.poolId] : null);
                  const drawStart = clip.buffer ? 0 : (clip.sourceStart || 0);
                  if (buffer) {
                      drawWaveformToCanvas(cvs, buffer, isSelected ? '#f472b6' : (track ? track.color : '#10b981'), w, 80, drawStart, clip.duration);
                  }
                  
                  if (clip.keyframes && clip.keyframes.length > 0) {
                      clip.keyframes.forEach((kf, idx) => {
                          const kfEl = document.createElement('div');
                          kfEl.style.position = 'absolute';
                          kfEl.style.left = `${kf.offset * pixelsPerSecond}px`;
                          kfEl.style.top = '50%';
                          kfEl.style.transform = 'translate(-50%, -50%) rotate(45deg)';
                          kfEl.style.width = '10px';
                          kfEl.style.height = '10px';
                          kfEl.style.background = '#ffffff';
                          kfEl.style.border = '2px solid #000000';
                          kfEl.style.boxShadow = '0 0 5px rgba(0,0,0,1)';
                          kfEl.style.zIndex = '10';
                          kfEl.title = `Keyframe ${idx+1}`;
                          kfEl.style.pointerEvents = 'none';
                          el.appendChild(kfEl);
                      });
                  }
                  if (clip.fx && clip.fx.length > 0) {
                      const fxBadge = document.createElement('div');
                      fxBadge.style.position = 'absolute';
                      fxBadge.style.bottom = '4px';
                      fxBadge.style.right = '4px';
                      fxBadge.style.background = '#db2777';
                      fxBadge.style.color = 'white';
                      fxBadge.style.fontSize = '9px';
                      fxBadge.style.fontWeight = 'bold';
                      fxBadge.style.padding = '2px 6px';
                      fxBadge.style.borderRadius = '4px';
                      fxBadge.style.pointerEvents = 'none';
                      fxBadge.style.zIndex = '10';
                      fxBadge.textContent = `${clip.fx.length} FX`;
                      el.appendChild(fxBadge);
                  }
              }
          });
      }
      timelineView.selectedTracks = selectedItems.tracks;
      timelineView.pixelsPerSecond = pixelsPerSecond;
      timelineView.setData(project.tracks);
  };

  const updatePlayheadDOM = () => {
      const time = Tone.Transport.seconds;
      if (timelineView) timelineView.setPlayhead(time, false);
      timeDisplay.textContent = formatTime(time);
      
      if (timelineView) {
          const phLeft = (time * pixelsPerSecond) + 140;
          const scrollArea = timelineView.dom.scrollArea;
          if (phLeft > scrollArea.scrollLeft + scrollArea.clientWidth - 50) {
              scrollArea.scrollLeft = phLeft - scrollArea.clientWidth + 50;
          }
      }
  };

  // ---------------- AUDIO ENGINE ----------------

  const rebuildPlayback = () => {
      const wasPlaying = isPlaying;
      Tone.Transport.stop();
      Tone.Transport.cancel(0); // Always clear all scheduled events!
      
      activeToneNodes.forEach(n => n.dispose && n.dispose());
      activeToneNodes = [];
      
      if (masterVolumeNode) masterVolumeNode.dispose();
      masterVolumeNode = new Tone.Volume(0).toDestination();
      activeToneNodes.push(masterVolumeNode);
      
      let masterIn = masterVolumeNode;
      [...project.masterFx].reverse().forEach(fxDef => {
          const node = createFxNode(fxDef);
          node.connect(masterIn);
          masterIn = node;
          activeToneNodes.push(node);
          fxDef._node = node; 
      });
      
      project.tracks.forEach(track => {
          if (track.muted) return; // Skip muted tracks
          
          track.clips.forEach(clip => {
              const buf = clip.buffer || (clip.poolId ? project.mediaPool[clip.poolId] : null);
              if (!buf) return;
              const player = new Tone.Player(buf);
              player.playbackRate = clip.rate || 1;
              
              let lastNode = player;
              clip.fx.forEach(fxDef => {
                  const node = createFxNode(fxDef);
                  lastNode.connect(node);
                  lastNode = node;
                  activeToneNodes.push(node);
                  fxDef._node = node; 
              });
              
              lastNode.connect(masterIn);
              activeToneNodes.push(player);
              const startOffset = clip.buffer ? 0 : (clip.sourceStart || 0);
              player.sync().start(clip.timelineStart, startOffset, clip.duration / player.playbackRate);
          });
      });
      
      if (wasPlaying) Tone.Transport.start();
  };

  const loadAudioFile = async (file) => {
      container.querySelector('#snd-intro').style.opacity = '0';
      container.querySelector('#snd-intro').style.pointerEvents = 'none';
      
      if (isPlaying) container.querySelector('#btn-stop').click();
      
      try {
          await Tone.start();
          const ctx = getAudioCtx();
          const arrayBuffer = await file.arrayBuffer();
          const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
          
          project.originalToneBuffer = decodedBuffer;
          project.masterFx = [];
          
          if (decodedBuffer.numberOfChannels > 1) {
              project.tracks = [];
              for(let i=0; i<decodedBuffer.numberOfChannels; i++) {
                  const monoBuf = extractChannel(decodedBuffer, i);
                  const poolId = 'pool_' + Date.now() + '_' + i;
                  project.mediaPool[poolId] = monoBuf;
                  project.tracks.push({
                      id: 'trk_' + i + '_' + Date.now(),
                      name: file.name + ` (Ch ${i+1})`,
                      color: i === 0 ? '#06b6d4' : '#f472b6',
                      muted: false,
                      clips: [{
                          id: 'clip_' + i + '_' + Date.now(),
                          name: file.name,
                          buffer: null,
                          poolId: poolId,
                          sourceStart: 0,
                          timelineStart: 0,
                          duration: monoBuf.duration,
                          rate: 1,
                          fx: [], keyframes: []
                      }]
                  });
              }
          } else {
              const poolId = 'pool_' + Date.now();
              project.mediaPool[poolId] = decodedBuffer;
              project.tracks = [
                  {
                      id: 'trk_1',
                      name: 'Main Track',
                      color: '#06b6d4',
                      muted: false,
                      clips: [{
                          id: 'clip_' + Date.now(),
                          name: file.name,
                          buffer: null,
                          poolId: poolId,
                          sourceStart: 0,
                          timelineStart: 0,
                          duration: decodedBuffer.duration,
                          rate: 1,
                          fx: [], keyframes: []
                      }]
                  }
              ];
          }
          
          selectedItems = { tracks: new Set(), clips: new Set() };
          rebuildPlayback();
          renderTimeline();
          renderInspector();
      } catch (err) {
          console.error("Audio Load Error:", err);
          alert("Failed to load audio: " + err.message);
          container.querySelector('#snd-intro').style.opacity = '1';
          container.querySelector('#snd-intro').style.pointerEvents = 'auto';
      }
  };

  // ---------------- EVENT BINDINGS ----------------

  container.querySelector('#snd-upload').addEventListener('change', e => {
      if (e.target.files[0]) loadAudioFile(e.target.files[0]);
  });
  
  container.querySelector('#snd-import').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = ''; // reset input
      
      try {
          const ctx = getAudioCtx();
          const arrayBuffer = await file.arrayBuffer();
          const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
          
          if (decodedBuffer.numberOfChannels > 1) {
              for(let i=0; i<decodedBuffer.numberOfChannels; i++) {
                  const monoBuf = extractChannel(decodedBuffer, i);
                  const poolId = 'pool_' + Date.now() + '_' + i;
                  project.mediaPool[poolId] = monoBuf;
                  project.tracks.push({
                      id: 'trk_' + i + '_' + Date.now(),
                      name: file.name + ` (Ch ${i+1})`,
                      color: '#10b981', // green for imported
                      muted: false,
                      clips: [{
                          id: 'clip_' + i + '_' + Date.now(),
                          name: file.name,
                          buffer: null,
                          poolId: poolId,
                          sourceStart: 0,
                          timelineStart: Tone.Transport.seconds,
                          duration: monoBuf.duration,
                          rate: 1,
                          fx: [], keyframes: []
                      }]
                  });
              }
          } else {
              const poolId = 'pool_' + Date.now();
              project.mediaPool[poolId] = decodedBuffer;
              project.tracks.push({
                  id: 'trk_' + Date.now(),
                  name: file.name,
                  color: '#10b981',
                  muted: false,
                  clips: [{
                      id: 'clip_' + Date.now(),
                      name: file.name,
                      buffer: null,
                      poolId: poolId,
                      sourceStart: 0,
                      timelineStart: Tone.Transport.seconds,
                      duration: decodedBuffer.duration,
                      rate: 1,
                      fx: [], keyframes: []
                  }]
              });
          }
          rebuildPlayback();
          renderTimeline();
      } catch (err) {
          alert("Import failed: " + err.message);
      }
  });
  
  container.querySelector('#btn-close').addEventListener('click', () => {
      showDialog('Close Session', 'Are you sure you want to close this audio session? Unsaved changes will be lost.', true, () => {
          if (isPlaying) container.querySelector('#btn-stop').click();
          project = { originalToneBuffer: null, tracks: [], masterFx: [], mediaPool: {} };
          activeToneNodes.forEach(n => n.dispose && n.dispose());
          activeToneNodes = [];
          
          container.querySelector('#snd-intro').style.opacity = '1';
          container.querySelector('#snd-intro').style.pointerEvents = 'auto';
          
          selectedItems = { tracks: new Set(), clips: new Set() };
          renderTimeline();
          renderInspector();
      });
  });

  // Transport
  let lastLogTime = 0;
  
  const loop = () => {
      if (!isPlaying) return;
      updatePlayheadDOM();
      
      const currentTransportTime = Tone.Transport.seconds;
      project.tracks.forEach(t => {
          if (t.muted) return;
          t.clips.forEach(clip => {
              if (currentTransportTime >= clip.timelineStart && currentTransportTime <= clip.timelineStart + clip.duration) {
                  const clipLocalTime = currentTransportTime - clip.timelineStart;
                  
                  if (clip.keyframes && clip.keyframes.length > 0) {
                      clip.fx.forEach(fxDef => {
                          if (!fxDef._node) return;
                          Object.keys(fxDef.params).forEach(pKey => {
                              let val = fxDef.params[pKey];
                              let prevTime = 0;
                              let prevVal = val;
                              let nextTime = null;
                              let nextVal = null;
                              
                              clip.keyframes.forEach(kf => {
                                  let kfVal = fxDef.params[pKey]; // Fallback to base setting if untouched
                                  if (kf.fxParams && kf.fxParams[fxDef.id] && kf.fxParams[fxDef.id][pKey] !== undefined) {
                                      kfVal = kf.fxParams[fxDef.id][pKey];
                                  }
                                  
                                  if (kf.offset <= clipLocalTime) {
                                      prevTime = kf.offset;
                                      prevVal = kfVal;
                                  } else if (nextTime === null && kf.offset > clipLocalTime) {
                                      nextTime = kf.offset;
                                      nextVal = kfVal;
                                  }
                              });
                              
                              if (nextTime !== null && nextTime !== prevTime) {
                                  const progress = (clipLocalTime - prevTime) / (nextTime - prevTime);
                                  val = prevVal + (nextVal - prevVal) * progress;
                              } else {
                                  val = prevVal;
                              }
                              
                              // Log every 1 second to avoid spamming
                              if (Date.now() - lastLogTime > 1000) {
                                  console.log(`[LOOP DEBUG] Time: ${clipLocalTime.toFixed(2)}s | Parameter: ${pKey} | Calculated Val: ${val.toFixed(2)} | Target Node:`, fxDef._node);
                              }
                              
                              updateFxNodeParam(fxDef, pKey, val);
                          });
                      });
                  }
              }
          });
      });
      
      if (Date.now() - lastLogTime > 1000) lastLogTime = Date.now();
      
      playLoopId = requestAnimationFrame(loop);
  };
  
  container.querySelector('#btn-save-proj').addEventListener('click', async () => {
      try {
          const zip = new JSZip();
          const buffers = new Map();
          
          const poolMeta = {};
          for (const [poolId, audioBuf] of Object.entries(project.mediaPool || {})) {
              buffers.set(poolId + '.bin', audioBuf);
              poolMeta[poolId] = {
                  sampleRate: audioBuf.sampleRate,
                  channels: audioBuf.numberOfChannels,
                  length: audioBuf.length
              };
          }
          
          const projClean = {
              mediaPoolMeta: poolMeta,
              tracks: project.tracks.map(t => ({
                  id: t.id,
                  name: t.name,
                  muted: t.muted,
                  color: t.color,
                  clips: t.clips.map(c => {
                      return {
                          id: c.id,
                          name: c.name,
                          timelineStart: c.timelineStart,
                          duration: c.duration,
                          rate: c.rate,
                          poolId: c.poolId,
                          sourceStart: c.sourceStart,
                          fx: c.fx.map(f => ({ id: f.id, type: f.type, params: f.params })),
                          keyframes: c.keyframes,
                          appliedActions: Array.from(c.appliedActions || [])
                      };
                  })
              }))
          };
          
          zip.file('project.json', JSON.stringify(projClean, null, 2));
          const assetsFolder = zip.folder('assets');
          
          for (const [bufId, audioBuf] of buffers.entries()) {
              const numChannels = audioBuf.numberOfChannels;
              const len = audioBuf.length;
              const rawData = new Float32Array(numChannels * len);
              for (let ch = 0; ch < numChannels; ch++) {
                  const chData = audioBuf.getChannelData(ch);
                  for (let i = 0; i < len; i++) {
                      rawData[i * numChannels + ch] = chData[i];
                  }
              }
              assetsFolder.file(bufId, rawData.buffer);
          }
          
          const blob = await zip.generateAsync({ type: 'blob' });
          
          if (window.showSaveFilePicker) {
              const fileHandle = await window.showSaveFilePicker({
                  suggestedName: 'MyAudioProject.audioproject',
                  types: [{
                      description: 'Audio Studio Project',
                      accept: {'application/x-audioproject': ['.audioproject']}
                  }]
              });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
          } else {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'MyAudioProject.audioproject';
              a.click();
              URL.revokeObjectURL(url);
          }
          
      } catch (err) {
          console.error(err);
          if (err.name !== 'AbortError') alert("Failed to save project: " + err.message);
      }
  });
  
  container.querySelector('#btn-new-proj').addEventListener('click', () => {
      showDialog('New Session', 'Create a new project? Unsaved changes will be lost.', true, () => {
          if (isPlaying) container.querySelector('#btn-stop').click();
          project = { originalToneBuffer: null, tracks: [], masterFx: [], mediaPool: {} };
          activeToneNodes.forEach(n => n.dispose && n.dispose());
          activeToneNodes = [];
          
          container.querySelector('#snd-intro').style.opacity = '1';
          container.querySelector('#snd-intro').style.pointerEvents = 'auto';
          
          selectedItems = { tracks: new Set(), clips: new Set() };
          renderTimeline();
          renderInspector();
      });
  });
  
  container.querySelector('#snd-upload-proj').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
          const zip = new JSZip();
          await zip.loadAsync(file);
          
          const metaFile = zip.file('project.json');
          if (!metaFile) throw new Error("Invalid project format: missing project.json");
          
          const metaText = await metaFile.async('string');
          const data = JSON.parse(metaText);
          
          project.mediaPool = {};
          if (data.mediaPoolMeta) {
              for (const [poolId, meta] of Object.entries(data.mediaPoolMeta)) {
                  const binFile = zip.file(`assets/${poolId}.bin`);
                  if (binFile) {
                      const arrayBuf = await binFile.async('arraybuffer');
                      const rawData = new Float32Array(arrayBuf);
                      const ctx = getAudioCtx();
                      const audioBuf = ctx.createBuffer(meta.channels, meta.length, meta.sampleRate);
                      for (let ch = 0; ch < meta.channels; ch++) {
                          const chData = audioBuf.getChannelData(ch);
                          for (let i = 0; i < meta.length; i++) {
                              chData[i] = rawData[i * meta.channels + ch];
                          }
                      }
                      project.mediaPool[poolId] = audioBuf;
                  }
              }
          }
          
          project.tracks = data.tracks;
          
          for (const t of project.tracks) {
              for (const c of t.clips) {
                  c.appliedActions = new Set(c.appliedActions || []);
                  if (c.bufferFile && c.bufferMeta) {
                      const binFile = zip.file(`assets/${c.bufferFile}`);
                      if (binFile) {
                          const arrayBuf = await binFile.async('arraybuffer');
                          const rawData = new Float32Array(arrayBuf);
                          
                          const ctx = getAudioCtx();
                          const audioBuf = ctx.createBuffer(c.bufferMeta.channels, c.bufferMeta.length, c.bufferMeta.sampleRate);
                          for (let ch = 0; ch < c.bufferMeta.channels; ch++) {
                              const chData = audioBuf.getChannelData(ch);
                              for (let i = 0; i < c.bufferMeta.length; i++) {
                                  chData[i] = rawData[i * c.bufferMeta.channels + ch];
                              }
                          }
                          c.originalBuffer = audioBuf;
                      }
                  }
              }
          }
          
          project.tracks.forEach(t => t.clips.forEach(c => {
              if (c.originalBuffer) recomputeClipBuffer(c);
          }));
          
          container.querySelector('#snd-intro').style.opacity = '0';
          container.querySelector('#snd-intro').style.pointerEvents = 'none';
          selectedItems = { tracks: new Set(), clips: new Set() };
          renderTimeline();
          renderInspector();
          rebuildPlayback();
          
      } catch (err) {
          console.error(err);
          alert("Failed to load project: " + err.message);
      }
      e.target.value = '';
  });

  container.querySelector('#btn-play').addEventListener('click', async () => {
      await Tone.start();
      window._debugAudio = true; // enable logging
      if (isPlaying) {
          isPlaying = false;
          Tone.Transport.pause();
          container.querySelector('#btn-play').innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
          container.querySelector('#btn-play').className = 'snd-btn snd-btn-primary';
      } else {
          isPlaying = true;
          Tone.Transport.start();
          playLoopId = requestAnimationFrame(loop);
          console.log("[PLAY CLICKED] Starting 60fps interpolation loop...");
          container.querySelector('#btn-play').innerHTML = '<span class="material-symbols-outlined">pause</span>';
          container.querySelector('#btn-play').className = 'snd-btn snd-btn-pink';
      }
  });
  
  container.querySelector('#btn-stop').addEventListener('click', () => {
      isPlaying = false;
      Tone.Transport.stop();
      Tone.Transport.seconds = 0;
      updatePlayheadDOM();
      container.querySelector('#btn-play').innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      container.querySelector('#btn-play').className = 'snd-btn snd-btn-primary';
  });


  container.querySelector('#btn-kf-prev')?.addEventListener('click', () => {
      if (activeKeyframeIdx > -1) {
          activeKeyframeIdx--;
          renderInspector();
      }
  });
  container.querySelector('#btn-kf-next')?.addEventListener('click', () => {
      const affectedClips = getAffectedClips();
      if (affectedClips.length === 1) {
          const clip = affectedClips[0];
          if (clip.keyframes && activeKeyframeIdx < clip.keyframes.length - 1) {
              activeKeyframeIdx++;
              renderInspector();
          }
      }
  });
  container.querySelector('#btn-kf-delete')?.addEventListener('click', () => {
      const affectedClips = getAffectedClips();
      if (affectedClips.length === 1) {
          const clip = affectedClips[0];
          if (clip.keyframes && activeKeyframeIdx >= 0) {
              clip.keyframes.splice(activeKeyframeIdx, 1);
              activeKeyframeIdx = -1;
              rebuildPlayback();
              renderTimeline();
              renderInspector();
          }
      }
  });

  container.querySelector('#zoom-slider').addEventListener('input', e => {
      pixelsPerSecond = parseInt(e.target.value);
      renderTimeline();
      updatePlayheadDOM();
  });

  container.querySelector('#btn-apply-fx-multi').addEventListener('click', () => {
      if (!stagedMultiFx) return;
      const affectedClips = getAffectedClips();
      const replace = container.querySelector('#fx-replace-checkbox')?.checked;
      
      affectedClips.forEach(clip => {
          if (replace) clip.fx = [];
          clip.fx.push(JSON.parse(JSON.stringify(stagedMultiFx)));
      });
      
      stagedMultiFx = null;
      rebuildPlayback();
      renderInspector();
      renderTimeline();
  });

  container.querySelector('#fx-add-select').addEventListener('change', e => {
      const type = e.target.value;
      if (!type) return;
      const def = FX_CATALOG[type];
      const newFx = { id: 'fx_' + Date.now(), type: type, params: {} };
      Object.keys(def.params).forEach(k => newFx.params[k] = def.params[k].default);
      
      const affectedClips = getAffectedClips();
      const isMulti = affectedClips.length > 1;
      
      if (!isMulti) {
          if (affectedClips.length === 0) project.masterFx.push(newFx);
          else {
              affectedClips[0].fx.push(newFx);
              
              if (activeKeyframeIdx !== -1) {
                  const clip = affectedClips[0];
                  const kfObj = clip.keyframes[activeKeyframeIdx];
                  
                  if (!kfObj.fxParams) kfObj.fxParams = {};
                  kfObj.fxParams[newFx.id] = {};
                  
                  Object.keys(def.params).forEach(k => {
                      // Save active default to the keyframe
                      kfObj.fxParams[newFx.id][k] = def.params[k].default;
                      
                      // Neutralize the base setting so it doesn't bleed everywhere
                      if (k === 'wet') newFx.params[k] = 0;
                      if (k === 'pitch') newFx.params[k] = 0;
                      if (k === 'distortion') newFx.params[k] = 0;
                  });
              }
          }
          e.target.value = '';
          rebuildPlayback();
          renderInspector();
          renderTimeline();
      } else {
          stagedMultiFx = newFx;
          e.target.value = '';
          renderInspector();
      }
  });

  container.querySelector('#clip-rate').addEventListener('change', e => {
      const affectedClips = getAffectedClips();
      if(affectedClips.length === 1) {
          affectedClips[0].rate = parseFloat(e.target.value);
          rebuildPlayback();
          renderTimeline();
      }
  });
  
  const getInterpolatedFxParams = (clip, targetOffset) => {
      const snap = {};
      clip.fx.forEach(fxDef => {
          snap[fxDef.id] = {};
          Object.keys(fxDef.params).forEach(pKey => {
              let val = fxDef.params[pKey];
              let prevTime = 0;
              let prevVal = val;
              let nextTime = null;
              let nextVal = null;
              
              if (clip.keyframes && clip.keyframes.length > 0) {
                  clip.keyframes.forEach(kf => {
                      let kfVal = fxDef.params[pKey];
                      if (kf.fxParams && kf.fxParams[fxDef.id] && kf.fxParams[fxDef.id][pKey] !== undefined) {
                          kfVal = kf.fxParams[fxDef.id][pKey];
                      }
                      if (kf.offset <= targetOffset) {
                          prevTime = kf.offset;
                          prevVal = kfVal;
                      } else if (nextTime === null && kf.offset > targetOffset) {
                          nextTime = kf.offset;
                          nextVal = kfVal;
                      }
                  });
              }
              
              if (nextTime !== null && nextTime !== prevTime) {
                  const progress = (targetOffset - prevTime) / (nextTime - prevTime);
                  val = prevVal + (nextVal - prevVal) * progress;
              } else {
                  val = prevVal;
              }
              snap[fxDef.id][pKey] = val;
          });
      });
      return snap;
  };


  const toggleClipAction = (clips, actionId) => {
      clips.forEach(c => {
          if (!c.appliedActions) c.appliedActions = new Set();
          if (c.appliedActions.has(actionId)) c.appliedActions.delete(actionId);
          else c.appliedActions.add(actionId);
          recomputeClipBuffer(c);
      });
      rebuildPlayback();
      renderInspector();
      renderTimeline();
  };

  const applyDestructiveToClips = (clips, fn) => {
      clips.forEach(c => c.buffer = fn(c.buffer));
      rebuildPlayback();
      renderTimeline();
  };

  const autoSplitClip = (clip) => {
      const audioBuf = clip.buffer || (clip.poolId ? project.mediaPool[clip.poolId] : null);
      if (!audioBuf) return [clip];
      
      const startOffset = clip.buffer ? 0 : (clip.sourceStart || 0);
      const slice = sliceAudioBuffer(audioBuf, startOffset, startOffset + clip.duration);
      const bufferData = slice.getChannelData(0);
      const sr = slice.sampleRate;
      const windowSize = Math.floor(sr * 0.05); 
      let segments = [];
      let currentStart = null;
      let silentFrames = 0;
      
      for (let i = 0; i < bufferData.length; i += windowSize) {
          let sum = 0;
          const end = Math.min(i + windowSize, bufferData.length);
          for (let j = i; j < end; j++) sum += bufferData[j] * bufferData[j];
          const rms = Math.sqrt(sum / (end - i));
          
          if (rms < 0.015) {
              silentFrames++;
              if ((silentFrames * windowSize)/sr >= 0.4 && currentStart !== null) {
                  segments.push({ start: currentStart, end: (i / sr) - 0.4 + 0.1 }); 
                  currentStart = null;
              }
          } else {
              silentFrames = 0;
              if (currentStart === null) currentStart = Math.max(0, (i / sr) - 0.1); 
          }
      }
      if (currentStart !== null) segments.push({ start: currentStart, end: bufferData.length / sr });
      
      if (segments.length === 0 || (segments.length === 1 && segments[0].start <= 0.1 && segments[0].end >= clip.duration - 0.2)) {
          return [clip];
      }
      
      return segments.map((seg, i) => {
          const newClip = {
              id: 'clip_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
              name: clip.name + ` (Part ${i+1})`,
              buffer: null,
              poolId: clip.poolId,
              sourceStart: (clip.sourceStart || 0) + seg.start,
              appliedActions: new Set(clip.appliedActions || []),
              timelineStart: clip.timelineStart + seg.start,
              duration: seg.end - seg.start,
              rate: clip.rate,
              fx: cloneFx(clip.fx), keyframes: JSON.parse(JSON.stringify(clip.keyframes || []))
          };
          recomputeClipBuffer(newClip);
          return newClip;
      });
  };

  container.querySelector('#clip-tools-container').addEventListener('click', async e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.id;
      
      const affectedClips = getAffectedClips();
      if (affectedClips.length === 0) return;
      
      if (id === 'btn-norm') toggleClipAction(affectedClips, 'norm');
      if (id === 'btn-rev') toggleClipAction(affectedClips, 'rev');
      if (id === 'btn-inv') toggleClipAction(affectedClips, 'inv');
      if (id === 'btn-fade-in') toggleClipAction(affectedClips, 'fade-in');
      if (id === 'btn-fade-out') toggleClipAction(affectedClips, 'fade-out');
      
      if (id === 'btn-delete') {
          showDialog('Delete Selected?', `Are you sure you want to destructively delete ${affectedClips.length} clip(s)?`, true, () => {
              project.tracks.forEach(t => {
                  t.clips = t.clips.filter(c => !affectedClips.includes(c));
              });
              selectedItems.clips.clear();
              renderInspector();
              renderTimeline();
              rebuildPlayback();
          });
      }
      
      if (id === 'btn-join-clips') {
          let track = null;
          let c1 = null, c2 = null;
          for (const t of project.tracks) {
              const selectedInTrack = t.clips.filter(c => affectedClips.includes(c));
              if (selectedInTrack.length === 2) {
                  track = t;
                  selectedInTrack.sort((a,b) => a.timelineStart - b.timelineStart);
                  c1 = selectedInTrack[0];
                  c2 = selectedInTrack[1];
                  break;
              }
          }
          if (track && c1 && c2) {
              // Join the two clips by extending the first one's duration
              c1.duration = (c2.timelineStart + c2.duration) - c1.timelineStart;
              
              // To handle playback properly across the unified clip, we must concatenate their buffers
              if (c1.buffer && c2.buffer) {
                  const newLen = c1.buffer.length + c2.buffer.length;
                  const newBuf = Tone.context.createBuffer(c1.buffer.numberOfChannels, newLen, c1.buffer.sampleRate);
                  for(let i=0; i<newBuf.numberOfChannels; i++) {
                      const channelData = newBuf.getChannelData(i);
                      channelData.set(c1.buffer.getChannelData(i), 0);
                      channelData.set(c2.buffer.getChannelData(i), c1.buffer.length);
                  }
                  c1.buffer = newBuf;
                  c1.originalBuffer = newBuf;
              }
              
              // Remove the second clip
              track.clips = track.clips.filter(c => c !== c2);
              selectedItems.clips.delete(c2.id);
              
              renderInspector();
              renderTimeline();
              rebuildPlayback();
          }
      }
      
      if (id === 'btn-auto-split') {
          const clipsToSplit = [...affectedClips];
          project.tracks.forEach(track => {
              const newTrackClips = [];
              track.clips.forEach(clip => {
                  if (clipsToSplit.includes(clip)) {
                      newTrackClips.push(...autoSplitClip(clip));
                  } else {
                      newTrackClips.push(clip);
                  }
              });
              track.clips = newTrackClips;
          });
          renderTimeline();
          rebuildPlayback();
          renderInspector();
      }
      
            
      if (id === 'btn-diarize') {
          let targetTrack = project.tracks.find(t => selectedItems.tracks.has(t.id));
          if (!targetTrack || targetTrack.clips.length !== 1) {
              alert('Diarization requires selecting a single track containing exactly one continuous clip.');
              return;
          }
          
          showDialog('Diarize Track?', 'This will run AI analysis to separate speakers into different tracks. This might take a few moments. Continue?', true, async () => {
              const mdl = document.getElementById('mdl');
              mdl.style.display = 'flex';
              document.getElementById('mdl-title').textContent = 'Diarizing Audio...';
              document.getElementById('mdl-desc').textContent = 'Loading Pyannote segmentation model...';
              
              try {
                  const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js');
                  env.allowLocalModels = false;
                  
                  const segmenter = await pipeline('audio-frame-classification', 'onnx-community/pyannote-segmentation-3.0', {
                      progress_callback: (info) => {
                          if(info.status === 'downloading') {
                              document.getElementById('mdl-desc').textContent = `Downloading AI model: ${info.name}...`;
                          }
                      }
                  });
                  
                  document.getElementById('mdl-desc').textContent = 'Downsampling audio to 16kHz for inference...';
                  
                  const clip = targetTrack.clips[0];
                  const offlineCtx = new OfflineAudioContext(1, clip.buffer.duration * 16000, 16000);
                  const source = offlineCtx.createBufferSource();
                  source.buffer = clip.buffer;
                  source.connect(offlineCtx.destination);
                  source.start(0);
                  const downsampledBuf = await offlineCtx.startRendering();
                  
                  const audioData = downsampledBuf.getChannelData(0);
                  
                  document.getElementById('mdl-desc').textContent = 'Analyzing speakers (this may take a while)...';
                  const result = await segmenter(audioData, { sample_rate: 16000 });
                  
                  mdl.style.display = 'none';
                  
                  if (!result || result.length === 0) {
                      alert('No speech segments detected.');
                      return;
                  }
                  
                  const speakerTracks = {};
                  result.forEach((seg, i) => {
                      if (!speakerTracks[seg.label]) {
                          speakerTracks[seg.label] = {
                              id: 'trk_' + seg.label,
                              name: `Speaker ${seg.label}`,
                              color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                              muted: false,
                              clips: []
                          };
                      }
                      
                      const start = seg.start;
                      const end = seg.end;
                      
                      const slicedBuf = sliceAudioBuffer(clip.originalBuffer || clip.buffer, start, end);
                      
                      const newClip = {
                          id: 'clip_' + seg.label + '_' + i,
                          name: `${seg.label} [${start.toFixed(1)}s]`,
                          buffer: null,
                          originalBuffer: slicedBuf,
                          appliedActions: new Set(clip.appliedActions || []),
                          timelineStart: clip.timelineStart + start,
                          duration: end - start,
                          rate: clip.rate,
                          fx: cloneFx(clip.fx), keyframes: JSON.parse(JSON.stringify(clip.keyframes || []))
                      };
                      recomputeClipBuffer(newClip);
                      speakerTracks[seg.label].clips.push(newClip);
                  });
                  
                  // Replace target track with new separated tracks
                  const trackIdx = project.tracks.findIndex(t => t.id === targetTrack.id);
                  project.tracks.splice(trackIdx, 1, ...Object.values(speakerTracks));
                  
                  selectedItems = { tracks: new Set(), clips: new Set() };
                  renderTimeline();
                  rebuildPlayback();
                  renderInspector();
              } catch (err) {
                  mdl.style.display = 'none';
                  alert('Diarization failed: ' + err.message);
              }
          });
      }
      if (id === 'btn-remove-gaps') {
          project.tracks.forEach(t => {
              if (selectedItems.tracks.has(t.id)) {
                  let currentStart = 0;
                  t.clips.sort((a,b) => a.timelineStart - b.timelineStart).forEach(c => {
                      c.timelineStart = currentStart;
                      currentStart += (c.duration / (c.rate||1));
                  });
              }
          });
          renderTimeline();
          rebuildPlayback();
      }
  });

  // Export
  container.querySelector('#btn-export').addEventListener('click', async () => {
      let maxTime = 0;
      project.tracks.forEach(t => {
          if (t.muted) return;
          t.clips.forEach(c => {
              const end = c.timelineStart + (c.duration / (c.rate||1));
              if (end > maxTime) maxTime = end;
          });
      });
      if (maxTime === 0) return;
      
      const btn = container.querySelector('#btn-export');
      btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span> Rendering...';
      btn.disabled = true;
      
      try {
          const offlineBuffer = await Tone.Offline(({ transport }) => {
              const mVol = new Tone.Volume().toDestination();
              let mNode = mVol;
              [...project.masterFx].reverse().forEach(fx => {
                  const node = createFxNode(fx);
                  node.connect(mNode);
                  mNode = node;
              });
              
              project.tracks.forEach(track => {
                  if (track.muted) return;
                  track.clips.forEach(clip => {
                      const player = new Tone.Player(clip.buffer);
                      player.playbackRate = clip.rate || 1;
                      
                      let lastNode = player;
                      clip.fx.forEach(fx => {
                          const node = createFxNode(fx);
                          lastNode.connect(node);
                          lastNode = node;
                      });
                      lastNode.connect(mNode);
                      player.sync().start(clip.timelineStart, 0, clip.duration / player.playbackRate);
                  });
              });
              transport.start(0);
          }, maxTime + 2);
          
          const wavBlob = audioBufferToWav(offlineBuffer.get());
          const a = document.createElement('a');
          a.href = URL.createObjectURL(wavBlob);
          a.download = 'zumi_export_' + Date.now() + '.wav';
          a.click();
      } catch (err) {
          alert('Export failed: ' + err.message);
      } finally {
          btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">download_for_offline</span> Export Final';
          btn.disabled = false;
      }
  });

}
