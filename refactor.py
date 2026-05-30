import re

with open('app/src/screens/snd.js', 'r') as f:
    code = f.read()

# 1. State
code = code.replace("let selectedClipId = null;", "let selectedItems = { tracks: new Set(), clips: new Set() };")

# 2. Getters
old_get = """  const getSelectedClip = () => {
      if (!selectedClipId) return null;
      for(let t of project.tracks) {
          const c = t.clips.find(clip => clip.id === selectedClipId);
          if (c) return c;
      }
      return null;
  };"""
new_get = """  const getAffectedClips = () => {
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
  };"""
code = code.replace(old_get, new_get)

# 3. HTML sidebar
old_sb = """            <div id="clip-tools-container" style="display:none; flex-direction: column; gap: 12px;">
                <div class="fx-title">CLIP ACTIONS</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button class="snd-btn" id="btn-norm">Normalize</button>
                    <button class="snd-btn" id="btn-rev">Reverse</button>
                    <button class="snd-btn" id="btn-inv">Invert Phase</button>
                    <button class="snd-btn" id="btn-fade-in">Fade In 1s</button>
                    <button class="snd-btn" id="btn-fade-out">Fade Out 1s</button>
                    <button class="snd-btn snd-btn-pink" id="btn-delete">Delete Clip</button>
                </div>
                <div style="margin-top: 8px;">
                   <label class="snd-text-mono" style="color: #94a3b8; display: flex; justify-content: space-between;"><span>Playback Rate</span><span id="rate-val">1.0x</span></label>
                   <input type="range" id="clip-rate" class="snd-slider" min="0.5" max="2" step="0.1" value="1" style="margin-top: 8px;">
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div class="fx-title">EFFECTS RACK</div>
                <div id="fx-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
                <select id="fx-add-select" class="snd-select">"""
new_sb = """            <div id="clip-tools-container" style="display:none; flex-direction: column; gap: 12px;">
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
                    Applying an effect will add it to all selected clips.<br><br>
                    <label style="display: flex; align-items: center; gap: 8px; color: #e2e8f0; cursor: pointer;">
                        <input type="checkbox" id="fx-replace-checkbox"> Replace existing effects
                    </label>
                </div>
                <div id="fx-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
                <select id="fx-add-select" class="snd-select">"""
code = code.replace(old_sb, new_sb)

# 4. HTML toolbar
old_tb = """                <button id="btn-auto-split" class="snd-btn"><span class="material-symbols-outlined" style="font-size: 16px;">content_cut</span> Auto-Split</button>
                <button id="btn-remove-gaps" class="snd-btn snd-btn-purple"><span class="material-symbols-outlined" style="font-size: 16px;">compress</span> Remove Gaps</button>
                <button id="btn-diarize" class="snd-btn snd-btn-blue"><span class="material-symbols-outlined" style="font-size: 16px;">group</span> Diarize (Speakers)</button>"""
new_tb = """                <button id="btn-diarize" class="snd-btn snd-btn-blue"><span class="material-symbols-outlined" style="font-size: 16px;">group</span> Diarize (Speakers)</button>"""
code = code.replace(old_tb, new_tb)

# 5. Track Header
old_th = """          const hdr = document.createElement('div');
          hdr.className = 'snd-track-header';
          
          const nameDiv = document.createElement('div');"""
new_th = """          const hdr = document.createElement('div');
          hdr.className = 'snd-track-header';
          if (selectedItems.tracks.has(track.id)) {
              hdr.style.background = 'rgba(244,114,182,0.2)';
              hdr.style.borderRightColor = '#f472b6';
              hdr.style.color = '#f472b6';
          }
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
          
          const nameDiv = document.createElement('div');"""
code = code.replace(old_th, new_th)

# 6. Clip selection logic
old_clip = """          track.clips.forEach(clip => {
              const clipEl = document.createElement('div');
              clipEl.className = `snd-clip ${clip.id === selectedClipId ? 'selected' : ''}`;
              clipEl.dataset.id = clip.id;
              
              const w = Math.max(1, (clip.duration / (clip.rate||1)) * pixelsPerSecond);
              clipEl.style.left = `${clip.timelineStart * pixelsPerSecond}px`;
              clipEl.style.width = `${w}px`;
              if (clip.id !== selectedClipId) clipEl.style.borderColor = track.color;
              
              const lbl = document.createElement('div');
              lbl.className = 'snd-clip-name';
              lbl.textContent = clip.name;
              clipEl.appendChild(lbl);
              
              const cvs = document.createElement('canvas');
              cvs.style.width = '100%';
              cvs.style.height = '100%';
              cvs.style.position = 'absolute';
              cvs.style.inset = '0';
              cvs.style.pointerEvents = 'none';
              clipEl.appendChild(cvs);
              
              // We explicitly pass the pixel dimensions to draw the buffer!
              drawWaveformToCanvas(cvs, clip.buffer, clip.id === selectedClipId ? '#f472b6' : track.color, w, 80);"""

