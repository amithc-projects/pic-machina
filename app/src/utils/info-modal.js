import { getImageInfo, renderImageInfoPanel } from './image-info.js';

export function renderFileInfoModal(beforeFileOrBlob, afterUrlOrBlob) {
    let modal = document.getElementById('ic-info-modal');
    if (modal) modal.remove();
    modal = document.createElement('dialog');
    modal.id = 'ic-info-modal';
    modal.className = 'modal';
    modal.style.cssText = 'width:800px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;padding:0;border-radius:14px;border:1px solid var(--ps-border);background:var(--ps-bg-surface)';
    modal.innerHTML = `
      <div class="modal__header" style="padding:12px 16px;border-bottom:1px solid var(--ps-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span style="font-size:14px;font-weight:600;color:var(--ps-text)">Image Info Comparison</span>
        <button class="btn-icon" id="info-modal-close"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div id="info-modal-body" style="flex:1;overflow-y:auto;padding:0;display:flex;">
        <div style="flex:1;padding:16px;border-right:1px solid var(--ps-border)">
           <div style="font-weight:600;margin-bottom:12px;color:var(--ps-text-muted)">Before</div>
           <div id="info-modal-before"><div class="spinner"></div></div>
        </div>
        <div style="flex:1;padding:16px;">
           <div style="font-weight:600;margin-bottom:12px;color:var(--ps-blue)">After</div>
           <div id="info-modal-after"><div class="spinner"></div></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.showModal();
    modal.querySelector('#info-modal-close')?.addEventListener('click', () => modal.close());
    modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

    getImageInfo(beforeFileOrBlob).then(info => {
      const body = modal.querySelector('#info-modal-before');
      if (body) { body.innerHTML = ''; body.appendChild(renderImageInfoPanel(info)); }
    }).catch(e => {
      const body = modal.querySelector('#info-modal-before');
      if (body) body.innerHTML = `<div class="text-sm text-muted">Error reading before file</div>`;
    });
    
    if (afterUrlOrBlob) {
      let p = Promise.resolve(afterUrlOrBlob);
      if (typeof afterUrlOrBlob === 'string') {
          p = fetch(afterUrlOrBlob).then(r => r.blob());
      }
      p.then(blob => getImageInfo(blob)).then(info => {
        const body = modal.querySelector('#info-modal-after');
        if (body) { body.innerHTML = ''; body.appendChild(renderImageInfoPanel(info)); }
      }).catch(e => {
        const body = modal.querySelector('#info-modal-after');
        if (body) body.innerHTML = `<div class="text-sm text-muted">Error reading after file</div>`;
      });
    } else {
      const body = modal.querySelector('#info-modal-after');
      if (body) body.innerHTML = '<div class="text-sm text-muted">Preview not yet generated</div>';
    }
}
