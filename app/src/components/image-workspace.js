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
    // Auto-load the current shared folder if no files have been set yet
    if (this.options.allowFolder && this.files.length === 0) {
      this.loadCurrentFolder(this.options.fileFilter || {});
    }
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
              <div class="iw-zoom-controls" style="display:flex;align-items:center;background:var(--ps-bg);border-radius:4px;padding:2px">
                <button class="btn-icon iw-zoom-out-btn" title="Zoom Out" style="width:24px;height:24px"><span class="material-symbols-outlined text-[16px]">remove</span></button>
                <button class="btn-icon iw-zoom-fit-btn" title="Fit to Screen" style="padding:0 8px;font-size:12px;height:24px;min-width:40px;width:auto;border-radius:3px">Fit</button>
                <button class="btn-icon iw-zoom-in-btn" title="Zoom In" style="width:24px;height:24px"><span class="material-symbols-outlined text-[16px]">add</span></button>
              </div>
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
                <div style="display:flex;gap:0">
                  <button class="btn-secondary iw-folder-btn" title="Select a test folder" style="border-radius:6px 0 0 6px;border-right:none">
                    <span class="material-symbols-outlined" style="font-size:14px">folder_open</span>
                    Folder
                  </button>
                  <select class="btn-secondary iw-folder-mru" title="Recent folders" style="border-radius:0 6px 6px 0;padding:0 6px;min-width:28px;cursor:pointer">
                    <option value="">▾</option>
                  </select>
                </div>
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
          .iw-cmp-img-clip { position:absolute;inset:0;width:100%;height:100%; }
          .iw-cmp-img { position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;pointer-events:none; }
          .iw-cmp-handle { position:absolute;top:0;bottom:0;width:20px;margin-left:-10px;cursor:col-resize;display:flex;align-items:center;justify-content:center;z-index:10; }
          .iw-cmp-handle-line { position:absolute;top:0;bottom:0;left:9px;width:2px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,0.5); }
          .iw-cmp-handle-knob { position:relative;width:28px;height:28px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);color:#333; }
          .iw-cmp-label { position:absolute;top:10px;padding:4px 8px;background:rgba(0,0,0,0.6);color:#fff;border-radius:4px;font-size:11px;font-weight:500;z-index:5;pointer-events:none;backdrop-filter:blur(4px); }
          .iw-cmp-label--l { left:10px; }
          .iw-cmp-label--r { right:10px; }
          
          .iw-side-view { display:flex;width:100%;height:100%;overflow:hidden; }
          .iw-side { flex:1;position:relative;min-width:0;display:flex;align-items:center;justify-content:center;overflow:hidden; }
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
    // Zoom is always enabled
    this.container.querySelector('.iw-zoom-btn')?.remove();

    // Pan and Zoom
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    const updateTransform = (smooth = false) => {
      const imgs = this.stage.querySelectorAll('.iw-cmp-img, .iw-side-img, .iw-single-img');
      imgs.forEach(img => {
        img.style.transformOrigin = '0 0';
        img.style.transition = smooth ? 'transform 0.2s ease-out' : 'none';
        img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      });
    };

    this.resetZoom = () => {
      scale = 1; tx = 0; ty = 0;
      updateTransform(true);
    };

    const applyZoom = (zoomFactor, ox, oy, smooth = false) => {
      const rect = this.stage.getBoundingClientRect();
      ox = ox ?? rect.width / 2;
      oy = oy ?? rect.height / 2;
      
      const oldScale = scale;
      scale *= zoomFactor;
      scale = Math.max(1, Math.min(scale, 20));
      
      const actualFactor = scale / oldScale;
      tx = ox - (ox - tx) * actualFactor;
      ty = oy - (oy - ty) * actualFactor;
      
      tx = Math.min(0, Math.max(tx, rect.width - rect.width * scale));
      ty = Math.min(0, Math.max(ty, rect.height - rect.height * scale));
      
      updateTransform(smooth);
    };

    this.container.querySelector('.iw-zoom-in-btn')?.addEventListener('click', () => applyZoom(1.2, null, null, true));
    this.container.querySelector('.iw-zoom-out-btn')?.addEventListener('click', () => applyZoom(1/1.2, null, null, true));
    this.container.querySelector('.iw-zoom-fit-btn')?.addEventListener('click', this.resetZoom);

    this.stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.stage.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      applyZoom(zoomFactor, ox, oy, false);
    });

    this.stage.addEventListener('mousedown', (e) => {
      if (scale === 1) return;
      if (e.target.closest('.iw-slider-divider, .iw-cmp-handle')) return;
      isPanning = true;
      startX = e.clientX - tx;
      startY = e.clientY - ty;
      this.stage.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      tx = e.clientX - startX;
      ty = e.clientY - startY;
      
      const rect = this.stage.getBoundingClientRect();
      tx = Math.min(0, Math.max(tx, rect.width - rect.width * scale));
      ty = Math.min(0, Math.max(ty, rect.height - rect.height * scale));
      
      updateTransform(false);
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        this.stage.style.cursor = '';
      }
    });

    // Double click to toggle fullscreen
    this.stage.addEventListener('dblclick', (e) => {
      // Don't trigger fullscreen if clicking buttons or inputs
      if (e.target.closest('button, input, .iw-slider-divider, .iw-cmp-handle')) return;
      if (!document.fullscreenElement) {
         // Apply a background color to the container while in fullscreen
         this.container.style.backgroundColor = 'var(--ps-bg-surface)';
         this.container.requestFullscreen().catch(() => {});
      } else {
         document.exitFullscreen();
      }
    });
    
    // Clean up background color on exit fullscreen
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        this.container.style.backgroundColor = '';
      }
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
        const { pickFolder, listImages, loadVideoPreviews } = await import('../data/folders.js');
        const { dbSaveFolderHistory } = await import('../data/db.js');
        const handle = await pickFolder('input');
        await dbSaveFolderHistory('input', handle);
        this.currentDirHandle = handle;
        this.videoPreviews = await loadVideoPreviews(handle).catch(() => new Map());
        const files = await listImages(handle, this.options.fileFilter || {});
        this.loadFiles(files);
        this._loadFolderMRU();
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    });

    this.container.querySelector('.iw-folder-mru')?.addEventListener('change', async e => {
      const idx = parseInt(e.target.value);
      if (isNaN(idx)) return;
      e.target.value = '';
      try {
        const { dbGetFolderHistory, dbSaveFolderHistory } = await import('../data/db.js');
        const { setCurrentFolder, listImages, loadVideoPreviews } = await import('../data/folders.js');
        const history = await dbGetFolderHistory('input');
        const handle = history[idx];
        if (!handle) return;
        if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
          if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return;
        }
        await setCurrentFolder(handle);
        await dbSaveFolderHistory('input', handle);
        this.currentDirHandle = handle;
        this.videoPreviews = await loadVideoPreviews(handle).catch(() => new Map());
        const files = await listImages(handle, this.options.fileFilter || {});
        this.loadFiles(files);
        this._loadFolderMRU();
      } catch (err) {
        console.error(err);
      }
    });

    this._loadFolderMRU();
  }

  updateLayoutToggleUI() {
    this.container.querySelector('.iw-layout-single')?.classList.toggle('is-active', !this.compareMode);
    this.container.querySelector('.iw-layout-slider')?.classList.toggle('is-active', this.compareMode && this.compareLayout === 'slider');
    this.container.querySelector('.iw-layout-side')?.classList.toggle('is-active', this.compareMode && this.compareLayout === 'side');
    this.container.querySelector('.ic-image-workspace')?.classList.toggle('is-single-mode', !this.compareMode);
  }

  async loadCurrentFolder(fileFilter = {}) {
    try {
      const { getFolder, listImages, loadVideoPreviews } = await import('../data/folders.js');
      const handle = await getFolder('input');
      if (!handle) return;
      this.currentDirHandle = handle;
      this.videoPreviews = await loadVideoPreviews(handle).catch(() => new Map());
      const files = await listImages(handle, fileFilter);
      this.loadFiles(files);
    } catch { /* ignore — no folder set or permission denied */ }
  }

  async _loadFolderMRU() {
    const select = this.container.querySelector('.iw-folder-mru');
    if (!select) return;
    try {
      const { dbGetFolderHistory } = await import('../data/db.js');
      const history = await dbGetFolderHistory('input');
      if (!history.length) { select.style.display = 'none'; return; }
      select.style.display = '';
      select.innerHTML = '<option value="">▾</option>' +
        history.map((h, i) => `<option value="${i}">${h.name}</option>`).join('');
    } catch { /* ignore */ }
  }

  resetZoom() {
    const imgs = this.stage.querySelectorAll('.iw-cmp-img, .iw-side-img, .iw-single-img');
    imgs.forEach(img => {
      img.style.transform = 'none';
      img.style.transition = 'transform 0.1s ease';
    });
  }

  loadFiles(filesArr) {
    this.files = filesArr || [];
    
    if (this.files.length === 0) {
      this.activeFile = null;
      this.stage.innerHTML = `
        <div class="empty-state" style="padding:24px;text-align:center;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
           <span class="material-symbols-outlined" style="font-size:36px;color:var(--ps-text-muted)">image</span>
           <div style="font-size:12px;margin-top:8px">No matching files in folder</div>
        </div>`;
      this.carousel.style.display = 'none';
      if (this.modeToggleGroup) this.modeToggleGroup.style.display = 'none';
      this.cmpControls.style.display = 'none';
      this.options.onFilesChange(this.files, this.activeFile);
      return;
    }

    if (this.activeFile) {
      const stillExists = this.files.find(f => f.name === this.activeFile.name);
      this.activeFile = stillExists || this.files[0];
    } else {
      this.activeFile = this.files[0];
    }
    
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
    
    // Cleanup previous object URLs to prevent memory leaks
    if (this.lastRenderResult) {
      if (this.lastRenderResult.beforeUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(this.lastRenderResult.beforeUrl);
      }
      if (this.lastRenderResult.afterUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(this.lastRenderResult.afterUrl);
      }
    }

    try {
      this.lastRenderResult = await this.options.onRender(this.activeFile);

      // Step does not support preview — show overlay instead of image
      if (this.lastRenderResult?.noPreview) {
        const reason = this.lastRenderResult.noPreviewReason || 'Preview is not available for this step.';
        this.stage.innerHTML = `
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
            background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);gap:10px;z-index:10;pointer-events:none;">
            <span class="material-symbols-outlined" style="font-size:36px;color:var(--ps-text-muted)">hide_image</span>
            <div style="font-size:13px;color:var(--ps-text-muted);text-align:center;max-width:260px;line-height:1.5;">${reason}</div>
          </div>`;
        if (this.modeToggleGroup) this.modeToggleGroup.style.display = 'none';
        this.cmpControls.style.display = 'none';
        return;
      }

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
    const { beforeUrl, afterUrl, beforeLabel, afterLabel, overlayWarning } = this.lastRenderResult;

    const effectiveCompareMode = this._tempCompareMode ?? this.compareMode;

    const overlayHtml = overlayWarning ? `
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%, -50%);background:rgba(0,0,0,0.7);color:var(--ps-text-muted);padding:8px 16px;border-radius:6px;font-size:13px;z-index:20;display:flex;align-items:center;gap:8px;pointer-events:none;backdrop-filter:blur(4px);white-space:nowrap;border:1px solid var(--ps-border);">
        <span class="material-symbols-outlined" style="font-size:16px">visibility_off</span>
        ${overlayWarning}
      </div>` : '';

    if (!effectiveCompareMode) {
      this.stage.innerHTML = `
        <div class="iw-single-wrap">
          <img src="${afterUrl}" class="iw-cmp-img" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;" draggable="false">
          ${overlayHtml}
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
            ${overlayHtml}
          </div>
        </div>`;
    } else {
      this.stage.innerHTML = `
        <div class="iw-cmp-wrap" id="iw-cmp-wrap">
          <div class="iw-cmp-img-clip" id="iw-cmp-before-wrap" style="clip-path:inset(0 50% 0 0)">
            <img class="iw-cmp-img" src="${beforeUrl}" draggable="false">
          </div>
          <div class="iw-cmp-img-clip" id="iw-cmp-after-wrap" style="clip-path:inset(0 0 0 50%)">
            <img class="iw-cmp-img" src="${afterUrl}" draggable="false">
          </div>
          ${overlayHtml}
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
      const beforeWrap = this.stage.querySelector('#iw-cmp-before-wrap');
      const afterWrap = this.stage.querySelector('#iw-cmp-after-wrap');
      
      const setPos = cx => {
        const rect = wrap.getBoundingClientRect();
        const pos = Math.max(0.01, Math.min(0.99, (cx - rect.left) / rect.width));
        const pct = (pos * 100).toFixed(1);
        handle.style.left = `${pct}%`;
        beforeWrap.style.clipPath = `inset(0 ${(100 - pos * 100).toFixed(1)}% 0 0)`;
        afterWrap.style.clipPath = `inset(0 0 0 ${pct}%)`;
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
        if (this.videoPreviews && this.videoPreviews.has(file.name)) {
          const url = URL.createObjectURL(this.videoPreviews.get(file.name));
          thumb.src = url;
          thumb.onload = () => URL.revokeObjectURL(url);
        } else {
          extractVideoFrame(file).then(canvas => {
            canvas.toBlob(b => { 
              if (b) {
                const url = URL.createObjectURL(b);
                thumb.src = url;
                thumb.onload = () => URL.revokeObjectURL(url);
                if (this.currentDirHandle && this.videoPreviews) {
                  this.videoPreviews.set(file.name, b);
                  import('../data/folders.js').then(({ writeVideoPreview }) => {
                    writeVideoPreview(this.currentDirHandle, file.name, b).catch(() => {});
                  });
                }
              }
            }, 'image/jpeg', 0.8);
          }).catch(() => { thumb.src = ''; });
        }
      } else {
        const url = URL.createObjectURL(file);
        thumb.src = url;
        thumb.onload = () => URL.revokeObjectURL(url);
      }
      
      const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const j = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, j)).toFixed(2)) + ' ' + sizes[j];
      };
      
      const modDate = file.lastModified ? new Date(file.lastModified).toLocaleString() : '';
      let tooltip = file.name;
      if (isVideoFile(file)) tooltip += '\nVideo';
      else tooltip += '\nImage';
      tooltip += `\nModified: ${modDate}\nSize: ${formatBytes(file.size)}`;
      thumb.title = tooltip;
      
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