new_clip = """          track.clips.forEach(clip => {
              const clipEl = document.createElement('div');
              const isSelected = selectedItems.clips.has(clip.id) || selectedItems.tracks.has(track.id);
              clipEl.className = `snd-clip ${isSelected ? 'selected' : ''}`;
              clipEl.dataset.id = clip.id;
              
              const w = Math.max(1, (clip.duration / (clip.rate||1)) * pixelsPerSecond);
              clipEl.style.left = `${clip.timelineStart * pixelsPerSecond}px`;
              clipEl.style.width = `${w}px`;
              if (!isSelected) clipEl.style.borderColor = track.color;
              
              const lbl = document.createElement('div');
              lbl.className = 'snd-clip-name';
              lbl.textContent = clip.name;
              clipEl.appendChild(lbl);
              
              const cvs = document.createElement('canvas');
              cvs.style.width = '100%';
              cvs.style.height = '100%';
              cvs.style.position = 'absolute';
              cvs.style.inset = '0';
              cvs.style.pointerEvents = 'none';
              clipEl.appendChild(cvs);
              
              // We explicitly pass the pixel dimensions to draw the buffer!
              drawWaveformToCanvas(cvs, clip.buffer, isSelected ? '#f472b6' : track.color, w, 80);"""
code = code.replace(old_clip, new_clip)

# 7. Delete track confirm
old_del_tr = """                  project.tracks = project.tracks.filter(t => t.id !== track.id);
                  if (selectedClipId && !getClipById(selectedClipId)) {
                      selectedClipId = null;
                      renderInspector();
                  }
                  rebuildPlayback();
                  renderTimeline();"""
new_del_tr = """                  project.tracks = project.tracks.filter(t => t.id !== track.id);
                  selectedItems.tracks.delete(track.id);
                  selectedItems.clips.forEach(cid => {
                      if (!getClipById(cid)) selectedItems.clips.delete(cid);
                  });
                  renderInspector();
                  rebuildPlayback();
                  renderTimeline();"""
code = code.replace(old_del_tr, new_del_tr)

# 8. renderInspector
start_insp = code.find("  const renderInspector = () => {")
end_insp = code.find("  const renderTimeline = () => {")
old_insp = code[start_insp:end_insp]

new_insp = """  const renderInspector = () => {
      const hdr = container.querySelector('#inspector-header');
      const tools = container.querySelector('#clip-tools-container');
      const fxList = container.querySelector('#fx-list');
      const fxMultiMsg = container.querySelector('#fx-multi-msg');
      const actionsGrid = container.querySelector('#dynamic-actions-grid');
      
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
          
          let actionsHtml = `
              <button class="snd-btn" id="btn-norm">Normalize</button>
              <button class="snd-btn" id="btn-rev">Reverse</button>
              <button class="snd-btn" id="btn-inv">Invert Phase</button>
              <button class="snd-btn" id="btn-fade-in">Fade In 1s</button>
              <button class="snd-btn" id="btn-fade-out">Fade Out 1s</button>
              <button class="snd-btn" id="btn-auto-split"><span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">content_cut</span> Auto-Split</button>
          `;
          if (numTracks > 0) {
              actionsHtml += `<button class="snd-btn snd-btn-purple" id="btn-remove-gaps"><span class="material-symbols-outlined" style="font-size: 14px; margin-right: 4px;">compress</span> Remove Gaps</button>`;
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
      
      const renderFxListHtml = (fxArr) => {
          return fxArr.map((fx, idx) => {
              const def = FX_CATALOG[fx.type];
              const paramsHtml = Object.keys(def.params).map(pKey => {
                  const pDef = def.params[pKey];
                  const val = fx.params[pKey];
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

      const bindFxSliders = (fxArr) => {
          fxList.querySelectorAll('.param-slider').forEach(slider => {
              slider.addEventListener('input', e => {
                  const idx = parseInt(e.target.dataset.fxIdx);
                  const pKey = e.target.dataset.param;
                  const val = parseFloat(e.target.value);
                  e.target.previousElementSibling.children[1].textContent = val;
                  fxArr[idx].params[pKey] = val;
                  updateFxNodeParam(fxArr[idx], pKey, val);
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
          fxMultiMsg.style.display = 'none';
          fxList.style.display = 'flex';
          fxList.innerHTML = renderFxListHtml(affectedClips[0].fx);
          bindFxSliders(affectedClips[0].fx);
      } else if (isMulti) {
          fxMultiMsg.style.display = 'block';
          fxList.style.display = 'none';
          fxList.innerHTML = '';
      } else {
          fxMultiMsg.style.display = 'none';
          fxList.style.display = 'flex';
          fxList.innerHTML = renderFxListHtml(project.masterFx);
          bindFxSliders(project.masterFx);
      }
  };

"""
code = code.replace(old_insp, new_insp)

