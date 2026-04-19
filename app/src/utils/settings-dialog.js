import { getSettings, saveSettings } from './settings.js';
import { showToast } from '../aurora/toast.js';
import { dbGet, dbPut } from '../data/db.js';

export async function showSettingsModal() {
  const current = getSettings();
  const palette = current.palette || [];
  
  // Fetch existing project root handle
  let projectRootHandle = null;
  try {
    const rootRecord = await dbGet('folders', 'project_root');
    if (rootRecord) projectRootHandle = rootRecord.handle;
  } catch (err) {
    console.warn('Failed to fetch project root handle', err);
  }
  
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
        
        <!-- Project Root Link -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Project Storage</h4>
          <div style="background:var(--ps-bg-overlay); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; flex-direction:column;">
                <span style="font-size:13px; font-weight:500; color:var(--ps-text);">Project Root Directory</span>
                <span id="project-root-status" style="font-size:11px; color:var(--ps-text-muted); margin-top:2px;">
                  ${projectRootHandle ? `<span style="color:var(--ps-green); display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Linked to: ${projectRootHandle.name}</span>` : 'Not linked. Thumbnails will use base64 fallback.'}
                </span>
              </div>
              <button class="btn-secondary" id="btn-link-project" style="font-size:11px; padding:6px 12px;">
                <span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">folder_shared</span>
                ${projectRootHandle ? 'Change Link' : 'Link Project Folder'}
              </button>
            </div>
            <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.4;">
              Linking the project root allows the app to save recipe thumbnails directly into the <code>samples/</code> and <code>user-samples/</code> folders for persistence.
            </p>
          </div>
        </section>

        <!-- Smart Thumbnails -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Content-Aware Thumbnails</h4>
          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:var(--ps-bg-overlay); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
            <input type="checkbox" id="cfg-smart-thumbs" ${current.thumbnails?.smart ? 'checked' : ''} style="margin-top:2px;" />
            <div style="display:flex; flex-direction:column;">
              <span style="font-size:13px; font-weight:500; color:var(--ps-text);">Crop recipe &amp; showcase covers around the subject</span>
              <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px; line-height:1.4;">
                Uses InSPyReNet saliency to detect the subject of each uploaded image and centre the thumbnail on it, instead of cropping to the image centre. Requires the AI model to be downloaded (see <code>#mdl</code>). Falls back to centre-crop silently when unavailable.
              </span>
            </div>
          </label>
          <div style="background:var(--ps-bg-overlay); padding:12px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div style="display:flex; flex-direction:column;">
                <span style="font-size:13px; font-weight:500; color:var(--ps-text);">Rebuild existing thumbnails</span>
                <span id="rebuild-thumbs-status" style="font-size:11px; color:var(--ps-text-muted); margin-top:2px;">One-off pass that re-crops all existing recipe and showcase thumbnails using the smart crop.</span>
              </div>
              <button class="btn-secondary" id="btn-rebuild-thumbs" style="font-size:11px; padding:6px 12px; flex-shrink:0;">
                <span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">refresh</span>
                Rebuild
              </button>
            </div>
          </div>
        </section>

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

        <!-- AI Integration -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">AI Integration</h4>
          <div style="background:var(--ps-bg-overlay); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label for="cfg-ai-endpoint" style="font-size:13px; font-weight:500; color:var(--ps-text);">AI Image Describer Endpoint</label>
              <input type="url" id="cfg-ai-endpoint" class="ic-input"
                value="${current.ai?.describerEndpoint || ''}"
                placeholder="https://your-server.example.com/describe"
                style="font-size:12px; font-family:var(--font-mono);"
              />
            </div>
            <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.5;">
              When set, a <strong>Describe Image with AI</strong> button appears in the metadata panel.
              The endpoint receives a <code>multipart/form-data</code> POST with an <code>image</code>
              file field and a <code>filename</code> text field. It must return JSON matching the
              Pic-Machina sidecar schema (full sidecar or a raw analysis object). The response is
              merged into the image sidecar without overwriting your annotations.
            </p>
            <div style="display:flex; align-items:center; gap:8px;">
              <button class="btn-secondary" id="btn-test-ai-endpoint" style="font-size:11px; padding:5px 12px;">
                <span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">electric_bolt</span>
                Test connection
              </button>
              <span id="ai-endpoint-test-result" style="font-size:11px; color:var(--ps-text-faint);"></span>
            </div>
          </div>
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

  modal.querySelector('#btn-link-project').onclick = async (e) => {
    try {
      const handle = await window.showDirectoryPicker();
      if (handle) {
        await dbPut('folders', { key: 'project_root', handle });
        projectRootHandle = handle;
        modal.querySelector('#project-root-status').innerHTML = `<span style="color:var(--ps-green); display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Linked to: ${handle.name}</span>`;
        e.target.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">folder_shared</span> Change Link';
        showToast({ variant: 'success', title: 'Project Linked', description: `Thumbnails will now be saved to ${handle.name}/samples.` });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast({ variant: 'danger', title: 'Linking failed', description: err.message });
      }
    }
  };

  modal.querySelector('#btn-rebuild-thumbs').onclick = async (e) => {
    const btn    = e.currentTarget;
    const status = modal.querySelector('#rebuild-thumbs-status');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">hourglass_top</span> Working…';
    try {
      const { generateSmartThumbnail, dataUrlToBlob } = await import('./thumbnails.js');
      const { isModelReady } = await import('../engine/ai/inspyrenet.js');
      if (!(await isModelReady())) {
        status.textContent = 'InSPyReNet model not downloaded — open #mdl to fetch it, then retry.';
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">refresh</span> Rebuild';
        return;
      }

      const { getAllRecipes, saveRecipe } = await import('../data/recipes.js');
      const { getAllShowcases, saveShowcase } = await import('../data/showcases.js');

      const recipes = (await getAllRecipes()).filter(r => !!r.thumbnail);
      const showcases = (await getAllShowcases()).filter(s => !!s.thumbnail);
      const total = recipes.length + showcases.length;
      let done = 0, skipped = 0;

      status.textContent = `0 / ${total}…`;

      for (const recipe of recipes) {
        try {
          const blob = await dataUrlToBlob(recipe.thumbnail);
          const smart = await generateSmartThumbnail(blob, { width: 480, height: 300 });
          if (smart) { recipe.thumbnail = smart.dataUrl; await saveRecipe(recipe); }
          else skipped++;
        } catch (err) { console.warn('rebuild recipe thumb failed', err); skipped++; }
        done++;
        status.textContent = `${done} / ${total}…`;
      }

      for (const entry of showcases) {
        try {
          const blob = await dataUrlToBlob(entry.thumbnail);
          const smart = await generateSmartThumbnail(blob, { width: 640, height: 400 });
          if (smart) { entry.thumbnail = smart.dataUrl; await saveShowcase(entry); }
          else skipped++;
        } catch (err) { console.warn('rebuild showcase thumb failed', err); skipped++; }
        done++;
        status.textContent = `${done} / ${total}…`;
      }

      const success = total - skipped;
      status.textContent = `Done — ${success} updated, ${skipped} skipped (no subject / error).`;
      showToast({ variant: 'success', title: 'Thumbnails rebuilt', description: `${success} updated, ${skipped} skipped.` });
    } catch (err) {
      console.error(err);
      status.textContent = `Failed: ${err.message || err}`;
      showToast({ variant: 'danger', title: 'Rebuild failed', description: err.message || String(err) });
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">refresh</span> Rebuild';
    }
  };

  // AI endpoint test
  modal.querySelector('#btn-test-ai-endpoint').onclick = async (e) => {
    const btn    = e.currentTarget;
    const result = modal.querySelector('#ai-endpoint-test-result');
    const url    = modal.querySelector('#cfg-ai-endpoint').value.trim();
    if (!url) { result.textContent = 'No URL entered.'; result.style.color = 'var(--ps-text-faint)'; return; }
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">hourglass_empty</span>Testing…';
    result.textContent = '';
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      result.textContent = `✓ Reachable (HTTP ${resp.status})`;
      result.style.color = 'var(--ps-green, #22c55e)';
    } catch (err) {
      result.textContent = `✗ ${err.message || 'Unreachable'}`;
      result.style.color = 'var(--ps-red, #f87171)';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">electric_bolt</span>Test connection';
    }
  };

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
      thumbnails: {
        smart: modal.querySelector('#cfg-smart-thumbs').checked
      },
      ai: {
        describerEndpoint: modal.querySelector('#cfg-ai-endpoint').value.trim()
      },
      palette: nextPalette
    });

    showToast({ variant: 'success', title: 'Settings Saved', description: 'Preferences applied globally.' });
    destroy();
  };
}
