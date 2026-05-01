import { createEmptyTimeline, saveTimeline, getTimeline, getAllTimelines } from '../data/timeline-store.js';
import { registry } from '../engine/index.js';
import { renderParamField, collectParams, bindParamFieldEvents } from '../utils/param-fields.js';
import { WebGLCompositor, TRANSITIONS } from '../engine/stitcher.js';
import { formatBytes } from '../utils/misc.js';

let currentTimeline = null;
let mediaPoolSelection = new Set();
let selectedItemId = null;
let selectedItemType = null;
let isMagneticSnapping = true;

// Ensure unique ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

let _tmeStyles = false;
function injectTmeStyles() {
  if (_tmeStyles) return;
  _tmeStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .ned-fields { display:flex; flex-direction:column; gap:10px; }
    .ned-field { display:flex; flex-direction:column; gap:4px; }
    .ned-field-label { display:flex; align-items:center; font-size:12px; color:var(--ps-text-muted); font-weight:500; }
    .ned-color-row { display:flex; align-items:center; gap:6px; }
    .ned-color-input { width:36px; height:32px; padding:2px; border:1px solid var(--ps-border); border-radius:6px; background:var(--ps-bg-app); cursor:pointer; }
    .ned-toggle { display:flex; align-items:center; cursor:pointer; width:fit-content; }
    .ned-toggle input { display:none; }
    .ned-toggle-track {
      width:36px; height:20px; border-radius:10px; background:var(--ps-bg-app);
      border:1px solid var(--ps-border); position:relative; transition:background 150ms, border-color 150ms;
    }
    .ned-toggle-track::after {
      content:''; position:absolute; top:2px; left:2px; width:14px; height:14px;
      border-radius:50%; background:#fff; transition:transform 150ms;
    }
    .ned-toggle input:checked + .ned-toggle-track { background:var(--ps-blue); border-color:var(--ps-blue); }
    .ned-toggle input:checked + .ned-toggle-track::after { transform:translateX(16px); }
  `;
  document.head.appendChild(s);
}

export async function render(container) {
  injectTmeStyles();
  // Load last timeline or create new
  const all = await getAllTimelines();
  if (all.length > 0) {
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    currentTimeline = all[0];
    
    // Fallbacks for older DB schemas
    if (!currentTimeline.videoTrack) currentTimeline.videoTrack = [];
    if (!currentTimeline.effectTracks) currentTimeline.effectTracks = [{ id: 'fx1', name: 'FX 1', blocks: [] }];
    if (!currentTimeline.audioTracks) currentTimeline.audioTracks = [{ id: 'a1', name: 'A1', blocks: [] }];
    
  } else {
    currentTimeline = createEmptyTimeline();
    await saveTimeline(currentTimeline);
  }

  container.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">view_timeline</span>
          Timeline Editor — 
          <span contenteditable="true" id="tme-project-name" style="font-weight: 400; color: var(--ps-text-muted); margin-left: 4px; padding: 2px 4px; border-radius: 4px; border: 1px solid transparent; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--ps-border)'" onblur="this.style.borderColor='transparent'">${currentTimeline.name}</span>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary" id="tme-btn-new">
            <span class="material-symbols-outlined">add_box</span> New
          </button>
          <button class="btn-secondary" id="tme-btn-open">
            <span class="material-symbols-outlined">folder_open</span> Open
          </button>
          <button class="btn-secondary" id="tme-btn-save">
            <span class="material-symbols-outlined">save</span> Save Project
          </button>
          <button class="btn-secondary" id="tme-btn-export">
            <span class="material-symbols-outlined">ios_share</span> Export
          </button>
        </div>
      </div>
      
      <div class="screen-body" style="flex-direction: column;">
        <!-- Top Half: Media Pool + Player -->
        <div class="flex" style="flex: 1; min-height: 0; border-bottom: 1px solid var(--ps-border);">
          
          <!-- Media Pool -->
          <div class="panel-left" style="width: 320px; border-right: 1px solid var(--ps-border);">
            <div class="panel-header">
              <span class="panel-header-title">Media Pool</span>
              <button class="btn-ghost" id="tme-btn-remove-media" title="Remove Selected Media" style="display:none; color: var(--ps-danger);">
                <span class="material-symbols-outlined">remove</span>
              </button>
              <button class="btn-ghost" id="tme-btn-add-media" title="Import Media">
                <span class="material-symbols-outlined">add</span>
              </button>
            </div>
            <div class="panel-body" id="tme-media-pool" style="display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start;">
              <!-- Media items rendered here -->
            </div>
          </div>

          <!-- Player Canvas -->
          <div class="panel-center" style="background: #000; align-items: center; justify-content: center; position: relative;">
            <canvas id="tme-player-canvas" style="max-width: 100%; max-height: 100%; object-fit: contain;"></canvas>
            
            <!-- Player Controls -->
            <div class="flex items-center gap-4" style="position: absolute; bottom: 20px; background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 99px; backdrop-filter: blur(10px);">
              <button class="btn-icon" id="tme-btn-play"><span class="material-symbols-outlined">play_arrow</span></button>
              <span id="tme-timecode" class="font-mono text-sm" style="color: #fff;">00:00:00:00</span>
            </div>
          </div>

          <!-- Effects Browser & Properties Panel -->
          <div class="panel-right" style="width: 260px; border-left: 1px solid var(--ps-border); display: flex; flex-direction: column;">
            <div class="panel-header" id="tme-effects-header" style="flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="panel-header-title">Effects</span>
                <span class="material-symbols-outlined" id="tme-effects-chevron" style="font-size: 16px;">expand_more</span>
              </div>
              <input type="text" id="tme-effects-search" placeholder="Search effects..." class="ic-input" style="font-size: 11px; padding: 4px 8px; border-radius: 4px; background: rgba(0,0,0,0.2);">
            </div>
            <div class="panel-body" id="tme-effects-pool" style="flex: 1; overflow-y: auto; padding-bottom: 8px; padding-top: 8px;">
              <!-- Render list of available effects here -->
            </div>

            <!-- Properties Panel -->
            <div class="panel-header" style="flex-shrink: 0; border-top: 1px solid var(--ps-border);">
              <span class="panel-header-title">Properties</span>
            </div>
            <div class="panel-body" id="tme-properties-panel" style="height: 45%; overflow-y: auto; background: var(--ps-bg-surface);">
              <div class="text-sm text-muted" style="padding: 12px;">Select an effect block to view properties.</div>
            </div>
          </div>

        </div>

        <!-- Bottom Half: Timeline Tracks -->
        <div class="flex-col" style="height: 350px; background: var(--ps-bg-surface); overflow: hidden; display: flex; flex-direction: column;">
          
          <!-- Timeline Toolbar -->
          <div class="flex items-center gap-3 p-2" style="border-bottom: 1px solid var(--ps-border);">
            <button class="btn-ghost" title="Split Clip (Blade)" id="tme-btn-split">
              <span class="material-symbols-outlined">content_cut</span>
            </button>
            <button class="btn-ghost is-active" title="Magnetic Snapping" id="tme-btn-magnet" style="color: var(--ps-blue);">
              <span class="material-symbols-outlined">link</span>
            </button>
            <button class="btn-ghost" title="Delete Selected" id="tme-btn-delete-selected">
              <span class="material-symbols-outlined">delete</span>
            </button>
            <div style="width: 1px; height: 16px; background: var(--ps-border); margin: 0 4px;"></div>
            <button class="btn-ghost" title="Add Keyframe" id="tme-btn-add-keyframe" disabled style="opacity: 0.5;">
              <span class="material-symbols-outlined">add_location_alt</span>
            </button>
            
            <div style="flex: 1;"></div>
            
            <span class="material-symbols-outlined text-muted text-sm">zoom_out</span>
            <input type="range" class="ic-range" id="tme-zoom-slider" min="1" max="100" value="50" style="width: 120px;">
            <span class="material-symbols-outlined text-muted text-sm">zoom_in</span>
          </div>

          <!-- Timeline Area (Scrollable) -->
          <div style="flex: 1; overflow: auto; position: relative; display: flex;" id="tme-timeline-scroll">
            
            <!-- Track Headers (Sticky Left) -->
            <div id="tme-track-headers" style="width: 150px; flex-shrink: 0; border-right: 1px solid var(--ps-border); position: sticky; left: 0; background: var(--ps-bg-surface); z-index: 10;">
              <!-- Ruler Header space -->
              <div style="height: 30px; border-bottom: 1px solid var(--ps-border);"></div>
              <!-- Dynamically populated -->
            </div>

            <!-- Tracks Content Area -->
            <div style="position: relative; flex: 1; min-width: 2000px; background: #16161a;" id="tme-tracks-container">
              <!-- Ruler -->
              <div id="tme-ruler-header" style="height: 30px; border-bottom: 1px solid var(--ps-border); background: #1c1c21; position: relative; cursor: text;">
                <canvas id="tme-ruler-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
              </div>
              
              <!-- Tracks Body -->
              <div id="tme-tracks-body" style="position: relative;">
                <!-- Dynamically populated -->
              </div>

              <!-- Playhead Line -->
              <div id="tme-playhead" style="position: absolute; top: 0; bottom: 0; left: 0; width: 2px; background: var(--ps-danger); z-index: 20; pointer-events: none;">
                <div style="position: absolute; top: 0; left: -5px; width: 12px; height: 12px; background: var(--ps-danger); clip-path: polygon(0 0, 100% 0, 50% 100%);"></div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  const poolContainer = container.querySelector('#tme-media-pool');
  const btnAddMedia = container.querySelector('#tme-btn-add-media');

  // ─── Render Media Pool ──────────────────────────────────
  function renderMediaPool() {
    poolContainer.innerHTML = '';
    
    if (!currentTimeline.mediaPool || currentTimeline.mediaPool.length === 0) {
      poolContainer.innerHTML = `
        <div class="empty-state" style="width: 100%;">
          <span class="material-symbols-outlined">perm_media</span>
          <div class="empty-state-title">No Media</div>
          <div class="empty-state-desc">Click '+' or drag files here to add media.</div>
        </div>
      `;
      return;
    }

    // Determine which pool items are used in the timeline
    const usedPoolIds = new Set(currentTimeline.videoTrack.map(clip => clip.poolId));
    if (currentTimeline.audioTracks) {
      currentTimeline.audioTracks.forEach(t => t.blocks.forEach(b => usedPoolIds.add(b.poolId)));
    }

    const btnRemoveMedia = container.querySelector('#tme-btn-remove-media');
    let anySelectedIsUsed = false;

    currentTimeline.mediaPool.forEach(item => {
      const isSelected = mediaPoolSelection.has(item.id);
      const isUsed = usedPoolIds.has(item.id);
      if (isSelected && isUsed) anySelectedIsUsed = true;
      
      const el = document.createElement('div');
      el.className = 'tme-pool-item';
      // Basic inline styling for now, we can move to css later
      el.style.width = '72px';
      el.style.height = '72px';
      el.style.borderRadius = '8px';
      el.style.background = '#111';
      el.style.backgroundImage = `url(${item.thumbnail})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.border = isSelected ? '2px solid var(--ps-blue)' : (isUsed ? '2px solid var(--ps-success)' : '1px solid var(--ps-border)');
      el.style.cursor = 'pointer';
      el.style.position = 'relative';
      
      let tooltip = item.name || item.fileHandle?.name || 'Media';
      if (item.meta) {
         const dateStr = item.meta.lastModified ? new Date(item.meta.lastModified).toLocaleString() : '';
         const sizeStr = item.meta.size ? formatBytes(item.meta.size) : '';
         let typeStr = '';
         if (item.type === 'video') {
           typeStr = `Video: ${item.meta.width || '?'}x${item.meta.height || '?'} • ${item.meta.duration ? item.meta.duration.toFixed(1) + 's' : '?s'}`;
         } else if (item.type === 'image') {
           typeStr = `Image: ${item.meta.width || '?'}x${item.meta.height || '?'}`;
         }
         tooltip = `${tooltip}\n${typeStr}\nModified: ${dateStr}\nSize: ${sizeStr}`;
      }
      el.title = tooltip;
      
      if (item.type === 'video') {
        el.innerHTML = '<span class="material-symbols-outlined" style="position:absolute; bottom:2px; right:2px; font-size:14px; background:rgba(0,0,0,0.6); border-radius:4px; padding:2px; color:#fff;">movie</span>';
      }

      el.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          if (isSelected) mediaPoolSelection.delete(item.id);
          else mediaPoolSelection.add(item.id);
        } else {
          mediaPoolSelection.clear();
          mediaPoolSelection.add(item.id);
        }
        renderMediaPool();
      });

      // Enable dragging to timeline
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        // If the item being dragged isn't selected, select only it
        if (!mediaPoolSelection.has(item.id)) {
          mediaPoolSelection.clear();
          mediaPoolSelection.add(item.id);
          renderMediaPool(); // updates border
        }
        // Pass the list of selected pool item IDs
        e.dataTransfer.setData('text/plain', JSON.stringify(Array.from(mediaPoolSelection)));
        e.dataTransfer.effectAllowed = 'copy';
      });

      // Double-click to insert at playhead
      el.addEventListener('dblclick', async () => {
        currentTimeline.videoTrack.push({
          id: generateId(),
          poolId: item.id,
          startTime: playheadTime,
          duration: 4.0,
          sourceStart: 0,
          transitionOut: null
        });
        await saveTimeline(currentTimeline);
        renderTimelineTracks();
      });

      poolContainer.appendChild(el);
    });

    if (btnRemoveMedia) {
      if (mediaPoolSelection.size > 0 && !anySelectedIsUsed) {
        btnRemoveMedia.style.display = 'block';
      } else {
        btnRemoveMedia.style.display = 'none';
      }
    }
  }

  const btnRemoveMedia = container.querySelector('#tme-btn-remove-media');
  if (btnRemoveMedia) {
    btnRemoveMedia.addEventListener('click', async () => {
      const idsToRemove = Array.from(mediaPoolSelection);
      currentTimeline.mediaPool = currentTimeline.mediaPool.filter(p => !idsToRemove.includes(p.id));
      mediaPoolSelection.clear();
      await saveTimeline(currentTimeline);
      renderMediaPool();
    });
  }

  const fxPoolContainer = container.querySelector('#tme-effects-pool');
  const fxSearchInput = container.querySelector('#tme-effects-search');
  
  if (fxSearchInput) {
    fxSearchInput.addEventListener('input', () => {
      renderEffectsPool(fxSearchInput.value.toLowerCase());
    });
  }

  const fxHeader = container.querySelector('#tme-effects-header');
  let isEffectsCollapsed = false;

  function updateEffectsCollapseState() {
    const pool = container.querySelector('#tme-effects-pool');
    const chevron = container.querySelector('#tme-effects-chevron');
    const propsPanel = container.querySelector('#tme-properties-panel');
    
    if (isEffectsCollapsed) {
      pool.style.display = 'none';
      if (fxSearchInput) fxSearchInput.style.display = 'none';
      if (chevron) chevron.textContent = 'chevron_right';
      if (propsPanel) propsPanel.style.flex = '1';
    } else {
      pool.style.display = 'block';
      if (fxSearchInput) fxSearchInput.style.display = 'block';
      if (chevron) chevron.textContent = 'expand_more';
      if (propsPanel) {
        propsPanel.style.flex = 'none';
        propsPanel.style.height = '45%';
      }
    }
  }

  if (fxHeader) {
    fxHeader.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;
      isEffectsCollapsed = !isEffectsCollapsed;
      updateEffectsCollapseState();
    });
  }

  // ─── Render Effects Pool ────────────────────────────────
  function renderEffectsPool(filterText = '') {
    fxPoolContainer.innerHTML = '';
    const allDefs = registry.getAll();
    const fxDefs = allDefs.filter(d => 
       !['sys', 'meta', 'flow'].includes(d.category) && 
       (d.name.toLowerCase().includes(filterText) || d.category.toLowerCase().includes(filterText))
    );
    
    fxDefs.forEach(def => {
      const el = document.createElement('div');
      el.className = 'tme-effect-item ic-card';
      el.style.padding = '8px';
      el.style.cursor = 'grab';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '8px';
      el.style.marginBottom = '8px';
      
      el.innerHTML = `
        <span class="material-symbols-outlined text-muted">${def.icon || 'auto_awesome'}</span>
        <div class="flex-col">
          <span class="text-sm" style="color:var(--ps-text); font-weight:500;">${def.name}</span>
        </div>
      `;

      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'effect', transformId: def.id }));
        e.dataTransfer.effectAllowed = 'copy';
      });

      el.addEventListener('dblclick', async () => {
        if (currentTimeline.effectTracks.length > 0) {
          currentTimeline.effectTracks[0].blocks.push({
            id: generateId(),
            transformId: def.id,
            startTime: playheadTime,
            duration: 4.0,
            params: {},
            keyframes: []
          });
          await saveTimeline(currentTimeline);
          renderTimelineTracks();
          renderFrame();
        }
      });

      fxPoolContainer.appendChild(el);
    });
  }

  const propsContainer = container.querySelector('#tme-properties-panel');

  function renderPropertiesPanel() {
    propsContainer.innerHTML = '';
    
    if (!selectedItemId || (selectedItemType !== 'fx' && selectedItemType !== 'video')) {
      propsContainer.innerHTML = '<div class="text-sm text-muted" style="padding: 12px;">Select an effect or video block to view properties.</div>';
      if (isEffectsCollapsed) {
        isEffectsCollapsed = false;
        updateEffectsCollapseState();
      }
      return;
    }

    if (!isEffectsCollapsed) {
      isEffectsCollapsed = true;
      updateEffectsCollapseState();
    }

    function getTransitionHtml(block) {
      const tIn = block.transitionIn || { style: 'none', duration: 0.0 };
      const tOut = block.transitionOut || { style: 'none', duration: 0.0 };
      const styles = ['none', ...Object.keys(TRANSITIONS)];
      
      return `
        <div class="panel-header" style="flex-shrink: 0; border-top: 1px solid var(--ps-border); border-bottom: 1px solid var(--ps-border); background: var(--ps-bg-surface);">
          <span class="panel-header-title text-xs">Transitions</span>
        </div>
        <div class="ned-fields" style="padding: 12px; background: rgba(0,0,0,0.1);">
          <div class="ned-field">
            <span class="ned-field-label">Transition In</span>
            <div style="display:flex; gap: 8px;">
              <select id="tme-t-in-style" class="ic-input" style="flex: 1; font-size: 11px;">
                ${styles.map(s => `<option value="${s}" ${tIn.style === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <input type="number" id="tme-t-in-dur" class="ic-input" style="width: 60px; font-size: 11px;" value="${tIn.duration}" step="0.1" min="0">
              <span class="text-xs text-muted" style="line-height:24px;">s</span>
            </div>
          </div>
          <div class="ned-field">
            <span class="ned-field-label">Transition Out</span>
            <div style="display:flex; gap: 8px;">
              <select id="tme-t-out-style" class="ic-input" style="flex: 1; font-size: 11px;">
                ${styles.map(s => `<option value="${s}" ${tOut.style === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <input type="number" id="tme-t-out-dur" class="ic-input" style="width: 60px; font-size: 11px;" value="${tOut.duration}" step="0.1" min="0">
              <span class="text-xs text-muted" style="line-height:24px;">s</span>
            </div>
          </div>
        </div>
      `;
    }

    function bindTransitionEvents(block) {
      const tInStyle = propsContainer.querySelector('#tme-t-in-style');
      const tInDur = propsContainer.querySelector('#tme-t-in-dur');
      const tOutStyle = propsContainer.querySelector('#tme-t-out-style');
      const tOutDur = propsContainer.querySelector('#tme-t-out-dur');
      
      const updateTransitions = async () => {
        block.transitionIn = { style: tInStyle.value, duration: parseFloat(tInDur.value) || 0 };
        block.transitionOut = { style: tOutStyle.value, duration: parseFloat(tOutDur.value) || 0 };
        await saveTimeline(currentTimeline);
        renderTimelineTracks();
        renderFrame();
      };
      
      if (tInStyle) {
        tInStyle.addEventListener('change', updateTransitions);
        tInDur.addEventListener('change', updateTransitions);
        tOutStyle.addEventListener('change', updateTransitions);
        tOutDur.addEventListener('change', updateTransitions);
      }
    }

    // --- VIDEO CLIP PROPERTIES ---
    if (selectedItemType === 'video') {
      const vBlock = currentTimeline.videoTrack.find(c => c.id === selectedItemId);
      if (!vBlock) return;
      
      const poolItem = currentTimeline.mediaPool.find(m => m.id === vBlock.poolId);
      const name = poolItem ? poolItem.name : vBlock.poolId;

      propsContainer.innerHTML = `
        <div style="padding: 12px; font-size: 12px; color: var(--ps-text-muted);">
          <strong>Video Clip:</strong> ${name}
        </div>
        ${getTransitionHtml(vBlock)}
      `;
      bindTransitionEvents(vBlock);
      return;
    }

    // --- AUDIO CLIP PROPERTIES ---
    if (selectedItemType === 'audio') {
      let aBlock = null;
      currentTimeline.audioTracks.forEach(t => {
        const b = t.blocks.find(blk => blk.id === selectedItemId);
        if (b) aBlock = b;
      });
      if (!aBlock) return;
      
      const poolItem = currentTimeline.mediaPool.find(m => m.id === aBlock.poolId);
      const name = poolItem ? poolItem.name || poolItem.fileHandle?.name : 'Audio Clip';

      propsContainer.innerHTML = `
        <div style="padding: 12px; font-size: 12px; color: var(--ps-text-muted); border-bottom: 1px solid var(--ps-border);">
          <strong>Audio Clip:</strong> ${name}
        </div>
        <div style="padding: 16px;">
          <div class="ned-field">
            <div class="ned-field-label">Volume</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" id="tme-audio-volume" min="0" max="1" step="0.05" value="${aBlock.volume !== undefined ? aBlock.volume : 1}" style="flex:1;">
              <span id="tme-audio-volume-val" style="font-size:11px; width:30px;">${Math.round((aBlock.volume !== undefined ? aBlock.volume : 1) * 100)}%</span>
            </div>
          </div>
        </div>
      `;
      
      const volInput = propsContainer.querySelector('#tme-audio-volume');
      const volVal = propsContainer.querySelector('#tme-audio-volume-val');
      volInput.addEventListener('input', async (e) => {
        const val = parseFloat(e.target.value);
        volVal.textContent = Math.round(val * 100) + '%';
        aBlock.volume = val;
        await saveTimeline(currentTimeline);
        syncAudioPlayback(); // immediate update of volume
      });
      
      return;
    }

    // --- EFFECT PROPERTIES ---
    let fxBlock = null;
    currentTimeline.effectTracks.forEach(t => {
      const b = t.blocks.find(blk => blk.id === selectedItemId);
      if (b) fxBlock = b;
    });

    if (!fxBlock) return;

    const def = registry.get(fxBlock.transformId);
    let paramsHtml = '';
    let activeParams = fxBlock.params || {};
    let activeKeyframeIdx = -1;

    if (!def || !def.params || def.params.length === 0) {
      paramsHtml = '<div class="text-sm text-muted" style="padding: 12px;">No configurable properties for this effect.</div>';
    } else {
      if (Array.isArray(fxBlock.keyframes) && fxBlock.keyframes.length > 0) {
        const offset = playheadTime - fxBlock.startTime;
        for (let i = fxBlock.keyframes.length - 1; i >= 0; i--) {
          if (fxBlock.keyframes[i].offset <= offset + 0.05) {
            activeKeyframeIdx = i;
            break;
          }
        }
        if (activeKeyframeIdx === -1) activeKeyframeIdx = 0;
        activeParams = fxBlock.keyframes[activeKeyframeIdx].params;
      }

      let kfHeaderHtml = '';
      if (Array.isArray(fxBlock.keyframes) && fxBlock.keyframes.length > 0) {
        kfHeaderHtml = `
          <div style="display:flex; align-items:center; justify-content:space-between; padding: 8px 12px; background: rgba(0,0,0,0.8); border-bottom: 1px solid var(--ps-border); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px);">
            <div style="display:flex; align-items:center; gap: 4px;">
              <button class="btn-icon" id="tme-kf-prev" style="width:20px;height:20px;padding:0;" ${activeKeyframeIdx === 0 ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:14px;">chevron_left</span></button>
              <span class="text-xs">Keyframe ${activeKeyframeIdx + 1} of ${fxBlock.keyframes.length}</span>
              <button class="btn-icon" id="tme-kf-next" style="width:20px;height:20px;padding:0;" ${activeKeyframeIdx === fxBlock.keyframes.length - 1 ? 'disabled' : ''}><span class="material-symbols-outlined" style="font-size:14px;">chevron_right</span></button>
            </div>
            <button class="btn-icon" id="tme-kf-delete" style="width:20px;height:20px;padding:0; color:var(--ps-danger);" title="Delete Keyframe"><span class="material-symbols-outlined" style="font-size:14px;">delete</span></button>
          </div>
        `;
      }

      paramsHtml = `
        ${kfHeaderHtml}
        <div class="ned-fields" style="padding: 12px;">
          ${def.params.map(p => renderParamField(p, activeParams[p.name], 'tme')).join('')}
        </div>
      `;
    }

    propsContainer.innerHTML = `
      ${paramsHtml}
      ${getTransitionHtml(fxBlock)}
    `;
    
    bindTransitionEvents(fxBlock);

    if (def && def.params && def.params.length > 0) {
      const btnKfPrev = propsContainer.querySelector('#tme-kf-prev');
      if (btnKfPrev) btnKfPrev.addEventListener('click', () => {
         playheadTime = fxBlock.startTime + fxBlock.keyframes[activeKeyframeIdx - 1].offset;
         updatePlayheadUI();
         renderPropertiesPanel();
         renderFrame();
      });
      
      const btnKfNext = propsContainer.querySelector('#tme-kf-next');
      if (btnKfNext) btnKfNext.addEventListener('click', () => {
         playheadTime = fxBlock.startTime + fxBlock.keyframes[activeKeyframeIdx + 1].offset;
         updatePlayheadUI();
         renderPropertiesPanel();
         renderFrame();
      });

      const btnKfDelete = propsContainer.querySelector('#tme-kf-delete');
      if (btnKfDelete) btnKfDelete.addEventListener('click', async () => {
         fxBlock.keyframes.splice(activeKeyframeIdx, 1);
         if (fxBlock.keyframes.length === 0) {
           delete fxBlock.keyframes;
         }
         await saveTimeline(currentTimeline);
         renderTimelineTracks();
         renderPropertiesPanel();
         renderFrame();
      });

      // Initialize UI events and previews
      bindParamFieldEvents(propsContainer, def.params, 'tme');
      
      const onChange = async () => {
        const newParams = collectParams(propsContainer, def.params, 'tme');
        if (Array.isArray(fxBlock.keyframes) && fxBlock.keyframes.length > 0) {
           if (activeKeyframeIdx !== -1) {
             fxBlock.keyframes[activeKeyframeIdx].params = newParams;
           }
        } else {
           fxBlock.params = newParams;
        }
        await saveTimeline(currentTimeline);
        renderFrame();
      };

      propsContainer.querySelectorAll('input, select').forEach(el => {
        if (el.type === 'range' || el.type === 'color') {
          el.addEventListener('input', () => {
            if (el.type === 'range') {
              const valEl = propsContainer.querySelector(`#${el.id}-val`);
              if (valEl) valEl.textContent = el.value;
            }
            onChange();
          });
        } else {
          el.addEventListener('change', onChange);
        }
      });
    }
  }

  // ─── Timeline Rendering & Logic ─────────────────────────
  let PIXELS_PER_SECOND = 50; 
  const tracksBodyEl = container.querySelector('#tme-tracks-body');
  const trackHeadersEl = container.querySelector('#tme-track-headers');
  const rulerCanvas = container.querySelector('#tme-ruler-canvas');
  const scrollContainer = container.querySelector('#tme-timeline-scroll');

  if (trackHeadersEl) {
    trackHeadersEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.tme-btn-toggle-track');
      if (btn) {
         const type = btn.dataset.trackType;
         const idx = parseInt(btn.dataset.trackIdx);
         if (type === 'video') {
           currentTimeline.videoTrackDisabled = !currentTimeline.videoTrackDisabled;
         } else if (type === 'fx') {
           currentTimeline.effectTracks[idx].disabled = !currentTimeline.effectTracks[idx].disabled;
         } else if (type === 'audio') {
           currentTimeline.audioTracks[idx].disabled = !currentTimeline.audioTracks[idx].disabled;
         }
         await saveTimeline(currentTimeline);
         renderTimelineTracks();
         renderFrame();
      }
    });
  }
  if (tracksBodyEl) {
    tracksBodyEl.addEventListener('contextmenu', async (e) => {
      if (e.target.closest('.tme-clip') || e.target.closest('.tme-fx-block')) return;
      
      e.preventDefault();
      
      const rect = tracksBodyEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left + scrollContainer.scrollLeft;
      const clickTime = Math.max(0, clickX / PIXELS_PER_SECOND);
      
      const gapStr = window.prompt(`Insert gap at ${clickTime.toFixed(2)}s.\nEnter number of seconds to shift everything forward:`, '1.0');
      if (!gapStr) return;
      const gap = parseFloat(gapStr);
      if (isNaN(gap) || gap <= 0) return;
      
      let changed = false;
      const tThreshold = clickTime - 0.01;
      
      if (currentTimeline.videoTrack) {
        currentTimeline.videoTrack.forEach(clip => {
          if (clip.startTime >= tThreshold) {
            clip.startTime += gap;
            changed = true;
          }
        });
      }
      
      if (currentTimeline.effectTracks) {
        currentTimeline.effectTracks.forEach(track => {
          track.blocks.forEach(fx => {
            if (fx.startTime >= tThreshold) {
              fx.startTime += gap;
              changed = true;
            }
          });
        });
      }
      
      if (currentTimeline.audioTracks) {
        currentTimeline.audioTracks.forEach(track => {
          track.blocks.forEach(clip => {
            if (clip.startTime >= tThreshold) {
              clip.startTime += gap;
              changed = true;
            }
          });
        });
      }
      
      if (changed) {
        await saveTimeline(currentTimeline);
        renderTimelineTracks();
        renderFrame();
      }
    });
  }

  function renderRuler() {
    if (!rulerCanvas) return;
    
    // Make ruler match the scroll width
    rulerCanvas.width = Math.max(scrollContainer.clientWidth, scrollContainer.scrollWidth);
    rulerCanvas.height = 30;

    const ctx = rulerCanvas.getContext('2d');
    ctx.clearRect(0, 0, rulerCanvas.width, rulerCanvas.height);
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxSeconds = Math.ceil(rulerCanvas.width / PIXELS_PER_SECOND);
    
    for (let s = 0; s <= maxSeconds; s++) {
      const x = s * PIXELS_PER_SECOND;
      ctx.fillRect(x, 20, 1, 10); // Major tick
      
      // Sub-ticks
      if (PIXELS_PER_SECOND >= 40) {
        ctx.fillRect(x + PIXELS_PER_SECOND * 0.25, 25, 1, 5);
        ctx.fillRect(x + PIXELS_PER_SECOND * 0.5, 25, 1, 5);
        ctx.fillRect(x + PIXELS_PER_SECOND * 0.75, 25, 1, 5);
      }
      
      let interval = 1;
      if (PIXELS_PER_SECOND < 20) interval = 5;
      if (PIXELS_PER_SECOND < 5) interval = 10;
      
      if (s % interval === 0) {
        ctx.fillText(formatTimecode(s).slice(3, 8), x, 4); // MM:SS format
      }
    }
  }

  // ─── Playhead Scrubbing ─────────────────────────────────
  let isScrubbing = false;
  const rulerHeader = container.querySelector('#tme-ruler-header');
  
  if (rulerHeader) {
    rulerHeader.addEventListener('mousedown', (e) => {
      isScrubbing = true;
      handleScrub(e);
    });
  }

  const handleScrub = (e) => {
    const rect = tracksBodyEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    playheadTime = Math.max(0, x / PIXELS_PER_SECOND);
    updatePlayheadUI();
    renderFrame();
  };

  document.addEventListener('mousemove', (e) => {
    if (isScrubbing) handleScrub(e);
  });
  document.addEventListener('mouseup', () => {
    isScrubbing = false;
  });

  function renderTimelineTracks() {
    try {
      // Keep ruler space at top
      trackHeadersEl.innerHTML = '<div style="height: 30px; border-bottom: 1px solid var(--ps-border); display:flex; align-items:center; justify-content:space-between; padding:0 8px;"><span class="text-xs text-muted font-mono">Tracks</span><button class="btn-ghost" id="tme-btn-add-fx" style="width:20px;height:20px;padding:0;" title="Add FX Track"><span class="material-symbols-outlined" style="font-size:14px;">add</span></button></div>';
      tracksBodyEl.innerHTML = '';

      // Render V1 Header
      trackHeadersEl.insertAdjacentHTML('beforeend', `
        <div class="tme-track-header" style="height: 60px; border-bottom: 1px solid var(--ps-border); padding: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span class="text-xs font-mono text-muted">V1 (Main)</span>
          <button class="btn-ghost tme-btn-toggle-track" data-track-type="video" data-track-idx="0" style="padding: 0; min-width: auto;">
            <span class="material-symbols-outlined text-muted text-sm" style="font-size:16px;">${currentTimeline.videoTrackDisabled ? 'visibility_off' : 'visibility'}</span>
          </button>
        </div>
      `);

      // Render V1 Track Body
      const v1Track = document.createElement('div');
      v1Track.className = 'tme-track';
      v1Track.style.height = '60px';
      v1Track.style.borderBottom = '1px solid var(--ps-border)';
      v1Track.style.position = 'relative';
      if (currentTimeline.videoTrackDisabled) v1Track.style.opacity = '0.3';
      tracksBodyEl.appendChild(v1Track);

      // Bind V1 Drop Listeners
      v1Track.addEventListener('dragover', (e) => { e.preventDefault(); v1Track.style.background = 'rgba(0, 119, 255, 0.1)'; });
      v1Track.addEventListener('dragleave', () => { v1Track.style.background = 'transparent'; });
      v1Track.addEventListener('drop', async (e) => {
        e.preventDefault();
        v1Track.style.background = 'transparent';
        try {
          const dataStr = e.dataTransfer.getData('text/plain');
          if (!dataStr) return;
          const poolIds = JSON.parse(dataStr);
          const rect = v1Track.getBoundingClientRect();
          const dropX = e.clientX - rect.left + container.querySelector('#tme-timeline-scroll').scrollLeft;
          let currentTime = Math.max(0, dropX / PIXELS_PER_SECOND);
          poolIds.forEach(id => {
            const poolItem = currentTimeline.mediaPool.find(p => p.id === id);
            if (poolItem && (poolItem.type === 'video' || poolItem.type === 'image')) {
              currentTimeline.videoTrack.push({ id: generateId(), poolId: id, startTime: currentTime, duration: 4.0, sourceStart: 0, transitionOut: null });
              currentTime += 4.0;
            }
          });
          await saveTimeline(currentTimeline);
          renderTimelineTracks();
          renderMediaPool();
        } catch (err) { /* ignore */ }
      });

    function setupDrag(blockEl, itemObj, itemType) {
      blockEl.addEventListener('click', e => e.stopPropagation());
      blockEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        
        // Visual selection
        selectedItemId = itemObj.id;
        selectedItemType = itemType;
        document.querySelectorAll('.tme-clip, .tme-fx-block').forEach(el => {
           el.style.border = el.classList.contains('tme-clip') ? '1px solid #444' : '1px solid var(--ps-blue)';
        });
        blockEl.style.border = '2px solid var(--ps-danger)';
        renderPropertiesPanel();

        let startX = e.clientX;
        let originalTime = itemObj.startTime;
        let isDragging = false;

        const onMouseMove = (eMove) => {
          isDragging = true;
          const dx = eMove.clientX - startX;
          let newTime = Math.max(0, originalTime + (dx / PIXELS_PER_SECOND));

          if (isMagneticSnapping) {
             const snapPoints = [playheadTime];
             currentTimeline.videoTrack.forEach(c => {
               if (c.id !== itemObj.id) { snapPoints.push(c.startTime, c.startTime + c.duration); }
             });
             currentTimeline.effectTracks.forEach(t => t.blocks.forEach(b => {
               if (b.id !== itemObj.id) { snapPoints.push(b.startTime, b.startTime + b.duration); }
             }));
             
             const snapThreshold = 10 / PIXELS_PER_SECOND;
             let closestStart = snapPoints.find(p => Math.abs(p - newTime) < snapThreshold);
             let closestEnd = snapPoints.find(p => Math.abs(p - (newTime + itemObj.duration)) < snapThreshold);
             
             if (closestStart !== undefined) newTime = closestStart;
             else if (closestEnd !== undefined) newTime = closestEnd - itemObj.duration;
          }
          
          itemObj.startTime = newTime;
          blockEl.style.left = `${newTime * PIXELS_PER_SECOND}px`;
        };

        const onMouseUp = async (eUp) => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          if (isDragging) {
            if (itemType === 'fx') {
              blockEl.style.display = 'none'; // Temporarily hide to find underlying element
              const elements = document.elementsFromPoint(eUp.clientX, eUp.clientY);
              blockEl.style.display = 'flex';
              
              const hoveredTrack = elements.find(el => el.classList.contains('tme-fx-track-body'));
              if (hoveredTrack) {
                const targetTrackId = hoveredTrack.dataset.trackId;
                const sourceTrack = currentTimeline.effectTracks.find(t => t.blocks.includes(itemObj));
                if (sourceTrack && sourceTrack.id !== targetTrackId) {
                  const targetTrack = currentTimeline.effectTracks.find(t => t.id === targetTrackId);
                  if (targetTrack) {
                    sourceTrack.blocks = sourceTrack.blocks.filter(b => b.id !== itemObj.id);
                    targetTrack.blocks.push(itemObj);
                  }
                }
              }
            }
            await saveTimeline(currentTimeline);
            renderTimelineTracks();
          }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    }

    // Helper for Trimming (left and right edges)
    function setupTrim(handleEl, itemObj, itemType, isLeftEdge) {
      handleEl.addEventListener('click', e => e.stopPropagation());
      handleEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        
        selectedItemId = itemObj.id;
        selectedItemType = itemType;
        document.querySelectorAll('.tme-clip, .tme-fx-block').forEach(el => {
           el.style.border = el.classList.contains('tme-clip') ? '1px solid #444' : '1px solid var(--ps-blue)';
        });
        handleEl.parentElement.style.border = '2px solid var(--ps-danger)';

        let startX = e.clientX;
        let originalStartTime = itemObj.startTime;
        let originalDuration = itemObj.duration;
        let originalSourceStart = itemObj.sourceStart || 0;
        let isTrimming = false;

        const onMouseMove = (eMove) => {
          isTrimming = true;
          const dx = eMove.clientX - startX;
          const dt = dx / PIXELS_PER_SECOND;

          if (isLeftEdge) {
            let newStartTime = Math.max(0, originalStartTime + dt);
            let timeDiff = newStartTime - originalStartTime;
            let newDuration = originalDuration - timeDiff;
            
            if (newDuration < 0.5) {
              // Enforce min duration
              newDuration = 0.5;
              newStartTime = originalStartTime + (originalDuration - 0.5);
              timeDiff = newStartTime - originalStartTime;
            }

            itemObj.startTime = newStartTime;
            itemObj.duration = newDuration;
            if (itemObj.poolId) {
              itemObj.sourceStart = Math.max(0, originalSourceStart + timeDiff);
            }
          } else {
            // Right edge
            let newDuration = Math.max(0.5, originalDuration + dt);
            itemObj.duration = newDuration;
          }

          // Visually update the parent element
          handleEl.parentElement.style.left = `${itemObj.startTime * PIXELS_PER_SECOND}px`;
          handleEl.parentElement.style.width = `${itemObj.duration * PIXELS_PER_SECOND}px`;
        };

        const onMouseUp = async () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          if (isTrimming) {
            await saveTimeline(currentTimeline);
            renderTimelineTracks();
            renderFrame();
          }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    }

    // Render Video Track Clips
      currentTimeline.videoTrack.forEach((clip) => {
        const poolItem = currentTimeline.mediaPool.find(p => p.id === clip.poolId);
        if (!poolItem) return;
        const block = document.createElement('div');
        block.className = 'tme-clip';
        block.style.position = 'absolute';
        block.style.left = `${clip.startTime * PIXELS_PER_SECOND}px`;
        block.style.width = `${clip.duration * PIXELS_PER_SECOND}px`;
        block.style.height = '100%';
        block.style.background = '#2a2a35';
        block.style.border = selectedItemId === clip.id ? '2px solid var(--ps-danger)' : '1px solid #444';
        block.style.borderRadius = '4px';
        block.style.overflow = 'hidden';
        block.style.display = 'flex';
        block.style.alignItems = 'center';
        block.style.fontSize = '11px';
        block.style.padding = '0 4px';
        block.style.color = '#fff';
        block.style.cursor = 'grab';
        block.dataset.id = clip.id;

        const tIn = clip.transitionIn;
        if (tIn && tIn.style !== 'none' && tIn.duration > 0) {
          const w = tIn.duration * PIXELS_PER_SECOND;
          const el = document.createElement('div');
          el.style.cssText = `position:absolute; left:0; top:0; bottom:0; width:${w}px; background:linear-gradient(to right, rgba(0,0,0,0.7), transparent); pointer-events:none; z-index:4; border-left: 2px solid #aaa;`;
          block.appendChild(el);
        }

        const tOut = clip.transitionOut;
        if (tOut && tOut.style !== 'none' && tOut.duration > 0) {
          const w = tOut.duration * PIXELS_PER_SECOND;
          const el = document.createElement('div');
          el.style.cssText = `position:absolute; right:0; top:0; bottom:0; width:${w}px; background:linear-gradient(to left, rgba(0,0,0,0.7), transparent); pointer-events:none; z-index:4; border-right: 2px solid #aaa;`;
          block.appendChild(el);
        }

        setupDrag(block, clip, 'video');
        
        // Add Trim Handles
        const leftHandle = document.createElement('div');
        leftHandle.style.cssText = 'position:absolute; left:0; top:0; bottom:0; width:10px; cursor:ew-resize; z-index:5;';
        const rightHandle = document.createElement('div');
        rightHandle.style.cssText = 'position:absolute; right:0; top:0; bottom:0; width:10px; cursor:ew-resize; z-index:5;';
        
        setupTrim(leftHandle, clip, 'video', true);
        setupTrim(rightHandle, clip, 'video', false);
        
        block.appendChild(leftHandle);
        block.appendChild(rightHandle);
        
        const thumb = document.createElement('div');
        thumb.style.position = 'absolute';
        thumb.style.inset = '0';
        thumb.style.backgroundImage = `url(${poolItem.thumbnail})`;
        thumb.style.backgroundSize = 'cover';
        thumb.style.backgroundRepeat = 'repeat-x';
        thumb.style.opacity = '0.4';
        thumb.style.pointerEvents = 'none';
        block.appendChild(thumb);
        
        const label = document.createElement('span');
        label.textContent = poolItem.fileHandle?.name || 'Clip';
        label.style.position = 'relative';
        label.style.zIndex = '1';
        label.style.whiteSpace = 'nowrap';
        label.style.textOverflow = 'ellipsis';
        label.style.overflow = 'hidden';
        block.appendChild(label);

        v1Track.appendChild(block);
      });

      // Render FX Tracks
      currentTimeline.effectTracks.forEach((fxTrack, idx) => {
        // Header
        trackHeadersEl.insertAdjacentHTML('beforeend', `
          <div class="tme-track-header" style="height: 40px; border-bottom: 1px solid var(--ps-border); padding: 8px; display: flex; align-items: center; justify-content: space-between;">
            <span class="text-xs font-mono text-muted">${fxTrack.name || 'FX ' + (idx + 1)}</span>
            <div style="display:flex; align-items:center; gap:4px;">
              <span class="node-category-tag node-category-tag--overlay">FX</span>
              <button class="btn-ghost tme-btn-toggle-track" data-track-type="fx" data-track-idx="${idx}" style="padding: 0; min-width: auto;">
                <span class="material-symbols-outlined text-muted text-sm" style="font-size:16px;">${fxTrack.disabled ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
        `);

        // Body
        const fxEl = document.createElement('div');
        fxEl.className = 'tme-track tme-fx-track-body';
        fxEl.dataset.trackId = fxTrack.id;
        fxEl.style.height = '40px';
        fxEl.style.borderBottom = '1px solid var(--ps-border)';
        fxEl.style.position = 'relative';
        if (fxTrack.disabled) fxEl.style.opacity = '0.3';
        tracksBodyEl.appendChild(fxEl);

        // Bind Drop Listeners
        fxEl.addEventListener('dragover', (e) => { e.preventDefault(); fxEl.style.background = 'rgba(167, 139, 255, 0.1)'; });
        fxEl.addEventListener('dragleave', () => { fxEl.style.background = 'transparent'; });
        fxEl.addEventListener('drop', async (e) => {
          e.preventDefault();
          fxEl.style.background = 'transparent';
          try {
            const dataStr = e.dataTransfer.getData('application/json');
            if (!dataStr) return;
            const data = JSON.parse(dataStr);
            if (data.type === 'effect') {
              const rect = fxEl.getBoundingClientRect();
              const dropX = e.clientX - rect.left + container.querySelector('#tme-timeline-scroll').scrollLeft;
              const dropTime = Math.max(0, dropX / PIXELS_PER_SECOND);
              fxTrack.blocks.push({
                id: generateId(),
                transformId: data.transformId,
                startTime: dropTime,
                duration: 4.0,
                params: {},
                keyframes: []
              });
              await saveTimeline(currentTimeline);
              renderTimelineTracks();
            }
          } catch (err) { /* ignore */ }
        });

        // Render FX Blocks
        fxTrack.blocks.forEach(fx => {
          const def = registry.get(fx.transformId);
          const block = document.createElement('div');
          block.className = 'tme-fx-block';
          block.style.position = 'absolute';
          block.style.left = `${fx.startTime * PIXELS_PER_SECOND}px`;
          block.style.width = `${fx.duration * PIXELS_PER_SECOND}px`;
          block.style.height = '100%';
          block.style.background = 'rgba(167, 139, 250, 0.2)';
          block.style.border = selectedItemId === fx.id ? '2px solid var(--ps-danger)' : '1px solid var(--ps-blue)';
          block.style.borderRadius = '4px';
          block.style.display = 'flex';
          block.style.alignItems = 'center';
          block.style.fontSize = '10px';
          block.style.padding = '0 4px';
          block.style.color = 'var(--ps-blue)';
          block.style.cursor = 'grab';
          block.style.whiteSpace = 'nowrap';
          block.style.overflow = 'hidden';
          block.dataset.id = fx.id;

          const tIn = fx.transitionIn;
          if (tIn && tIn.style !== 'none' && tIn.duration > 0) {
            const w = tIn.duration * PIXELS_PER_SECOND;
            const el = document.createElement('div');
            el.style.cssText = `position:absolute; left:0; top:0; bottom:0; width:${w}px; background:linear-gradient(to right, rgba(0,0,0,0.5), transparent); pointer-events:none; z-index:3; border-left: 2px solid var(--ps-blue);`;
            block.appendChild(el);
          }

          const tOut = fx.transitionOut;
          if (tOut && tOut.style !== 'none' && tOut.duration > 0) {
            const w = tOut.duration * PIXELS_PER_SECOND;
            const el = document.createElement('div');
            el.style.cssText = `position:absolute; right:0; top:0; bottom:0; width:${w}px; background:linear-gradient(to left, rgba(0,0,0,0.5), transparent); pointer-events:none; z-index:3; border-right: 2px solid var(--ps-blue);`;
            block.appendChild(el);
          }

          setupDrag(block, fx, 'fx');
          
          const leftHandle = document.createElement('div');
          leftHandle.style.cssText = 'position:absolute; left:0; top:0; bottom:0; width:10px; cursor:ew-resize; z-index:5;';
          const rightHandle = document.createElement('div');
          rightHandle.style.cssText = 'position:absolute; right:0; top:0; bottom:0; width:10px; cursor:ew-resize; z-index:5;';
          
          setupTrim(leftHandle, fx, 'fx', true);
          setupTrim(rightHandle, fx, 'fx', false);
          
          block.appendChild(leftHandle);
          block.appendChild(rightHandle);

          const label = document.createElement('div');
          label.style.cssText = 'pointer-events:none; z-index:1;';
          label.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px; margin-right:4px;">${def?.icon || 'auto_awesome'}</span> ${def?.name || fx.transformId}`;
          block.appendChild(label);
          
          if (Array.isArray(fx.keyframes)) {
            fx.keyframes.forEach(kf => {
              const tick = document.createElement('div');
              tick.style.cssText = 'position:absolute; width:4px; height:10px; background:var(--ps-blue); top:15px; border-radius:2px; cursor:pointer; z-index:2;';
              tick.style.left = `${kf.offset * PIXELS_PER_SECOND}px`;
              tick.title = `Keyframe at ${kf.offset.toFixed(2)}s`;
              tick.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                let isDragging = false;
                let startX = e.clientX;
                let originalOffset = kf.offset;
                
                const onMouseMove = (moveEvent) => {
                  isDragging = true;
                  const deltaX = moveEvent.clientX - startX;
                  let newOffset = originalOffset + (deltaX / PIXELS_PER_SECOND);
                  
                  if (newOffset < 0) newOffset = 0;
                  if (newOffset > fx.duration) newOffset = fx.duration;
                  
                  kf.offset = newOffset;
                  tick.style.left = `${kf.offset * PIXELS_PER_SECOND}px`;
                  
                  playheadTime = fx.startTime + kf.offset;
                  updatePlayheadUI();
                  renderPropertiesPanel();
                  renderFrame();
                };
                
                const onMouseUp = async (upEvent) => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                  
                  if (!isDragging) {
                     playheadTime = fx.startTime + kf.offset;
                     selectedItemId = fx.id;
                     selectedItemType = 'fx';
                     updatePlayheadUI();
                     renderPropertiesPanel();
                     renderFrame();
                  } else {
                     fx.keyframes.sort((a, b) => a.offset - b.offset);
                     await saveTimeline(currentTimeline);
                     renderTimelineTracks();
                     renderPropertiesPanel();
                     renderFrame();
                  }
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              });
              block.appendChild(tick);
            });
          }

          fxEl.appendChild(block);
        });
      });

      // Render Audio Tracks
      currentTimeline.audioTracks.forEach((aTrack, idx) => {
        // Header
        trackHeadersEl.insertAdjacentHTML('beforeend', `
          <div class="tme-track-header" style="height: 60px; border-bottom: 1px solid var(--ps-border); padding: 8px; display: flex; align-items: center; justify-content: space-between;">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono text-muted">${aTrack.name || 'A' + (idx + 1)}</span>
              ${idx === currentTimeline.audioTracks.length - 1 ? `<button class="btn-ghost tme-btn-add-audio" style="width:20px;height:20px;padding:0;" title="Add Audio Track"><span class="material-symbols-outlined" style="font-size:14px;">add</span></button>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span class="text-muted text-sm font-bold" style="font-size: 10px;">AUDIO</span>
              <button class="btn-ghost tme-btn-toggle-track" data-track-type="audio" data-track-idx="${idx}" style="padding: 0; min-width: auto;">
                <span class="material-symbols-outlined text-muted text-sm" style="font-size:16px;">${aTrack.disabled ? 'volume_off' : 'volume_up'}</span>
              </button>
            </div>
          </div>
        `);

        // Body
        const audioEl = document.createElement('div');
        audioEl.className = 'tme-track';
        audioEl.style.height = '60px';
        audioEl.style.borderBottom = '1px solid var(--ps-border)';
        audioEl.style.position = 'relative';
        if (aTrack.disabled) audioEl.style.opacity = '0.3';
        tracksBodyEl.appendChild(audioEl);
        
        // Audio Track Drop
        audioEl.addEventListener('dragover', (e) => { e.preventDefault(); audioEl.style.background = 'rgba(0, 255, 100, 0.1)'; });
        audioEl.addEventListener('dragleave', () => { audioEl.style.background = 'transparent'; });
        audioEl.addEventListener('drop', async (e) => {
          e.preventDefault();
          audioEl.style.background = 'transparent';
          try {
            const dataStr = e.dataTransfer.getData('text/plain');
            if (!dataStr) return;
            const poolIds = JSON.parse(dataStr);
            const rect = audioEl.getBoundingClientRect();
            const dropX = e.clientX - rect.left + container.querySelector('#tme-timeline-scroll').scrollLeft;
            let currentTime = Math.max(0, dropX / PIXELS_PER_SECOND);
            poolIds.forEach(id => {
              const poolItem = currentTimeline.mediaPool.find(p => p.id === id);
              if (poolItem && poolItem.type === 'audio') {
                aTrack.blocks.push({ id: generateId(), poolId: id, startTime: currentTime, duration: 4.0, sourceStart: 0 });
                currentTime += 4.0;
              }
            });
            await saveTimeline(currentTimeline);
            renderTimelineTracks();
          } catch(err) {}
        });
        
        // Render Audio Blocks
        aTrack.blocks.forEach(clip => {
          const poolItem = currentTimeline.mediaPool.find(p => p.id === clip.poolId);
          if (!poolItem) return;
          const block = document.createElement('div');
          block.className = 'tme-clip tme-audio-block';
          block.style.position = 'absolute';
          block.style.left = `${clip.startTime * PIXELS_PER_SECOND}px`;
          block.style.width = `${clip.duration * PIXELS_PER_SECOND}px`;
          block.style.height = '100%';
          block.style.background = '#1a3322';
          block.style.border = selectedItemId === clip.id ? '2px solid var(--ps-danger)' : '1px solid #2d5a3c';
          block.style.borderRadius = '4px';
          block.style.overflow = 'hidden';
          block.style.display = 'flex';
          block.style.alignItems = 'center';
          block.style.fontSize = '11px';
          block.style.padding = '0 4px';
          block.style.color = '#fff';
          block.style.cursor = 'grab';
          block.dataset.id = clip.id;

          setupDrag(block, clip, 'audio');
          
          const leftHandle = document.createElement('div');
          leftHandle.style.cssText = 'position:absolute; left:0; top:0; bottom:0; width:10px; cursor:ew-resize; z-index:5;';
          const rightHandle = document.createElement('div');
          rightHandle.style.cssText = 'position:absolute; right:0; top:0; bottom:0; width:10px; cursor:ew-resize; z-index:5;';
          
          setupTrim(leftHandle, clip, 'audio', true);
          setupTrim(rightHandle, clip, 'audio', false);
          
          block.appendChild(leftHandle);
          block.appendChild(rightHandle);
          
          const label = document.createElement('span');
          label.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px; margin-right:4px;">music_note</span> ${poolItem.name || poolItem.fileHandle?.name || 'Audio'}`;
          label.style.position = 'relative';
          label.style.zIndex = '1';
          label.style.whiteSpace = 'nowrap';
          label.style.textOverflow = 'ellipsis';
          label.style.overflow = 'hidden';
          block.appendChild(label);

          audioEl.appendChild(block);
        });
      });

      // Add FX track button
      container.querySelector('#tme-btn-add-fx')?.addEventListener('click', async () => {
        const idx = currentTimeline.effectTracks.length + 1;
        currentTimeline.effectTracks.push({ id: generateId(), name: `FX ${idx}`, blocks: [] });
        await saveTimeline(currentTimeline);
        renderTimelineTracks();
      });

      // Add Audio track button logic
      container.querySelectorAll('.tme-btn-add-audio').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const idx = currentTimeline.audioTracks.length + 1;
          currentTimeline.audioTracks.push({ id: generateId(), name: `A ${idx}`, blocks: [] });
          await saveTimeline(currentTimeline);
          renderTimelineTracks();
        });
      });

      tracksBodyEl.addEventListener('click', () => {
        if (selectedItemId !== null) {
          selectedItemId = null;
          selectedItemType = null;
          renderTimelineTracks();
          renderPropertiesPanel();
        }
      });
      
      // Update ruler sizes if timeline grew
      setTimeout(renderRuler, 0);
    } catch (e) {
      console.error("Error rendering timeline tracks:", e);
      // Fallback display so we can see the error in UI
      tracksBodyEl.innerHTML = `<div style="color: red; padding: 20px;">Timeline Render Error: ${e.message}</div>`;
    }
  }



  // ─── Toolbar Actions ────────────────────────────────────
  const btnSplit = container.querySelector('#tme-btn-split');
  const btnMagnet = container.querySelector('#tme-btn-magnet');
  const btnDelete = container.querySelector('#tme-btn-delete-selected');
  const zoomSlider = container.querySelector('#tme-zoom-slider');
  const btnExport = container.querySelector('#tme-btn-export');
  const btnAddKeyframe = container.querySelector('#tme-btn-add-keyframe');

  if (btnAddKeyframe) {
    btnAddKeyframe.addEventListener('click', async () => {
      if (!selectedItemId || selectedItemType !== 'fx') return;
      let fxBlock = null;
      currentTimeline.effectTracks.forEach(t => {
        const b = t.blocks.find(blk => blk.id === selectedItemId);
        if (b) fxBlock = b;
      });
      if (!fxBlock) return;
      
      const offset = playheadTime - fxBlock.startTime;
      if (offset < 0 || offset > fxBlock.duration) return;

      if (!Array.isArray(fxBlock.keyframes) || fxBlock.keyframes.length === 0) {
        fxBlock.keyframes = [
          { offset: 0, params: JSON.parse(JSON.stringify(fxBlock.params || {})) }
        ];
      }
      
      const existingIdx = fxBlock.keyframes.findIndex(k => Math.abs(k.offset - offset) < 0.05);
      if (existingIdx === -1) {
        const currentParams = getInterpolatedParams(fxBlock, playheadTime);
        fxBlock.keyframes.push({ offset: offset, params: currentParams });
        fxBlock.keyframes.sort((a, b) => a.offset - b.offset);
        await saveTimeline(currentTimeline);
        renderTimelineTracks();
        renderPropertiesPanel();
      }
    });
  }

  if (btnMagnet) {
    btnMagnet.addEventListener('click', () => {
      isMagneticSnapping = !isMagneticSnapping;
      btnMagnet.classList.toggle('is-active', isMagneticSnapping);
      btnMagnet.style.color = isMagneticSnapping ? 'var(--ps-blue)' : 'inherit';
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!selectedItemId) return;
      if (selectedItemType === 'video') {
        currentTimeline.videoTrack = currentTimeline.videoTrack.filter(c => c.id !== selectedItemId);
      } else if (selectedItemType === 'fx') {
        currentTimeline.effectTracks.forEach(t => {
          t.blocks = t.blocks.filter(b => b.id !== selectedItemId);
        });
      } else if (selectedItemType === 'audio') {
        currentTimeline.audioTracks.forEach(t => {
          t.blocks = t.blocks.filter(b => b.id !== selectedItemId);
        });
      }
      selectedItemId = null;
      await saveTimeline(currentTimeline);
      renderTimelineTracks();
    });
  }

  if (btnSplit) {
    btnSplit.addEventListener('click', async () => {
      if (!selectedItemId) return;
      
      let splitHappened = false;

      if (selectedItemType === 'video') {
        const clipIndex = currentTimeline.videoTrack.findIndex(c => c.id === selectedItemId);
        if (clipIndex !== -1) {
          const clip = currentTimeline.videoTrack[clipIndex];
          if (playheadTime > clip.startTime && playheadTime < clip.startTime + clip.duration) {
            const splitOffset = playheadTime - clip.startTime;
            const newDuration2 = clip.duration - splitOffset;
            clip.duration = splitOffset;
            
            const newClip = {
              ...clip,
              id: generateId(),
              startTime: playheadTime,
              duration: newDuration2,
              sourceStart: clip.sourceStart + splitOffset
            };
            currentTimeline.videoTrack.splice(clipIndex + 1, 0, newClip);
            splitHappened = true;
          }
        }
      } else if (selectedItemType === 'fx') {
        currentTimeline.effectTracks.forEach(t => {
          const fxIndex = t.blocks.findIndex(b => b.id === selectedItemId);
          if (fxIndex !== -1) {
            const fx = t.blocks[fxIndex];
            if (playheadTime > fx.startTime && playheadTime < fx.startTime + fx.duration) {
              const splitOffset = playheadTime - fx.startTime;
              const newDuration2 = fx.duration - splitOffset;
              fx.duration = splitOffset;
              
              const newFx = {
                ...fx,
                id: generateId(),
                startTime: playheadTime,
                duration: newDuration2
              };
              t.blocks.splice(fxIndex + 1, 0, newFx);
              splitHappened = true;
            }
          }
        });
      } else if (selectedItemType === 'audio') {
        currentTimeline.audioTracks.forEach(t => {
          const aIndex = t.blocks.findIndex(b => b.id === selectedItemId);
          if (aIndex !== -1) {
            const clip = t.blocks[aIndex];
            if (playheadTime > clip.startTime && playheadTime < clip.startTime + clip.duration) {
              const splitOffset = playheadTime - clip.startTime;
              const newDuration2 = clip.duration - splitOffset;
              clip.duration = splitOffset;
              
              const newClip = {
                ...clip,
                id: generateId(),
                startTime: playheadTime,
                duration: newDuration2,
                sourceStart: (clip.sourceStart || 0) + splitOffset
              };
              t.blocks.splice(aIndex + 1, 0, newClip);
              splitHappened = true;
            }
          }
        });
      }

      if (splitHappened) {
        selectedItemId = null;
        await saveTimeline(currentTimeline);
        renderTimelineTracks();
      }
    });
  }

  if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
      PIXELS_PER_SECOND = parseInt(e.target.value, 10);
      renderTimelineTracks();
      renderRuler();
      updatePlayheadUI();
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      const maxTime = Math.max(
         ...currentTimeline.videoTrack.map(c => c.startTime + c.duration),
         ...currentTimeline.effectTracks.flatMap(t => t.blocks.map(b => b.startTime + b.duration)),
         0
      );
      if (maxTime === 0) return alert("Timeline is empty!");

      // Find the first video clip's resolution if available
      let defaultW = currentTimeline.width || 1920;
      let defaultH = currentTimeline.height || 1080;
      if (currentTimeline.videoTrack && currentTimeline.videoTrack.length > 0) {
        const firstClip = [...currentTimeline.videoTrack].sort((a,b) => a.startTime - b.startTime)[0];
        const poolItem = currentTimeline.mediaPool.find(m => m.id === firstClip.poolId);
        if (poolItem && poolItem.meta && poolItem.meta.width) {
          defaultW = poolItem.meta.width;
          defaultH = poolItem.meta.height;
        }
      }

      const resStr = window.prompt("Export Resolution (Width x Height):", `${defaultW}x${defaultH}`);
      if (!resStr) return; // cancelled
      const [parsedW, parsedH] = resStr.toLowerCase().split('x').map(s => parseInt(s.trim(), 10));
      if (!parsedW || !parsedH) return alert("Invalid resolution format. Please use WxH (e.g. 1920x1080).");
      
      // Update canvas and timeline with new dimensions
      canvas.width = parsedW;
      canvas.height = parsedH;
      currentTimeline.width = parsedW;
      currentTimeline.height = parsedH;
      await saveTimeline(currentTimeline);
      renderFrame();

      // Pause playback if it's currently running
      if (isPlaying) btnPlay.click();

      const fps = 30;
      const w = canvas.width % 2 === 0 ? canvas.width : canvas.width - 1;
      const h = canvas.height % 2 === 0 ? canvas.height : canvas.height - 1;

      let cancelExport = false;
      // Show progress modal
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:Inter, sans-serif;';
      modal.innerHTML = `
        <h2 style="margin-bottom:10px;">Exporting Video...</h2>
        <div id="tme-export-progress" style="color:#a1a1aa; margin-bottom:20px;">Preparing Audio Mix...</div>
        <button id="tme-btn-cancel-export" class="btn-secondary" style="border: 1px solid var(--ps-border);">Cancel Export</button>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#tme-btn-cancel-export').addEventListener('click', () => {
        cancelExport = true;
        modal.innerHTML = `<h2>Cancelling...</h2>`;
      });

      try {
        const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
        const { avcCodec } = await import('../engine/video-convert.js');

        // Mix Audio
        const sampleRate = 44100;
        const offlineCtx = new window.OfflineAudioContext(2, Math.max(1, Math.ceil(sampleRate * maxTime)), sampleRate);
        const allClips = [
          ...currentTimeline.audioTracks.flatMap(t => t.blocks),
          ...currentTimeline.videoTrack
        ];
        for (const clip of allClips) {
          if (cancelExport) break;
          const poolItem = currentTimeline.mediaPool.find(p => p.id === clip.poolId);
          if (poolItem && poolItem.fileHandle) {
             try {
               const file = await poolItem.fileHandle.getFile();
               const arrayBuffer = await file.arrayBuffer();
               const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
               const source = offlineCtx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(offlineCtx.destination);
               source.start(clip.startTime, clip.sourceStart || 0, Math.min(clip.duration, audioBuffer.duration - (clip.sourceStart || 0)));
             } catch(err) { /* Might be an image or silent video */ }
          }
        }
        
        let renderedAudio = null;
        if (!cancelExport) {
          renderedAudio = await offlineCtx.startRendering();
        }

        const target = new ArrayBufferTarget();
        const muxer  = new Muxer({ 
          target, 
          video: { codec: 'avc', width: w, height: h }, 
          audio: { codec: 'aac', sampleRate: 44100, numberOfChannels: 2 },
          fastStart: 'in-memory' 
        });

        await new Promise((resolve, reject) => {
          if (cancelExport) return reject(new Error('Cancelled'));

          const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: err => reject(new Error(`VideoEncoder: ${err.message}`)),
          });
          videoEncoder.configure({ codec: avcCodec(w, h), width: w, height: h, bitrate: 6_000_000, framerate: fps });

          const audioEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: err => reject(new Error(`AudioEncoder: ${err.message}`)),
          });
          audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 128_000 });

          const totalFrames = Math.ceil(maxTime * fps);
          
          (async () => {
            try {
              // 1. Encode Audio
              if (renderedAudio) {
                const channelData = [];
                for (let c=0; c<renderedAudio.numberOfChannels; c++) {
                    channelData.push(renderedAudio.getChannelData(c));
                }
                const chunkSize = 44100; // 1 second chunks
                const totalSamples = renderedAudio.length;
                let currentSample = 0;

                while (currentSample < totalSamples && !cancelExport) {
                   const size = Math.min(chunkSize, totalSamples - currentSample);
                   const planarData = new Float32Array(size * 2);
                   planarData.set(channelData[0].subarray(currentSample, currentSample + size), 0); // Ch 1
                   if (renderedAudio.numberOfChannels > 1) {
                     planarData.set(channelData[1].subarray(currentSample, currentSample + size), size); // Ch 2
                   } else {
                     planarData.set(channelData[0].subarray(currentSample, currentSample + size), size); // Duplicate Ch 1
                   }

                   const audioData = new AudioData({
                      format: 'f32-planar',
                      sampleRate: 44100,
                      numberOfFrames: size,
                      numberOfChannels: 2,
                      timestamp: (currentSample / 44100) * 1_000_000,
                      data: planarData
                   });

                   audioEncoder.encode(audioData);
                   audioData.close();
                   currentSample += size;
                   
                   modal.querySelector('#tme-export-progress').innerText = `Encoding Audio ${Math.round((currentSample/totalSamples)*100)}%`;
                   await new Promise(r => setTimeout(r, 0));
                }
                await audioEncoder.flush();
                audioEncoder.close();
              }

              if (cancelExport) return reject(new Error('Cancelled'));

              // 2. Encode Video
              for (let fi = 0; fi < totalFrames; fi++) {
                if (cancelExport) {
                  reject(new Error('Cancelled'));
                  break;
                }
                // Advance playhead manually for export loop
                playheadTime = fi / fps;
                await renderFrame(); 

                const vf = new VideoFrame(canvas, { timestamp: fi * (1_000_000 / fps) });
                videoEncoder.encode(vf, { keyFrame: fi % 30 === 0 });
                vf.close();

                // Yield to UI to show progress
                if (fi % 5 === 0) {
                  modal.querySelector('#tme-export-progress').innerText = `Rendering Frame ${fi} / ${totalFrames} (${Math.round((fi/totalFrames)*100)}%)`;
                  await new Promise(r => setTimeout(r, 0));
                }
              }
              if (!cancelExport) {
                await videoEncoder.flush();
                videoEncoder.close();
                resolve();
              }
            } catch (err) {
              reject(err);
            }
          })();
        });

        muxer.finalize();
        const blob = new Blob([target.buffer], { type: 'video/mp4' });
        
        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timeline-export-${Date.now()}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        
        modal.innerHTML = `
          <div style="text-align:center;">
            <span class="material-symbols-outlined" style="font-size:48px; color:var(--ps-green); margin-bottom:10px;">check_circle</span>
            <h2>Export Complete</h2>
            <button onclick="this.parentElement.parentElement.remove()" class="btn-secondary" style="margin-top:20px;">Close</button>
          </div>
        `;
      } catch (err) {
        if (err.message === 'Cancelled') {
          modal.remove();
        } else {
          modal.innerHTML = `
            <h2 style="color:var(--ps-danger);">Export Failed</h2>
            <p style="color:#a1a1aa; max-width:400px; text-align:center;">${err.message}</p>
            <button onclick="this.parentElement.parentElement.remove()" style="margin-top:20px; padding:10px 24px; background:var(--ps-surface); border:1px solid #444; border-radius:6px; color:white; cursor:pointer;">Close</button>
          `;
          console.error(err);
        }
      }
    });
  }

  // ─── Import Media ───────────────────────────────────────
  btnAddMedia.addEventListener('click', async () => {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Images, Video, and Audio',
          accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
            'video/*': ['.mp4', '.webm'],
            'audio/*': ['.mp3', '.wav', '.m4a']
          }
        }]
      });

      for (const handle of handles) {
        const file = await handle.getFile();
        let type = 'image';
        if (file.type.startsWith('video')) type = 'video';
        if (file.type.startsWith('audio')) type = 'audio';
        
        let thumbnail = '';
        let meta = await extractMediaMeta(file, type);
        
        if (type === 'image') {
          thumbnail = URL.createObjectURL(file);
        } else if (type === 'video') {
          thumbnail = await extractVideoThumbnail(file);
        }

        currentTimeline.mediaPool.push({
          id: generateId(),
          type,
          name: handle.name,
          fileHandle: handle,
          thumbnail,
          meta
        });
      }

      await saveTimeline(currentTimeline);
      renderMediaPool();

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to import media', err);
      }
    }
  });

  // ─── Drag & Drop to Import ──────────────────────────────
  poolContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    poolContainer.style.background = 'var(--ps-bg-raised)';
  });

  poolContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    poolContainer.style.background = 'transparent';
  });

  poolContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    poolContainer.style.background = 'transparent';

    const items = e.dataTransfer.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        // Skip non-media
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) continue;
        
        let handle = null;
        if ('getAsFileSystemHandle' in item) {
          handle = await item.getAsFileSystemHandle();
        } else {
          // fallback, won't persist across reloads
          handle = file;
        }

        let type = 'image';
        if (file.type.startsWith('video')) type = 'video';
        if (file.type.startsWith('audio')) type = 'audio';
        let thumbnail = '';
        let meta = await extractMediaMeta(file, type);

        if (type === 'image') {
          thumbnail = URL.createObjectURL(file);
        } else if (type === 'video') {
          thumbnail = await extractVideoThumbnail(file);
        }

        currentTimeline.mediaPool.push({
          id: generateId(),
          fileHandle: handle,
          type,
          name: file.name,
          thumbnail,
          meta
        });
      }
    }
    await saveTimeline(currentTimeline);
    renderMediaPool();
  });


  // ─── Playback & Preview Engine ──────────────────────────
  const canvas = container.querySelector('#tme-player-canvas');
  const ctx = canvas.getContext('2d');
  const btnPlay = container.querySelector('#tme-btn-play');
  const timecodeEl = container.querySelector('#tme-timecode');
  const playheadLine = container.querySelector('#tme-playhead');
  
  let isPlaying = false;
  let playheadTime = 0; // seconds
  let lastFrameTime = 0;
  let animFrameId = null;

  // Set canvas size from timeline
  canvas.width = currentTimeline.width;
  canvas.height = currentTimeline.height;

  function formatTimecode(seconds) {
    const d = new Date(seconds * 1000);
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    const s = d.getUTCSeconds().toString().padStart(2, '0');
    const ms = Math.floor(d.getUTCMilliseconds() / 10).toString().padStart(2, '0');
    return `${m}:${s}:${ms}`;
  }

  const activeAudioPlayers = new Map();

  function syncAudioPlayback() {
    const activeIds = new Set();
    const activeClips = [
      ...(currentTimeline.audioTracks?.filter(t => !t.disabled).flatMap(t => t.blocks) || []),
      ...(currentTimeline.videoTrackDisabled ? [] : currentTimeline.videoTrack)
    ].filter(c => playheadTime >= c.startTime && playheadTime < c.startTime + c.duration);

    if (isPlaying) {
      activeClips.forEach(clip => {
        activeIds.add(clip.id);
        if (!activeAudioPlayers.has(clip.id)) {
           const poolItem = currentTimeline.mediaPool.find(p => p.id === clip.poolId);
           if (poolItem && poolItem.fileHandle) {
               poolItem.fileHandle.getFile ? poolItem.fileHandle.getFile().then(file => playAudio(clip, file)) : playAudio(clip, poolItem.fileHandle);
           }
        } else {
           const audio = activeAudioPlayers.get(clip.id);
           const targetTime = playheadTime - clip.startTime + (clip.sourceStart || 0);
           if (Math.abs(audio.currentTime - targetTime) > 0.15) {
               audio.currentTime = targetTime;
           }
           if (audio.paused) audio.play().catch(e => {});
           
           const targetVol = clip.volume !== undefined ? clip.volume : 1;
           if (audio.volume !== targetVol) audio.volume = targetVol;
        }
      });
    }

    for (const [id, audio] of activeAudioPlayers.entries()) {
      if (!activeIds.has(id) || !isPlaying) {
         audio.pause();
         URL.revokeObjectURL(audio.src);
         activeAudioPlayers.delete(id);
      }
    }
  }

  function playAudio(clip, file) {
      const audio = new Audio(URL.createObjectURL(file));
      audio.currentTime = playheadTime - clip.startTime + (clip.sourceStart || 0);
      audio.volume = clip.volume !== undefined ? clip.volume : 1;
      audio.play().catch(e => {});
      activeAudioPlayers.set(clip.id, audio);
  }

  function updatePlayheadUI() {
    playheadLine.style.left = `${playheadTime * PIXELS_PER_SECOND}px`;
    timecodeEl.textContent = formatTimecode(playheadTime);
    syncAudioPlayback();

    const btnAddKeyframe = container.querySelector('#tme-btn-add-keyframe');
    if (btnAddKeyframe) {
      let isInsideActiveFx = false;
      if (selectedItemId && selectedItemType === 'fx') {
        let fxBlock = null;
        currentTimeline.effectTracks.forEach(t => {
          const b = t.blocks.find(blk => blk.id === selectedItemId);
          if (b) fxBlock = b;
        });
        if (fxBlock) {
          const offset = playheadTime - fxBlock.startTime;
          if (offset >= -0.01 && offset <= fxBlock.duration + 0.01) {
            isInsideActiveFx = true;
          }
        }
      }
      btnAddKeyframe.disabled = !isInsideActiveFx;
      btnAddKeyframe.style.opacity = isInsideActiveFx ? '1' : '0.5';
    }
  }

  const imageCache = new Map();
  const videoCache = new Map();

  async function loadVideoFrameAtTime(poolItem, time) {
    let videoObj = videoCache.get(poolItem.id);
    if (!videoObj) {
      let file;
      try {
        file = poolItem.fileHandle.getFile ? await poolItem.fileHandle.getFile() : poolItem.fileHandle;
      } catch(e) {
        return null;
      }
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.crossOrigin = 'anonymous';
      videoObj = { video };
      videoCache.set(poolItem.id, videoObj);
      
      // Wait for metadata to load so seeking works reliably
      await new Promise(r => {
        video.onloadedmetadata = r;
        video.onerror = r;
      });
    }
    
    const { video } = videoObj;
    
    return new Promise((resolve) => {
      if (Math.abs(video.currentTime - time) < 0.05) {
        return resolve(video);
      }
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve(video);
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  }

  async function loadFrame(activeClip, timeOverride = null) {
    const item = currentTimeline.mediaPool.find(p => p.id === activeClip.poolId);
    if (!item) return null;
    
    if (item.type === 'image') {
      if (imageCache.has(item.id)) return imageCache.get(item.id);
      return new Promise(async (resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageCache.set(item.id, img);
          resolve(img);
        };
        img.onerror = () => resolve(null);
        
        let file;
        try { file = item.fileHandle.getFile ? await item.fileHandle.getFile() : item.fileHandle; } catch(e){}
        img.src = file ? URL.createObjectURL(file) : item.thumbnail; 
      });
    } else if (item.type === 'video') {
      const pTime = timeOverride !== null ? timeOverride : playheadTime;
      const clipTime = Math.max(0, pTime - activeClip.startTime + (activeClip.sourceStart || 0));
      return loadVideoFrameAtTime(item, clipTime);
    }
    return null;
  }

  function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return [r, g, b];
  }

  function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
  }

  function interpolateValue(val1, val2, t) {
    if (typeof val1 === 'number' && typeof val2 === 'number') {
      return val1 + (val2 - val1) * t;
    }
    if (typeof val1 === 'string' && typeof val2 === 'string' && val1.startsWith('#') && val2.startsWith('#')) {
      const [r1, g1, b1] = hexToRgb(val1);
      const [r2, g2, b2] = hexToRgb(val2);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return rgbToHex(r, g, b);
    }
    return t < 0.5 ? val1 : val2;
  }

  function getInterpolatedParams(fxBlock, playheadTime) {
    if (!Array.isArray(fxBlock.keyframes) || fxBlock.keyframes.length === 0) {
      return fxBlock.params || {};
    }
    const offset = playheadTime - fxBlock.startTime;
    
    let kfBefore = null;
    let kfAfter = null;
    
    for (const kf of fxBlock.keyframes) {
      if (kf.offset <= offset) {
        if (!kfBefore || kf.offset > kfBefore.offset) kfBefore = kf;
      }
      if (kf.offset >= offset) {
        if (!kfAfter || kf.offset < kfAfter.offset) kfAfter = kf;
      }
    }
    
    if (!kfBefore && !kfAfter) return fxBlock.params || {};
    if (!kfBefore) return kfAfter.params;
    if (!kfAfter) return kfBefore.params;
    if (kfBefore.offset === kfAfter.offset) return kfBefore.params;
    
    const t = (offset - kfBefore.offset) / (kfAfter.offset - kfBefore.offset);
    
    const interpolated = {};
    const allKeys = new Set([...Object.keys(kfBefore.params), ...Object.keys(kfAfter.params)]);
    
    for (const key of allKeys) {
      const v1 = kfBefore.params[key];
      const v2 = kfAfter.params[key];
      if (v1 === undefined) interpolated[key] = v2;
      else if (v2 === undefined) interpolated[key] = v1;
      else interpolated[key] = interpolateValue(v1, v2, t);
    }
    return interpolated;
  }

  let compositor = null;

  async function renderFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!compositor && canvas.width > 0 && canvas.height > 0) {
      compositor = new WebGLCompositor(canvas.width, canvas.height);
    }

    function drawSourceToCtx(frameSource, targetCtx) {
      const sourceW = frameSource.videoWidth || frameSource.width;
      const sourceH = frameSource.videoHeight || frameSource.height;
      const scale = Math.max(canvas.width / sourceW, canvas.height / sourceH);
      const x = (canvas.width / 2) - (sourceW / 2) * scale;
      const y = (canvas.height / 2) - (sourceH / 2) * scale;
      targetCtx.drawImage(frameSource, x, y, sourceW * scale, sourceH * scale);
    }

    // --- 1. VIDEO RENDERING ---
    if (!currentTimeline.videoTrackDisabled) {
      const activeClipIdx = currentTimeline.videoTrack.findIndex(c => 
        playheadTime >= c.startTime && playheadTime < c.startTime + c.duration
      );

      if (activeClipIdx !== -1) {
        const activeClip = currentTimeline.videoTrack[activeClipIdx];
        const tIn = activeClip.transitionIn || { style: 'none', duration: 0 };
        const tOut = activeClip.transitionOut || { style: 'none', duration: 0 };
        
        const isTransIn = tIn.style !== 'none' && tIn.duration > 0 && playheadTime < activeClip.startTime + tIn.duration;
        const isTransOut = tOut.style !== 'none' && tOut.duration > 0 && playheadTime >= (activeClip.startTime + activeClip.duration) - tOut.duration;

        if (compositor && (isTransIn || isTransOut)) {
          let progress = 0;
          let style = 'none';
          let fromClip = null;
          let toClip = null;

          if (isTransIn) {
            progress = (playheadTime - activeClip.startTime) / tIn.duration;
            style = tIn.style;
            toClip = activeClip;
            fromClip = activeClipIdx > 0 ? currentTimeline.videoTrack[activeClipIdx - 1] : null;
          } else {
            progress = (playheadTime - ((activeClip.startTime + activeClip.duration) - tOut.duration)) / tOut.duration;
            style = tOut.style;
            fromClip = activeClip;
            toClip = activeClipIdx < currentTimeline.videoTrack.length - 1 ? currentTimeline.videoTrack[activeClipIdx + 1] : null;
          }

          const toFrameSrc = toClip ? await loadFrame(toClip, isTransOut ? toClip.startTime : playheadTime) : null;
          const fromFrameSrc = fromClip ? await loadFrame(fromClip, isTransIn ? fromClip.startTime + fromClip.duration : playheadTime) : null;
          
          let toBmp = null, fromBmp = null;
          let toTex = null, fromTex = null;

          if (toFrameSrc) {
             const tempC = new OffscreenCanvas(canvas.width, canvas.height);
             const tempCtx = tempC.getContext('2d');
             drawSourceToCtx(toFrameSrc, tempCtx);
             try { toBmp = await createImageBitmap(tempC); } catch(e) {}
             toTex = compositor.createTexture(toBmp || null);
          }
          if (fromFrameSrc) {
             const tempC = new OffscreenCanvas(canvas.width, canvas.height);
             const tempCtx = tempC.getContext('2d');
             drawSourceToCtx(fromFrameSrc, tempCtx);
             try { fromBmp = await createImageBitmap(tempC); } catch(e) {}
             fromTex = compositor.createTexture(fromBmp || null);
          }

          compositor.renderFrame({
            programName: style,
            fromTex,
            toTex,
            progress,
            fromMotion: null,
            toMotion: null
          });

          ctx.drawImage(compositor.canvas, 0, 0, canvas.width, canvas.height);

          if (toTex) compositor.gl.deleteTexture(toTex);
          if (fromTex) compositor.gl.deleteTexture(fromTex);
          if (toBmp) toBmp.close();
          if (fromBmp) fromBmp.close();
        } else {
          const frameSource = await loadFrame(activeClip);
          if (frameSource) {
            drawSourceToCtx(frameSource, ctx);
          }
        }
      }
    }

    // --- 2. EFFECT RENDERING ---
    const activeFx = currentTimeline.effectTracks
      .filter(t => !t.disabled)
      .flatMap(t => t.blocks)
      .filter(fx => playheadTime >= fx.startTime && playheadTime < fx.startTime + fx.duration);

    for (const fx of activeFx) {
      const def = registry.get(fx.transformId);
      if (def) {
        try {
          const context = { timestampSec: playheadTime };
          const interpParams = getInterpolatedParams(fx, playheadTime);

          const tIn = fx.transitionIn || { style: 'none', duration: 0 };
          const tOut = fx.transitionOut || { style: 'none', duration: 0 };
          const isTransIn = tIn.style !== 'none' && tIn.duration > 0 && playheadTime < fx.startTime + tIn.duration;
          const isTransOut = tOut.style !== 'none' && tOut.duration > 0 && playheadTime >= (fx.startTime + fx.duration) - tOut.duration;

          if (compositor && (isTransIn || isTransOut)) {
            // Render effect to isolated canvas
            const fxCanvas = new OffscreenCanvas(canvas.width, canvas.height);
            const fxCtx = fxCanvas.getContext('2d');
            
            if (def.applyPerFrame) await def.applyPerFrame(fxCtx, interpParams, context);
            else if (def.apply) await def.apply(fxCtx, interpParams, context);

            const style = isTransIn ? tIn.style : tOut.style;
            const progress = isTransIn 
              ? (playheadTime - fx.startTime) / tIn.duration 
              : (playheadTime - ((fx.startTime + fx.duration) - tOut.duration)) / tOut.duration;

            let fxBmp = null;
            try {
              fxBmp = await createImageBitmap(fxCanvas);
            } catch (e) {
              // Ignore untouched/empty canvas errors
            }
            const fxTex = compositor.createTexture(fxBmp || null);
            
            // Empty transparent texture
            const emptyTex = compositor.createTexture(null);

            const fromTex = isTransIn ? emptyTex : fxTex;
            const toTex = isTransIn ? fxTex : emptyTex;
            
            compositor.renderFrame({
              programName: style,
              fromTex,
              toTex,
              progress,
              fromMotion: null,
              toMotion: null
            });

            ctx.drawImage(compositor.canvas, 0, 0);

            compositor.gl.deleteTexture(fxTex);
            compositor.gl.deleteTexture(emptyTex);
            if (fxBmp) fxBmp.close();
          } else {
            // Normal direct render
            if (def.applyPerFrame) {
              await def.applyPerFrame(ctx, interpParams, context);
            } else if (def.apply) {
              await def.apply(ctx, interpParams, context);
            }
          }
        } catch (err) {
          console.warn(`Effect ${fx.transformId} failed during preview:`, err);
        }
      }
    }
  }

  async function loop(timestamp) {
    if (!isPlaying) return;
    
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    playheadTime += dt;
    
    // Auto stop if we pass the end of the last clip or effect
    let maxTime = currentTimeline.videoTrack.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
    if (currentTimeline.effectTracks) {
      currentTimeline.effectTracks.forEach(t => {
        maxTime = t.blocks.reduce((max, fx) => Math.max(max, fx.startTime + fx.duration), maxTime);
      });
    }
    if (currentTimeline.audioTracks) {
      currentTimeline.audioTracks.forEach(t => {
        maxTime = t.blocks.reduce((max, au) => Math.max(max, au.startTime + au.duration), maxTime);
      });
    }

    if (playheadTime > maxTime && maxTime > 0) {
      playheadTime = 0; // loop back to start
    }

    updatePlayheadUI();
    await renderFrame();

    animFrameId = requestAnimationFrame(loop);
  }

  container.addEventListener('click', async (e) => {
    if (e.target.closest('.tme-btn-add-audio')) {
      const idx = currentTimeline.audioTracks.length + 1;
      currentTimeline.audioTracks.push({ id: generateId(), name: `A${idx}`, blocks: [] });
      await saveTimeline(currentTimeline);
      renderTimelineTracks();
    }
  });

  btnPlay.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      btnPlay.innerHTML = '<span class="material-symbols-outlined">pause</span>';
      lastFrameTime = 0;
      animFrameId = requestAnimationFrame(loop);
    } else {
      btnPlay.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      if (animFrameId) cancelAnimationFrame(animFrameId);
      syncAudioPlayback();
    }
  });

  // Render first frame on load
  setTimeout(renderFrame, 500);

  // ─── Initial Render ───────────────────────────────────────
  renderMediaPool();
  renderEffectsPool();
  renderTimelineTracks();
  updatePlayheadUI();

  const btnSave = container.querySelector('#tme-btn-save');
  const btnOpen = container.querySelector('#tme-btn-open');
  const btnNew = container.querySelector('#tme-btn-new');
  const projectNameEl = container.querySelector('#tme-project-name');

  if (btnNew) {
    btnNew.addEventListener('click', async () => {
      if (confirm('Create a new project? Any unsaved changes will be lost.')) {
        if (isPlaying) {
          isPlaying = false;
          btnPlay.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
          if (animFrameId) cancelAnimationFrame(animFrameId);
          if (typeof syncAudioPlayback === 'function') syncAudioPlayback();
        }
        
        currentTimeline = createEmptyTimeline();
        await saveTimeline(currentTimeline);
        playheadTime = 0;
        mediaPoolSelection.clear();
        selectedItemId = null;
        selectedItemType = null;
        
        if (projectNameEl) projectNameEl.textContent = currentTimeline.name;
        
        renderMediaPool();
        renderTimelineTracks();
        renderPropertiesPanel();
        updatePlayheadUI();
        renderFrame();
      }
    });
  }

  if (projectNameEl) {
    projectNameEl.addEventListener('blur', async () => {
      currentTimeline.name = projectNameEl.textContent.trim() || 'Untitled Project';
      await saveTimeline(currentTimeline);
    });
    projectNameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); projectNameEl.blur(); }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: `${currentTimeline.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.picmachina`,
          types: [{ description: 'Pic-Machina Project', accept: { 'application/json': ['.picmachina'] } }]
        });
        
        // Save copy without dropping fileHandles explicitly here since stringify ignores them,
        // but we ensure name is serialized.
        const saveState = JSON.parse(JSON.stringify(currentTimeline));
        
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(saveState, null, 2));
        await writable.close();
        window.AuroraToast?.show({ variant: 'success', title: 'Project Saved' });
      } catch (err) { /* user cancelled */ }
    });
  }

  if (btnOpen) {
    btnOpen.addEventListener('click', async () => {
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{ description: 'Pic-Machina Project', accept: { 'application/json': ['.picmachina'] } }]
        });
        const file = await fileHandle.getFile();
        const text = await file.text();
        const loadedTimeline = JSON.parse(text);
        
        // Relink media handles
        const needsRelink = loadedTimeline.mediaPool?.length > 0;
        if (needsRelink) {
          const proceed = await window.confirm('Please select the root folder containing the media files used in this project.');
          if (proceed) {
            const dirHandle = await window.showDirectoryPicker();
            
            // Shallow search for reconnecting handles
            const entries = [];
            for await (const entry of dirHandle.values()) {
              if (entry.kind === 'file') entries.push(entry);
            }
            
            loadedTimeline.mediaPool.forEach(poolItem => {
               const matchingEntry = entries.find(e => e.name === poolItem.name);
               if (matchingEntry) {
                 poolItem.fileHandle = matchingEntry;
                 // Note: we can't reconstruct image thumbnails here immediately unless we do it async
                 if (poolItem.type === 'image') {
                   matchingEntry.getFile().then(f => poolItem.thumbnail = URL.createObjectURL(f));
                 } else if (poolItem.type === 'video') {
                   matchingEntry.getFile().then(f => extractVideoThumbnail(f).then(t => poolItem.thumbnail = t));
                 }
               }
            });
          }
        }
        
        currentTimeline = loadedTimeline;
        await saveTimeline(currentTimeline);
        
        // Re-render
        renderMediaPool();
        renderTimelineTracks();
        updatePlayheadUI();
        renderFrame();
      } catch (err) { console.error(err); }
    });
  }

  return () => {
    isPlaying = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
  };
}

async function extractMediaMeta(file, type) {
  let meta = { size: file.size, lastModified: file.lastModified };
  if (type === 'image') {
    try {
      const bmp = await createImageBitmap(file);
      meta.width = bmp.width;
      meta.height = bmp.height;
      bmp.close();
    } catch(e) {}
  } else if (type === 'video') {
    await new Promise(res => {
      const v = document.createElement('video');
      v.src = URL.createObjectURL(file);
      v.onloadedmetadata = () => {
         meta.width = v.videoWidth;
         meta.height = v.videoHeight;
         meta.duration = v.duration;
         URL.revokeObjectURL(v.src);
         res();
      };
      v.onerror = () => { URL.revokeObjectURL(v.src); res(); };
    });
  }
  return meta;
}

async function extractVideoThumbnail(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.crossOrigin = 'anonymous';
    
    video.onloadeddata = () => {
      video.currentTime = Math.min(1.0, video.duration / 2); // grab a frame slightly into the video
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      // Scale down for thumbnail
      const aspect = video.videoWidth / video.videoHeight;
      canvas.height = 100;
      canvas.width = 100 * aspect;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(video.src);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    video.onerror = () => {
      resolve(''); // fallback empty
    };
  });
}
