import { getSettings, saveSettings } from './settings.js';
import { showToast } from '../aurora/toast.js';

export function showSettingsModal() {
  const current = getSettings();
  const palette = current.palette || [];
  
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.75); backdrop-filter:blur(6px);';
  
  modal.innerHTML = `
    <div style="background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:12px; width:480px; max-width:95vw; box-shadow:0 10px 50px rgba(0,0,0,0.6); overflow:hidden; display:flex; flex-direction:column; animation:screenEnter 180ms ease-out forwards;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--ps-border); background:rgba(0,0,0,0.2);">
        <h3 style="margin:0; font-size:16px; font-weight:600; display:flex; align-items:center; gap:8px;">
          <span class="material-symbols-outlined" style="color:var(--ps-blue);">settings</span>
          Global Preferences
        </h3>
        <button class="btn-icon" id="settings-close" style="width:28px; height:28px;">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>
      
      <div style="padding: 24px; display:flex; flex-direction:column; gap:24px; background:var(--ps-bg-app); max-height: 70vh; overflow-y: auto;">
        
        <!-- Batch Core -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Batch Engine</h4>
          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:var(--ps-bg-overlay); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
            <input type="checkbox" id="cfg-batch-sync" ${current.batch?.useInputForOutput ? 'checked' : ''} style="margin-top:2px;" />
            <div style="display:flex; flex-direction:column;">
              <span style="font-size:13px; font-weight:500; color:var(--ps-text);">Default Output Folder to Input Source</span>
              <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px; line-height:1.4;">If enabled, you do not need to select an output destination. The system will automatically build outputs natively inside your input directory.</span>
            </div>
          </label>
        </section>

        <!-- Custom Color Swatches -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; flex-direction:column;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Application Color Swatches</h4>
                <button class="btn-ghost" id="btn-add-swatch" style="font-size:11px; padding:2px 6px;"><span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">add</span>Add Swatch</button>
            </div>
            <span style="font-size:11px; color:var(--ps-text-muted);">Manage standard colors available in the parameter configurator panels.</span>
          </div>
          
          <div id="swatch-list" style="display:flex; flex-direction:column; gap:10px; background:var(--ps-bg-overlay); padding:16px; border-radius:8px; border:1px solid var(--ps-border); max-height:220px; overflow-y:auto;">
          </div>

        </section>
        
      </div>
      
      <div style="padding:16px 24px; border-top:1px solid var(--ps-border); background:var(--ps-bg-surface); display:flex; justify-content:flex-end;">
        <button class="btn-primary" id="settings-save">Save Configurations</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);

  const swatchList = modal.querySelector('#swatch-list');

  const renderSwatches = () => {
    swatchList.innerHTML = palette.map((swatch, idx) => `
      <div class="swatch-row" data-idx="${idx}" style="display:flex; align-items:center; gap:8px;">
        <input type="color" class="swatch-color" value="${swatch.color}" style="width:32px; height:32px; padding:0; border:1px solid var(--ps-border); border-radius:4px; cursor:pointer;" />
        <input type="text" class="ic-input swatch-label" value="${swatch.label}" placeholder="Color Name" style="flex:1;" />
        <button class="btn-icon btn-remove-swatch" title="Remove" style="color:var(--ps-red); width:28px; height:28px;">
            <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
        </button>
      </div>
    `).join('');
    
    if (palette.length === 0) {
        swatchList.innerHTML = '<span style="font-size:11px; color:var(--ps-text-faint);">No swatches configured. Click Add Swatch to create one.</span>';
    }

    swatchList.querySelectorAll('.btn-remove-swatch').forEach(btn => {
      btn.onclick = (e) => {
          const idx = parseInt(e.currentTarget.closest('.swatch-row').dataset.idx);
          palette.splice(idx, 1);
          renderSwatches();
      };
    });
    
    swatchList.querySelectorAll('.swatch-color').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.swatch-row').dataset.idx);
           palette[idx].color = e.target.value;
       };
    });

    swatchList.querySelectorAll('.swatch-label').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.swatch-row').dataset.idx);
           palette[idx].label = e.target.value;
       };
    });
  };

  renderSwatches();

  modal.querySelector('#btn-add-swatch').onclick = () => {
      palette.push({ label: 'New Color', color: '#ff0000' });
      renderSwatches();
  };

  const destroy = () => modal.remove();

  modal.querySelector('#settings-close').onclick = destroy;
  
  modal.querySelector('#settings-save').onclick = () => {
    const nextPalette = [];
    swatchList.querySelectorAll('.swatch-row').forEach(row => {
       nextPalette.push({
           color: row.querySelector('.swatch-color').value,
           label: row.querySelector('.swatch-label').value.trim() || 'Untitled'
       });
    });

    saveSettings({
      batch: {
        useInputForOutput: modal.querySelector('#cfg-batch-sync').checked
      },
      palette: nextPalette
    });

    showToast({ variant: 'success', title: 'Settings Saved', description: 'Preferences applied globally.' });
    destroy();
  };
}