# 9. All event listeners at the bottom
start_events = code.find("  timelineScroll.addEventListener('mousedown'")
end_events = code.find("  container.querySelector('#btn-diarize').addEventListener('click'")
old_events = code[start_events:end_events]

new_events = """  timelineScroll.addEventListener('mousedown', e => {
      if (e.button === 2) return;
      const clipEl = e.target.closest('.snd-clip');
      const trackHeaderEl = e.target.closest('.snd-track-header');
      
      if (clipEl) {
          const cid = clipEl.dataset.id;
          if (e.shiftKey || e.metaKey) {
              if (selectedItems.clips.has(cid)) selectedItems.clips.delete(cid);
              else selectedItems.clips.add(cid);
          } else {
              if (!selectedItems.clips.has(cid)) {
                  selectedItems.tracks.clear();
                  selectedItems.clips.clear();
                  selectedItems.clips.add(cid);
              }
          }
          renderInspector();
          renderTimeline();
          
          isDragging = true;
          dragClipId = cid;
          dragStartX = e.clientX;
          dragStartTimeline = getClipById(dragClipId).timelineStart;
      } else if (!trackHeaderEl) {
          if (selectedItems.clips.size > 0 || selectedItems.tracks.size > 0) {
              selectedItems.clips.clear();
              selectedItems.tracks.clear();
              renderInspector();
              renderTimeline();
          }
          const rect = tracksContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left - 140; 
          const targetSec = Math.max(0, clickX / pixelsPerSecond);
          Tone.Transport.seconds = targetSec;
          updatePlayheadDOM();
      }
  });

  window.addEventListener('mousemove', e => {
      if (isDragging && dragClipId) {
          const deltaX = e.clientX - dragStartX;
          const deltaSec = deltaX / pixelsPerSecond;
          const clip = getClipById(dragClipId);
          clip.timelineStart = Math.max(0, dragStartTimeline + deltaSec);
          
          const clipEl = container.querySelector(`.snd-clip[data-id="${dragClipId}"]`);
          if (clipEl) clipEl.style.left = `${clip.timelineStart * pixelsPerSecond}px`;
      }
  });

  window.addEventListener('mouseup', () => {
      if (isDragging) {
          isDragging = false;
          dragClipId = null;
          rebuildPlayback();
          renderTimeline(); 
      }
  });

  timelineScroll.addEventListener('contextmenu', e => {
      e.preventDefault();
      const clipEl = e.target.closest('.snd-clip');
      if (!clipEl) return;
      
      const cid = clipEl.dataset.id;
      const rect = clipEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const splitOffsetSec = clickX / pixelsPerSecond;
      
      if (!selectedItems.clips.has(cid)) {
          selectedItems.tracks.clear();
          selectedItems.clips.clear();
          selectedItems.clips.add(cid);
          renderTimeline();
          renderInspector();
      }
      
      const clip = getClipById(cid);
      
      showContextMenu(e.clientX, e.clientY, [
          { label: 'Split Clip Here', icon: 'content_cut', action: () => {
              const sourceOffset = splitOffsetSec * (clip.rate || 1);
              if (sourceOffset <= 0.1 || sourceOffset >= clip.duration - 0.1) return;
              
              const track = project.tracks.find(t => t.clips.includes(clip));
              const buf1 = sliceAudioBuffer(clip.buffer, 0, sourceOffset);
              const buf2 = sliceAudioBuffer(clip.buffer, sourceOffset, clip.duration);
              
              const clip2 = {
                  id: 'clip_' + Date.now(),
                  name: clip.name + ' (2)',
                  buffer: buf2,
                  timelineStart: clip.timelineStart + splitOffsetSec,
                  duration: clip.duration - sourceOffset,
                  rate: clip.rate,
                  fx: JSON.parse(JSON.stringify(clip.fx))
              };
              
              clip.buffer = buf1;
              clip.duration = sourceOffset;
              clip.name = clip.name + ' (1)';
              
              track.clips.push(clip2);
              selectedItems.clips.clear();
              rebuildPlayback();
              renderTimeline();
              renderInspector();
          }}
      ]);
  });

  container.querySelector('#zoom-slider').addEventListener('input', e => {
      pixelsPerSecond = parseInt(e.target.value);
      renderTimeline();
      updatePlayheadDOM();
  });

  container.querySelector('#fx-add-select').addEventListener('change', e => {
      const type = e.target.value;
      if (!type) return;
      const def = FX_CATALOG[type];
      const newFx = { id: 'fx_' + Date.now(), type: type, params: {} };
      Object.keys(def.params).forEach(k => newFx.params[k] = def.params[k].default);
      
      const affectedClips = getAffectedClips();
      
      if (affectedClips.length === 0) {
          project.masterFx.push(newFx);
      } else {
          const replace = container.querySelector('#fx-replace-checkbox')?.checked;
          affectedClips.forEach(clip => {
              if (replace) clip.fx = [];
              clip.fx.push(JSON.parse(JSON.stringify(newFx)));
          });
      }
      
      e.target.value = '';
      rebuildPlayback();
      renderInspector();
      renderTimeline();
  });

  container.querySelector('#clip-rate').addEventListener('change', e => {
      const affectedClips = getAffectedClips();
      if(affectedClips.length === 1) {
          affectedClips[0].rate = parseFloat(e.target.value);
          rebuildPlayback();
          renderTimeline();
      }
  });
  
  const applyDestructiveToClips = (clips, fn) => {
      clips.forEach(c => c.buffer = fn(c.buffer));
      rebuildPlayback();
      renderTimeline();
  };

  const autoSplitClip = (clip) => {
      const buffer = clip.buffer.getChannelData(0);
      const sr = clip.buffer.sampleRate;
      const windowSize = Math.floor(sr * 0.05); 
      let segments = [];
      let currentStart = null;
      let silentFrames = 0;
      
      for (let i = 0; i < buffer.length; i += windowSize) {
          let sum = 0;
          const end = Math.min(i + windowSize, buffer.length);
          for (let j = i; j < end; j++) sum += buffer[j] * buffer[j];
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
      if (currentStart !== null) segments.push({ start: currentStart, end: buffer.length / sr });
      
      if (segments.length === 0 || (segments.length === 1 && segments[0].start <= 0.1 && segments[0].end >= clip.duration - 0.2)) {
          return [clip];
      }
      
      return segments.map((seg, i) => ({
          id: 'clip_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
          name: clip.name + ` (Part ${i+1})`,
          buffer: sliceAudioBuffer(clip.buffer, seg.start, seg.end),
          timelineStart: clip.timelineStart + seg.start,
          duration: seg.end - seg.start,
          rate: clip.rate,
          fx: JSON.parse(JSON.stringify(clip.fx))
      }));
  };

  container.querySelector('#clip-tools-container').addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.id;
      
      const affectedClips = getAffectedClips();
      if (affectedClips.length === 0) return;
      
      if (id === 'btn-norm') applyDestructiveToClips(affectedClips, normalizeAudioBuffer);
      if (id === 'btn-rev') applyDestructiveToClips(affectedClips, reverseAudioBuffer);
      if (id === 'btn-inv') applyDestructiveToClips(affectedClips, invertAudioBuffer);
      if (id === 'btn-fade-in') applyDestructiveToClips(affectedClips, b => applyFade(b, 'in', 1.0));
      if (id === 'btn-fade-out') applyDestructiveToClips(affectedClips, b => applyFade(b, 'out', 1.0));
      
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

"""
code = code.replace(old_events, new_events)

with open('app/src/screens/snd.js', 'w') as f:
    f.write(code)

print("Refactor Complete")
