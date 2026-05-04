/**
 * GlobalLightbox
 * A unified, application-wide lightbox for viewing and comparing media.
 * Wraps ImageWorkspace for images, and standard HTML5 Video for video files.
 * Handles sidecar JSON metadata sidebar dynamically.
 */
export class GlobalLightbox {
  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'ic-global-lightbox';
    this.container.style.display = 'none';
    this.container.innerHTML = `
      <style>
        .ic-global-lightbox { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; }
        .ic-gl-bg { position: absolute; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); }
        .ic-gl-content { position: relative; z-index: 1; width: 95vw; height: 92vh; background: var(--ps-bg-surface); border: 1px solid var(--ps-border); border-radius: 12px; display: flex; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.6); }
        
        .ic-gl-main { flex: 1; position: relative; display: flex; flex-direction: column; overflow: hidden; }
        .ic-gl-sidebar { width: 320px; border-left: 1px solid var(--ps-border); background: var(--ps-surface); display: flex; flex-direction: column; transition: 0.3s transform; }
        .ic-gl-sidebar.is-collapsed { display: none; }
        
        .ic-gl-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--ps-border); background: var(--ps-bg); }
        .ic-gl-title { font-weight: 600; font-size: 14px; color: var(--ps-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px; }
        
        .ic-gl-controls { display: flex; gap: 8px; }
        .ic-gl-btn { background: none; border: none; color: var(--ps-text-muted); cursor: pointer; padding: 6px; border-radius: 4px; display: flex; align-items: center; transition: 0.2s; }
        .ic-gl-btn:hover { background: rgba(255,255,255,0.1); color: var(--ps-text); }
        
        .ic-gl-viewer { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; background: #000; min-height: 0; min-width: 0; }
        .ic-gl-viewer img, .ic-gl-viewer video { max-width: 100%; max-height: 100%; width: 100%; height: 100%; object-fit: contain; }
        
        .ic-gl-sidebar-header { padding: 12px 16px; border-bottom: 1px solid var(--ps-border); font-weight: 600; font-size: 13px; color: var(--ps-text); display: flex; justify-content: space-between; align-items: center; }
        .ic-gl-sidebar-content { flex: 1; padding: 16px; overflow-y: auto; font-size: 13px; color: var(--ps-text-muted); }
      </style>
      <div class="ic-gl-bg"></div>
      <div class="ic-gl-content">
        <div class="ic-gl-main">
          <div class="ic-gl-header">
            <div class="ic-gl-title">Lightbox</div>
            <div class="ic-gl-controls">
              <button class="ic-gl-btn ic-gl-btn-info" title="Toggle Metadata"><span class="material-symbols-outlined text-[18px]">info</span></button>
              <button class="ic-gl-btn ic-gl-btn-close" title="Close (Esc)"><span class="material-symbols-outlined text-[18px]">close</span></button>
            </div>
          </div>
          <div class="ic-gl-viewer"></div>
        </div>
        <div class="ic-gl-sidebar is-collapsed">
          <div class="ic-gl-sidebar-header">
            <span>Metadata & Sidecar JSON</span>
            <button class="ic-gl-btn ic-gl-btn-close-side"><span class="material-symbols-outlined text-[16px]">close</span></button>
          </div>
          <div class="ic-gl-sidebar-content">
            <!-- JSON Sidecar tree goes here -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    
    this.bg = this.container.querySelector('.ic-gl-bg');
    this.closeBtn = this.container.querySelector('.ic-gl-btn-close');
    this.infoBtn = this.container.querySelector('.ic-gl-btn-info');
    this.closeSideBtn = this.container.querySelector('.ic-gl-btn-close-side');
    this.sidebar = this.container.querySelector('.ic-gl-sidebar');
    this.viewer = this.container.querySelector('.ic-gl-viewer');
    this.title = this.container.querySelector('.ic-gl-title');
    this.sideContent = this.container.querySelector('.ic-gl-sidebar-content');

    this.bindEvents();
    
    this.entries = [];
    this.currentIndex = 0;
    this.currentBlobUrl = null;
  }

  bindEvents() {
    const close = () => this.hide();
    this.bg.addEventListener('click', close);
    this.closeBtn.addEventListener('click', close);
    
    this.infoBtn.addEventListener('click', () => {
      this.sidebar.classList.toggle('is-collapsed');
    });
    this.closeSideBtn.addEventListener('click', () => {
      this.sidebar.classList.add('is-collapsed');
    });

    document.addEventListener('keydown', (e) => {
      if (this.container.style.display !== 'none') {
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowRight') this.navigate(1);
        if (e.key === 'ArrowLeft') this.navigate(-1);
      }
    });
  }

  navigate(dir) {
    if (this.entries.length <= 1) return;
    let nextIdx = this.currentIndex + dir;
    if (nextIdx < 0) nextIdx = this.entries.length - 1;
    if (nextIdx >= this.entries.length) nextIdx = 0;
    this.show(this.entries, nextIdx);
  }

  /**
   * Show the lightbox with a set of entries
   * @param {Array} entries - [{ name, file, sidecar }]
   * @param {Number} startIndex 
   */
  async show(entries, startIndex = 0) {
    this.entries = entries;
    this.currentIndex = startIndex;
    const ent = this.entries[this.currentIndex];
    if (!ent) return;

    this.title.textContent = ent.name;
    this.container.style.display = 'flex';
    
    if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
    this.currentBlobUrl = URL.createObjectURL(ent.file);
    
    const ext = ent.name.toLowerCase().split('.').pop();
    const isVideo = ['mp4', 'webm', 'mov', 'avi'].includes(ext);
    const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext);
    const isZip = ['zip'].includes(ext);
    const isPptx = ['pptx'].includes(ext);
    const isJson = ['json'].includes(ext);

    if (isVideo) {
      this.viewer.innerHTML = `
        <video src="${this.currentBlobUrl}" controls style="max-width:100%; max-height:100%; object-fit:contain;"></video>
      `;
    } else if (isJson) {
      this.viewer.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%; width:100%; background:var(--ps-surface);">
          <div style="padding:16px; border-bottom:1px solid var(--ps-border); display:flex; align-items:center; justify-content:space-between;">
             <div style="display:flex; align-items:center; gap:8px;">
               <span class="material-symbols-outlined text-[24px] text-[var(--ps-orange)]">data_object</span>
               <h2 style="margin:0; font-size:16px; font-weight:600; color:var(--ps-text);">JSON Viewer</h2>
             </div>
             <div style="display:flex; gap:8px;">
                <button class="btn-secondary btn-sm" id="btn-json-expand-all">Expand All</button>
                <button class="btn-secondary btn-sm" id="btn-json-collapse-all">Collapse All</button>
             </div>
          </div>
          <div style="flex:1; overflow:auto; padding:16px; font-family:monospace; font-size:13px; color:var(--ps-text);" id="json-tree-container">
             <div class="spinner spinner--lg"></div>
          </div>
        </div>
      `;
      const escHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      try {
        const text = await ent.file.text();
        const obj = JSON.parse(text);
        
        const renderNode = (key, value, isLast) => {
          const type = Array.isArray(value) ? 'array' : typeof value;
          if (value === null) {
            return `<div style="padding-left: 20px;"><span style="color:var(--ps-blue);">${key !== null ? `"${key}": ` : ''}</span><span style="color:var(--ps-red);">null</span>${isLast ? '' : ','}</div>`;
          }
          if (type === 'object' || type === 'array') {
            const isArray = type === 'array';
            const openBracket = isArray ? '[' : '{';
            const closeBracket = isArray ? ']' : '}';
            const keys = Object.keys(value);
            if (keys.length === 0) {
              return `<div style="padding-left: 20px;"><span style="color:var(--ps-blue);">${key !== null ? `"${key}": ` : ''}</span>${openBracket}${closeBracket}${isLast ? '' : ','}</div>`;
            }
            let childHtml = keys.map((k, i) => renderNode(isArray ? null : k, value[k], i === keys.length - 1)).join('');
            return `
              <div style="padding-left: 20px;" class="json-node expanded">
                <div style="cursor:pointer; user-select:none; display:flex; align-items:flex-start;" class="json-toggle">
                  <span class="material-symbols-outlined" style="font-size:16px; margin-right:4px; margin-left:-20px; transition:transform 0.2s;">arrow_drop_down</span>
                  <span style="color:var(--ps-blue);">${key !== null ? `"${key}": ` : ''}</span><span>${openBracket}</span>
                </div>
                <div class="json-children">${childHtml}</div>
                <div>${closeBracket}${isLast ? '' : ','}</div>
              </div>
            `;
          }
          let valStr = String(value);
          let valColor = 'var(--ps-text)';
          if (type === 'string') { valStr = `"${value}"`; valColor = 'var(--ps-green)'; }
          else if (type === 'number') { valColor = 'var(--ps-orange)'; }
          else if (type === 'boolean') { valColor = 'var(--ps-purple)'; }
          
          return `<div style="padding-left: 20px;"><span style="color:var(--ps-blue);">${key !== null ? `"${key}": ` : ''}</span><span style="color:${valColor};">${escHtml(valStr)}</span>${isLast ? '' : ','}</div>`;
        };
        
        const container = this.viewer.querySelector('#json-tree-container');
        container.innerHTML = `<div style="margin-left:-20px;">${renderNode(null, obj, true)}</div>`;
        
        if (!document.getElementById('json-viewer-styles')) {
           const style = document.createElement('style');
           style.id = 'json-viewer-styles';
           style.innerHTML = `
             .json-node > .json-children { display: none; }
             .json-node.expanded > .json-children { display: block; }
             .json-node > .json-toggle > .material-symbols-outlined { transform: rotate(-90deg); }
             .json-node.expanded > .json-toggle > .material-symbols-outlined { transform: rotate(0deg); }
           `;
           document.head.appendChild(style);
        }
        
        container.querySelectorAll('.json-toggle').forEach(t => {
           t.addEventListener('click', (e) => {
              e.stopPropagation();
              t.parentElement.classList.toggle('expanded');
           });
        });
        
        this.viewer.querySelector('#btn-json-expand-all').addEventListener('click', () => {
           container.querySelectorAll('.json-node').forEach(n => n.classList.add('expanded'));
        });
        this.viewer.querySelector('#btn-json-collapse-all').addEventListener('click', () => {
           container.querySelectorAll('.json-node').forEach(n => n.classList.remove('expanded'));
        });
        
      } catch (e) {
        this.viewer.querySelector('#json-tree-container').innerHTML = `<div style="color:var(--ps-red);">Failed to parse JSON: ${e.message}</div>`;
      }
    } else if (isAudio) {
      this.viewer.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:var(--ps-surface);">
           <span class="material-symbols-outlined text-[64px] text-[var(--ps-blue)] mb-8">music_note</span>
           <audio src="${this.currentBlobUrl}" controls autoplay style="width: 80%; max-width: 600px;"></audio>
        </div>
      `;
    } else if (isPptx || isZip) {
      this.viewer.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100%; width:100%;">
          <div class="spinner spinner--lg"></div>
        </div>
      `;
      try {
        const JSZip = (await import('jszip')).default || (await import('jszip'));
        const zip = new JSZip();
        await zip.loadAsync(ent.file);
        
        if (isPptx) {
          let title = 'Unknown Title';
          let slides = 'Unknown';
          let creator = 'Unknown';
          
          if (zip.files['docProps/core.xml']) {
             const coreXml = await zip.files['docProps/core.xml'].async('string');
             const titleMatch = coreXml.match(/<dc:title>(.*?)<\/dc:title>/);
             if (titleMatch) title = titleMatch[1];
             const creatorMatch = coreXml.match(/<dc:creator>(.*?)<\/dc:creator>/);
             if (creatorMatch) creator = creatorMatch[1];
          }
          if (zip.files['docProps/app.xml']) {
             const appXml = await zip.files['docProps/app.xml'].async('string');
             const slidesMatch = appXml.match(/<Slides>(.*?)<\/Slides>/);
             if (slidesMatch) slides = slidesMatch[1];
          }
          
          this.viewer.innerHTML = `<div style="padding: 20px; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--ps-surface);">
            <span class="material-symbols-outlined text-[64px] text-[var(--ps-orange)] mb-4">presentation</span>
            <h2 style="margin-top:0; font-size:24px; font-weight:600; color:var(--ps-text); text-align:center;">${title}</h2>
            <div style="color: var(--ps-text-muted); font-size: 14px; margin-bottom: 8px;">Author: ${creator}</div>
            <div style="color: var(--ps-text-muted); font-size: 14px;">Slides: ${slides}</div>
          </div>`;
        } else {
          // ZIP file
          let filesHtml = '';
          let count = 0;
          zip.forEach((relativePath, zipEntry) => {
            if (count > 100) return; // Limit to 100
            filesHtml += `<div style="padding: 8px 12px; border-bottom: 1px solid var(--ps-border); display: flex; justify-content: space-between; font-family:monospace; font-size:12px;">
               <span style="color:var(--ps-text);">${zipEntry.name}</span>
               <span style="color: var(--ps-text-muted)">${zipEntry.dir ? 'Folder' : (zipEntry._data?.uncompressedSize || 0) + ' bytes'}</span>
            </div>`;
            count++;
          });
          this.viewer.innerHTML = `<div style="width: 100%; height: 100%; display:flex; flex-direction:column; background:var(--ps-surface);">
            <div style="padding:16px; border-bottom:1px solid var(--ps-border); display:flex; align-items:center; gap:8px;">
               <span class="material-symbols-outlined text-[24px] text-[var(--ps-blue)]">folder_zip</span>
               <h2 style="margin:0; font-size:16px; font-weight:600; color:var(--ps-text);">Archive Contents</h2>
            </div>
            <div style="flex:1; overflow-y:auto; padding:16px;">
               <div style="background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden;">
                  ${filesHtml}
                  ${Object.keys(zip.files).length > 100 ? `<div style="padding: 12px; text-align:center; color: var(--ps-text-muted); font-size:12px;">...and ${Object.keys(zip.files).length - 100} more items</div>` : ''}
               </div>
            </div>
          </div>`;
        }
      } catch (e) {
        this.viewer.innerHTML = `<div style="padding:20px; color:var(--ps-red);">Failed to parse archive: ${e.message}</div>`;
      }
    } else {
      this.viewer.innerHTML = `<img src="${this.currentBlobUrl}">`;
    }

    // Render Sidecar
    if (ent.sidecar) {
      this.infoBtn.style.display = 'flex';
      this.sideContent.innerHTML = `<pre style="white-space:pre-wrap; word-wrap:break-word;">${JSON.stringify(ent.sidecar, null, 2)}</pre>`;
    } else {
      this.sideContent.innerHTML = `<div class="text-center text-gray-500 mt-10">No sidecar metadata available.</div>`;
    }
  }

  hide() {
    this.container.style.display = 'none';
    this.viewer.innerHTML = '';
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
}

// Singleton export
export const globalLightbox = new GlobalLightbox();
