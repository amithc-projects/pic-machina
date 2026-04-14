import { extractExif } from '../engine/exif-reader.js';
import { isVideoFile, extractVideoFrame } from '../utils/video-frame.js';

/**
 * ImageWorkspace Unified Component
 * Handles unified Image Viewing capabilities across all screens:
 * - Zoom on Hover
 * - Side-by-Side and Slider Compare Modes
 * - Info Modal (Metadata)
 * - Carousel Folder Support
 */
export class ImageWorkspace {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      allowFolder: true,
      allowUpload: true,
      onRender: async (file) => ({
        beforeUrl: URL.createObjectURL(file),
        afterUrl: URL.createObjectURL(file),
        beforeLabel: 'Original',
        afterLabel: 'Result',
        context: null,
      }),
      onInfo: async (file, afterUrl, context) => {
        const { renderFileInfoModal } = await import('../utils/info-modal.js');
        renderFileInfoModal(file, afterUrl);
      },
      customControlsHtml: '',
      onBindCustomControls: (container) => {},
      onFilesChange: (files, activeFile) => {}
    }, options);

    this.files = [];
    this.activeFile = null;
    this.compareMode = localStorage.getItem('ic-cmp-mode') === 'true';
    this.compareLayout = localStorage.getItem('ic-cmp-layout') || 'slider'; // 'slider' or 'side'
    this.isZoomEnabled = localStorage.getItem('ic-zoom-enabled') === 'true';
    this.isDraggingLayout = false;
    this.lastRenderResult = null;

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="ic-image-workspace" style="display:flex;flex-direction:column;height:100%;background:var(--ps-surface)">
        <div class="iw-header" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--ps-border)">
          <div class="iw-title" style="font-size:13px;font-weight:500;color:var(--ps-text)">Preview</div>
          <style>
             .ic-image-workspace.is-single-mode .iw-custom-controls { opacity: 0.5; pointer-events: none; }
          </style>
          <div class="iw-controls" style="display:flex;align-items:center;gap:8px">

            <div class="iw-cmp-controls" style="display:none;align-items:center;gap:8px">
              <button class="btn-icon iw-zoom-btn" title="Toggle Zoom on hover" style="color:${this.isZoomEnabled ? 'var(--ps-blue)' : 'var(--ps-text-muted)'}">
                <span class="material-symbols-outlined">search</span>
              </button>
              <button class="btn-icon iw-info-btn" title="Toggle Info metadata modal" style="color:var(--ps-text-muted)">
                <span class="material-symbols-outlined">info</span>
              </button>
              <div class="iw-mode-toggle" style="display:flex;background:var(--ps-bg);border-radius:4px;padding:2px">
                <button class="btn-icon iw-layout-single ${!this.compareMode ? 'is-active' : ''}" title="Single Preview" style="border-radius:3px;width:28px;height:28px">
                  <span class="material-symbols-outlined" style="font-size:16px">crop_square</span>
                </button>
                <button class="btn-icon iw-layout-slider ${this.compareMode && this.compareLayout === 'slider' ? 'is-active' : ''}" title="Slider" style="border-radius:3px;width:28px;height:28px">
                  <span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span>
                </button>
                <button class="btn-icon iw-layout-side ${this.compareMode && this.compareLayout === 'side' ? 'is-active' : ''}" title="Side by side" style="border-radius:3px;width:28px;height:28px">
                  <span class="material-symbols-outlined" style="font-size:16px">vertical_split</span>
                </button>
              </div>
              <div class="iw-custom-controls" style="display:flex;align-items:center">${this.options.customControlsHtml}</div>
            </div>

            <div style="display:flex;gap:8px">
              ${this.options.allowUpload ? `
                <label class="btn-secondary iw-upload-label" style="cursor:pointer" title="Upload a test image">
                  <span class="material-symbols-outlined" style="font-size:14px">image</span>
                  Image
                  <input type="file" class="iw-file-input" accept="image/*" style="display:none">
                </label>
              ` : ''}
              ${this.options.allowFolder ? `
                <button class="btn-secondary iw-folder-btn" title="Select a test folder">
                  <span class="material-symbols-outlined" style="font-size:14px">folder_open</span>
                  Folder
                </button>
              ` : ''}
            </div>
          </div>
        </div>
        
        <div class="iw-stage" style="flex:1;position:relative;overflow:hidden;min-height:200px">
          <div class="empty-state" style="padding:24px;text-align:center;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
             <span class="material-symbols-outlined" style="font-size:36px;color:var(--ps-text-muted)">image</span>
             <div style="font-size:12px;margin-top:8px">Drop an image here</div>
          </div>
        </div>

        <div class="iw-carousel" style="display:none;padding:12px;gap:8px;overflow-x:auto;white-space:nowrap;border-top:1px solid var(--ps-border);background:var(--ps-bg);min-height:73px"></div>
        
        <style>
          .iw-stage.iw-dragover { outline:2px dashed var(--ps-blue); outline-offset:-4px; }
          .iw-layout-slider.is-active, .iw-layout-side.is-active { background:var(--ps-surface); box-shadow:0 1px 2px rgba(0,0,0,0.1); color:var(--ps-text) !important; }
          .iw-layout-slider, .iw-layout-side { color:var(--ps-text-muted); width:24px;height:24px; }
          .iw-thumb { height:48px;width:48px;object-fit:cover;border-radius:4px;cursor:pointer;border:2px solid transparent;flex-shrink:0;background:var(--ps-bg); }
          .iw-thumb.is-active { border-color:var(--ps-blue); }
          
          .iw-cmp-wrap { position:absolute;inset:0;width:100%;height:100%;overflow:hidden; }
          .iw-cmp-img { position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;pointer-events:none; }
          .iw-cmp-handle { position:absolute;top:0;bottom:0;width:20px;margin-left:-10px;cursor:col-resize;display:flex;align-items:center;justify-content:center;z-index:10; }
          .iw-cmp-handle-line { position:absolute;top:0;bottom:0;left:9px;width:2px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,0.5); }
          .iw-cmp-handle-knob { position:relative;width:28px;height:28px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);color:#333; }
          .iw-cmp-label { position:absolute;top:10px;padding:4px 8px;background:rgba(0,0,0,0.6);color:#fff;border-radius:4px;font-size:11px;font-weight:500;z-index:5;pointer-events:none;backdrop-filter:blur(4px); }
          .iw-cmp-label--l { left:10px; }
          .iw-cmp-label--r { right:10px; }
          
          .iw-side-view { display:flex;width:100%;height:100%;overflow:hidden; }
          .iw-side { flex:1;position:relative;min-width:0;display:flex;align-items:center;justify-content:center; }
          .iw-side-img { position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block; }
          .iw-divider { width:1px;background:var(--ps-border);z-index:2; }
          .iw-side-label { position:absolute;top:10px;left:10px;padding:4px 8px;background:rgba(0,0,0,0.6);color:#fff;border-radius:4px;font-size:11px;font-weight:500;pointer-events:none;z-index:5;backdrop-filter:blur(4px); }
          .iw-side-label--blue { background:var(--ps-blue); }
          
          .iw-single-wrap { position:absolute;inset:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center; }
        </style>
      </div>
    `;

    this.stage = this.container.querySelector('.iw-stage');
    this.carousel = this.container.querySelector('.iw-carousel');
    this.cmpControls = this.container.querySelector('.iw-cmp-controls');
    this.modeToggleGroup = this.container.querySelector('.iw-mode-toggle');
  }

  bindEvents() {
    // Zoom Toggle
    this.container.querySelector('.iw-zoom-btn')?.addEventListener('click', (e) => {
      this.isZoomEnabled = !this.isZoomEnabled;
      localStorage.setItem('ic-zoom-enabled', this.isZoomEnabled);
      e.currentTarget.style.color = this.isZoomEnabled ? 'var(--ps-blue)' : 'var(--ps-text-muted)';
      if (!this.isZoomEnabled) this.resetZoom();
    });

    // Zoom Hover logic
    this.stage.addEventListener('mousemove', (e) => {
      if (!this.isZoomEnabled || this.isDraggingLayout) return;
      const view = this.stage.querySelector('.iw-cmp-wrap, .iw-side-view, .iw-single-wrap');
      if (!view) return;
      const rect = this.stage.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      view.style.transformOrigin = `${x}% ${y}%`;
      view.style.transform = 'scale(2)';
      view.style.transition = 'none';
    });
    this.stage.addEventListener('mouseleave', () => {
      if (this.isZoomEnabled) this.resetZoom();
    });

    // Custom controls binding
    if (this.options.onBindCustomControls) {
      this.options.onBindCustomControls(this.container);
    }

    this.container.querySelector('.iw-layout-single')?.addEventListener('click', () => {
      this.compareMode = false;
      this._tempCompareMode = false;
      localStorage.setItem('ic-cmp-mode', 'false');
      this.updateLayoutToggleUI();
      this.renderCurrentState();
    });

    this.container.querySelector('.iw-layout-slider')?.addEventListener('click', () => {
      this.compareLayout = 'slider';
      this.compareMode = true;
      this._tempCompareMode = true;
      localStorage.setItem('ic-cmp-layout', 'slider');
      localStorage.setItem('ic-cmp-mode', 'true');
      this.updateLayoutToggleUI();
      this.renderCurrentState();
    });
    this.container.querySelector('.iw-layout-side')?.addEventListener('click', () => {
      this.compareLayout = 'side';
      this.compareMode = true;
      this._tempCompareMode = true;
      localStorage.setItem('ic-cmp-layout', 'side');
      localStorage.setItem('ic-cmp-mode', 'true');
      this.updateLayoutToggleUI();
      this.renderCurrentState();
    });

    // Info button
    this.container.querySelector('.iw-info-btn')?.addEventListener('click', () => {
      if (this.activeFile && this.lastRenderResult) {
        this.options.onInfo(this.activeFile, this.lastRenderResult.afterUrl, this.lastRenderResult.context);
      }
    });

    // Drag and Drop files
    this.stage.addEventListener('dragover', e => { e.preventDefault(); this.stage.classList.add('iw-dragover'); });
    this.stage.addEventListener('dragleave', () => this.stage.classList.remove('iw-dragover'));
    this.stage.addEventListener('drop', async e => {
      e.preventDefault();
      this.stage.classList.remove('iw-dragover');
      const droppedFiles = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
      if (droppedFiles.length === 0) return;
      this.loadFiles(droppedFiles);
    });

    // Inputs
    this.container.querySelector('.iw-file-input')?.addEventListener('change', e => {
      if (e.target.files?.[0]) this.loadFiles([e.target.files[0]]);
    });

    this.container.querySelector('.iw-folder-btn')?.addEventListener('click', async () => {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        const { listImages } = await import('../data/folders.js');
        const files = await listImages(handle);
        if (files.length > 0) this.loadFiles(files);
      } catch (err) {
         if (err.name !== 'AbortError') console.error(err);
      }
    });
  }

  updateLayoutToggleUI() {
    this.container.querySelector('.iw-layout-single')?.classList.toggle('is-active', !this.compareMode);
    this.container.querySelector('.iw-layout-slider')?.classList.toggle('is-active', this.compareMode && this.compareLayout === 'slider');
    this.container.querySelector('.iw-layout-side')?.classList.toggle('is-active', this.compareMode && this.compareLayout === 'side');
    this.container.querySelector('.ic-image-workspace')?.classList.toggle('is-single-mode', !this.compareMode);
  }

  resetZoom() {
    const view = this.stage.querySelector('.iw-cmp-wrap, .iw-side-view, .iw-single-wrap');
    if (view) {
      view.style.transform = 'none';
      view.style.transition = 'transform 0.1s ease';
    }
  }

  loadFiles(filesArr) {
    this.files = filesArr;
    this.activeFile = this.files[0];
    this.options.onFilesChange(this.files, this.activeFile);
    this.renderCarousel();
    this.triggerProcess();
  }

  setFiles(filesArr, forceIndex = 0) {
    this.files = filesArr || [];
    this.activeFile = this.files[forceIndex] || this.files[0];
    this.options.onFilesChange(this.files, this.activeFile);
    this.renderCarousel();
    this.triggerProcess();
  }
  
  async triggerProcess() {
    if (!this.activeFile) return;
    this.stage.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%"><div class="spinner"></div></div>`;
    
    try {
      this.lastRenderResult = await this.options.onRender(this.activeFile);
      const canCompare = this.lastRenderResult?.canCompare ?? true;
      
      if (this.modeToggleGroup) {
         this.modeToggleGroup.style.display = canCompare ? 'flex' : 'none';
      }

      if (!canCompare && this.compareMode) {
         // Temporarily suppress compare mode rendering without overwriting localStorage
         this._tempCompareMode = false;
      } else {
         this._tempCompareMode = this.compareMode;
      }
      
      this.cmpControls.style.display = 'flex';
      this.updateLayoutToggleUI();
      this.renderCurrentState();
    } catch (err) {
      console.error(err);
      this.stage.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  renderCurrentState() {
    if (!this.lastRenderResult) return;
    const { beforeUrl, afterUrl, beforeLabel, afterLabel } = this.lastRenderResult;

    const effectiveCompareMode = this._tempCompareMode ?? this.compareMode;

    if (!effectiveCompareMode) {
      this.stage.innerHTML = `
        <div class="iw-single-wrap">
          <img src="${afterUrl}" class="iw-cmp-img" style="position:relative" draggable="false">
          <span class="iw-cmp-label iw-cmp-label--r" style="display:flex;align-items:center;">
             ${afterLabel || 'Result'}
             <a href="${afterUrl}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
          </span>
        </div>`;
      return;
    }

    if (this.compareLayout === 'side') {
      this.stage.innerHTML = `
        <div class="iw-side-view">
          <div class="iw-side">
            <div class="iw-side-label" style="display:flex;align-items:center;pointer-events:auto;">
               ${beforeLabel || 'Original'}
               <a href="${beforeUrl}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
            </div>
            <img src="${beforeUrl}" class="iw-side-img" draggable="false">
          </div>
          <div class="iw-divider"></div>
          <div class="iw-side">
            <div class="iw-side-label iw-side-label--blue" style="display:flex;align-items:center;pointer-events:auto;">
               ${afterLabel || 'Result'}
               <a href="${afterUrl}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
            </div>
            <img src="${afterUrl}" class="iw-side-img" draggable="false">
          </div>
        </div>`;
    } else {
      this.stage.innerHTML = `
        <div class="iw-cmp-wrap" id="iw-cmp-wrap">
          <img class="iw-cmp-img" id="iw-cmp-before" src="${beforeUrl}" draggable="false" style="clip-path:inset(0 50% 0 0)">
          <img class="iw-cmp-img" id="iw-cmp-after" src="${afterUrl}" draggable="false" style="clip-path:inset(0 0 0 50%)">
          <div class="iw-cmp-handle" id="iw-cmp-handle" style="left:50%">
            <div class="iw-cmp-handle-line"></div>
            <div class="iw-cmp-handle-knob"><span class="material-symbols-outlined" style="font-size:18px">swap_horiz</span></div>
          </div>
          <span class="iw-cmp-label iw-cmp-label--l" style="display:flex;align-items:center;pointer-events:auto;">
             ${beforeLabel || 'Original'}
             <a href="${beforeUrl}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
          </span>
          <span class="iw-cmp-label iw-cmp-label--r" style="display:flex;align-items:center;pointer-events:auto;">
             ${afterLabel || 'Result'}
             <a href="${afterUrl}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
          </span>
        </div>`;
        
      const wrap = this.stage.querySelector('#iw-cmp-wrap');
      const handle = this.stage.querySelector('#iw-cmp-handle');
      const beforeImg = this.stage.querySelector('#iw-cmp-before');
      const afterImg = this.stage.querySelector('#iw-cmp-after');
      
      const setPos = cx => {
        const rect = wrap.getBoundingClientRect();
        const pos = Math.max(0.01, Math.min(0.99, (cx - rect.left) / rect.width));
        const pct = (pos * 100).toFixed(1);
        handle.style.left = `${pct}%`;
        beforeImg.style.clipPath = `inset(0 ${(100 - pos * 100).toFixed(1)}% 0 0)`;
        afterImg.style.clipPath = `inset(0 0 0 ${pct}%)`;
      };
      
      handle.addEventListener('mousedown', e => { this.isDraggingLayout = true; e.preventDefault(); });
      window.addEventListener('mousemove', e => { if (this.isDraggingLayout) setPos(e.clientX); });
      window.addEventListener('mouseup', () => { this.isDraggingLayout = false; });
      handle.addEventListener('touchstart', e => { this.isDraggingLayout = true; e.preventDefault(); }, {passive:false});
      window.addEventListener('touchmove', e => { if(this.isDraggingLayout) setPos(e.touches[0].clientX); }, {passive:true});
      window.addEventListener('touchend', () => { this.isDraggingLayout = false; });
    }
  }

  renderCarousel() {
    if (this.files.length <= 1 || !this.options.allowFolder) {
      this.carousel.style.display = 'none';
      return;
    }
    this.carousel.style.display = 'flex';
    this.carousel.innerHTML = '';
    
    const limit = Math.min(this.files.length, 50);
    for (let i = 0; i < limit; i++) {
      const file = this.files[i];
      const thumb = document.createElement('img');
      thumb.className = `iw-thumb ${file === this.activeFile ? 'is-active' : ''}`;
      
      if (isVideoFile(file)) {
        // Extract a frame so the <img> thumbnail doesn't break on video files
        extractVideoFrame(file).then(canvas => {
          canvas.toBlob(b => { if (b) thumb.src = URL.createObjectURL(b); }, 'image/jpeg', 0.8);
        }).catch(() => { thumb.src = ''; });
      } else {
        const url = URL.createObjectURL(file);
        thumb.src = url;
        thumb.onload = () => URL.revokeObjectURL(url);
      }
      
      thumb.addEventListener('click', () => {
        this.activeFile = file;
        this.options.onFilesChange(this.files, this.activeFile);
        this.carousel.querySelectorAll('.iw-thumb').forEach(t => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
        this.triggerProcess(); // rebuild and re-render
      });
      
      this.carousel.appendChild(thumb);
    }
  }
}
