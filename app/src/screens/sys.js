import { getSettings, saveSettings } from '../utils/settings.js';
import { showToast } from '../main.js';
import { dbGet, dbPut } from '../data/db.js';

export async function render(container, hash) {
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

  container.innerHTML = `
    <div class="screen sys-screen" style="display:flex;flex-direction:column;height:100%;background:var(--ps-surface)">
      <div class="screen-header" style="flex-shrink:0;">
        <div class="flex items-center gap-2">
           <span class="material-symbols-outlined" style="color:var(--ps-blue)">settings</span>
           <div class="screen-title">Global Settings</div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-primary" id="settings-save">Save Configurations</button>
        </div>
      </div>
      
      <div style="padding: 24px; max-width:900px; margin:0 auto; width:100%; display:flex; flex-direction:column; gap:24px; overflow-y: auto;">
        
        <!-- Project Root Link -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Project Storage</h4>
          <div style="background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:8px;">
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

        <!-- License Tier -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">License Tier</h4>
          <div style="background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <select id="cfg-license" class="ic-input" style="max-width:200px;">
                <option value="Free" ${current.license === 'Free' || !current.license ? 'selected' : ''}>Free</option>
                <option value="Pro" ${current.license === 'Pro' ? 'selected' : ''}>Pro</option>
                <option value="Enterprise" ${current.license === 'Enterprise' ? 'selected' : ''}>Enterprise</option>
              </select>
              <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px;">Select your mock license tier to test UX variations for Premium dependencies.</span>
            </div>
          </div>
        </section>

        <!-- Smart Thumbnails -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Content-Aware Thumbnails</h4>
          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
            <input type="checkbox" id="cfg-smart-thumbs" ${current.thumbnails?.smart ? 'checked' : ''} style="margin-top:2px;" />
            <div style="display:flex; flex-direction:column;">
              <span style="font-size:13px; font-weight:500; color:var(--ps-text);">Crop recipe &amp; showcase covers around the subject</span>
              <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px; line-height:1.4;">
                Uses InSPyReNet saliency to detect the subject of each uploaded image and centre the thumbnail on it, instead of cropping to the image centre. Requires the AI model to be downloaded (see <code>#mdl</code>). Falls back to centre-crop silently when unavailable.
              </span>
            </div>
          </label>
          <div style="background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:8px;">
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
          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
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
          <div style="background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:10px;">
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

        <!-- Master Fonts -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; flex-direction:column;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Master Fonts</h4>
                <button class="btn-ghost" id="btn-add-font" style="font-size:11px; padding:2px 6px;"><span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">add</span>Add Font</button>
            </div>
            <span style="font-size:11px; color:var(--ps-text-muted);">Manage fonts available for text styles and overlays.</span>
          </div>
          
          <div id="font-list" style="display:flex; flex-direction:column; gap:10px; background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border);">
          </div>
        </section>

        <!-- Text Styles -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; flex-direction:column;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Global Text Styles</h4>
                <button class="btn-ghost" id="btn-add-text-style" style="font-size:11px; padding:2px 6px;"><span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">add</span>Add Style</button>
            </div>
            <span style="font-size:11px; color:var(--ps-text-muted);">Define reusable typography configurations for your recipes.</span>
          </div>
          
          <div id="text-style-list" style="display:flex; flex-direction:column; gap:10px;">
          </div>
        </section>

        <!-- Custom Color Swatches -->
        <section style="display:flex; flex-direction:column; gap:12px; margin-bottom: 32px;">
          <div style="display:flex; flex-direction:column;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Application Color Swatches</h4>
                <button class="btn-ghost" id="btn-add-swatch" style="font-size:11px; padding:2px 6px;"><span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">add</span>Add Swatch</button>
            </div>
            <span style="font-size:11px; color:var(--ps-text-muted);">Manage standard colors available in the parameter configurator panels.</span>
          </div>
          
          <div id="swatch-list" style="display:flex; flex-direction:column; gap:10px; background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border);">
          </div>

        </section>
        
      </div>
    </div>
  `;

  const swatchList = container.querySelector('#swatch-list');
  const textStyleList = container.querySelector('#text-style-list');
  const fontList = container.querySelector('#font-list');
  const textStyles = current.textStyles || [];
  const masterFonts = current.masterFonts || [];

  const renderMasterFonts = () => {
    fontList.innerHTML = masterFonts.map((mf, idx) => `
      <div class="mf-row" data-idx="${idx}" style="display:flex; align-items:center; gap:8px;">
        <input type="text" class="ic-input mf-label" value="${mf.label}" placeholder="Display Name (e.g. Primary)" style="flex:1;" />
        <input type="text" class="ic-input mf-value" value="${(mf.value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" placeholder="Font Family (e.g. Inter)" style="flex:1;" />
        <button class="btn-icon btn-remove-mf" title="Remove Font" style="color:var(--ps-red); width:28px; height:28px;">
            <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
        </button>
      </div>
    `).join('');
    
    if (masterFonts.length === 0) {
        fontList.innerHTML = '<span style="font-size:11px; color:var(--ps-text-faint);">No fonts configured. Click Add Font to create one.</span>';
    }

    container.querySelectorAll('.btn-remove-mf').forEach(btn => {
      btn.onclick = (e) => {
          const idx = parseInt(e.currentTarget.closest('.mf-row').dataset.idx);
          masterFonts.splice(idx, 1);
          renderMasterFonts();
          renderTextStyles();
      };
    });
    
    container.querySelectorAll('.mf-label').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.mf-row').dataset.idx);
           masterFonts[idx].label = e.target.value;
           renderTextStyles();
       };
    });

    container.querySelectorAll('.mf-value').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.mf-row').dataset.idx);
           masterFonts[idx].value = e.target.value;
       };
    });
  };

  renderMasterFonts();

  container.querySelector('#btn-add-font').onclick = () => {
      masterFonts.push({ id: 'font-' + Math.random().toString(36).substr(2, 9), label: 'New Font', value: 'sans-serif' });
      renderMasterFonts();
      renderTextStyles();
  };

  const renderTextStyles = () => {
    textStyleList.innerHTML = textStyles.map((ts, idx) => `
      <div class="ts-row" data-idx="${idx}" style="display:flex; flex-direction:column; gap:8px; padding:12px; border:1px solid var(--ps-border); border-radius:8px; background:var(--ps-bg-app);">
         <div style="display:flex; align-items:center; gap:8px;">
            <input type="text" class="ic-input ts-name" value="${ts.name || ''}" placeholder="Style Name" style="font-weight:600; flex:1; font-size:13px;" />
            <button class="btn-icon btn-remove-ts" title="Remove Style" style="color:var(--ps-red); width:28px; height:28px;"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button>
         </div>
         <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <select class="ic-input ts-font" title="Font Family" style="width:100%; min-width:0;">
                ${masterFonts.map(mf => `<option value="${(mf.value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" ${ts.fontFamily === mf.value ? 'selected' : ''}>${mf.label}</option>`).join('')}
                ${!masterFonts.find(mf => mf.value === ts.fontFamily) && ts.fontFamily ? `<option value="${(ts.fontFamily || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" selected>${ts.fontFamily} (Custom)</option>` : ''}
            </select>
            <div style="display:flex; gap:4px;">
               <input type="number" class="ic-input ts-size" value="${ts.size || 32}" placeholder="Size" style="flex:1; width:0;" />
               <select class="ic-input ts-size-mode" style="flex:1; width:0;">
                   <option value="px" ${ts.sizeMode==='px'?'selected':''}>px</option>
                   <option value="pct-width" ${ts.sizeMode==='pct-width'?'selected':''}>% W</option>
                   <option value="pct-height" ${ts.sizeMode==='pct-height'?'selected':''}>% H</option>
               </select>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
               <input type="color" class="ts-color" value="${ts.color || '#ffffff'}" style="width:28px; height:28px; padding:0; border:1px solid var(--ps-border); border-radius:4px; cursor:pointer;" title="Text Color" />
               <select class="ic-input ts-weight" style="flex:1; width:0;">
                   <option value="300" ${ts.weight==='300'?'selected':''}>Light</option>
                   <option value="400" ${ts.weight==='400'?'selected':''}>Normal</option>
                   <option value="700" ${ts.weight==='700'?'selected':''}>Bold</option>
               </select>
            </div>
            <div style="display:flex; align-items:center; gap:4px; padding-left:4px;">
                <label style="display:flex; align-items:center; gap:4px; font-size:11px; color:var(--ps-text-muted); cursor:pointer;">
                  <input type="checkbox" class="ts-shadow" ${ts.shadow?'checked':''} style="margin:0;" /> Shadow
                </label>
                <input type="text" class="ic-input ts-shadow-color" value="${ts.shadowColor || 'rgba(0,0,0,0.8)'}" style="flex:1; width:0; font-family:monospace; font-size:11px;" title="Shadow Color (can be rgba)"/>
            </div>
            <select class="ic-input ts-bg-box">
                <option value="none" ${ts.bgBox==='none'?'selected':''}>No Background</option>
                <option value="wrap" ${ts.bgBox==='wrap'?'selected':''}>Wrap Text</option>
                <option value="full-width" ${ts.bgBox==='full-width'?'selected':''}>Full Width</option>
            </select>
            <div style="display:flex; align-items:center; gap:4px;">
                <input type="color" class="ts-bg-color" value="${ts.bgColor || '#000000'}" style="width:28px; height:28px; padding:0; border:1px solid var(--ps-border); border-radius:4px; cursor:pointer;" title="Background Color"/>
                <input type="number" class="ic-input ts-bg-opacity" value="${ts.bgOpacity ?? 60}" min="0" max="100" placeholder="Op %" title="Opacity %" style="flex:1; width:0;" />
                <input type="number" class="ic-input ts-bg-padding" value="${ts.bgPadding ?? 8}" placeholder="Pad" title="Padding px" style="flex:1; width:0;" />
            </div>
         </div>
      </div>
    `).join('');
    
    if (textStyles.length === 0) {
        textStyleList.innerHTML = '<span style="font-size:11px; color:var(--ps-text-faint);">No text styles configured. Click Add Style to create one.</span>';
    }

    container.querySelectorAll('.btn-remove-ts').forEach(btn => {
      btn.onclick = (e) => {
          const idx = parseInt(e.currentTarget.closest('.ts-row').dataset.idx);
          textStyles.splice(idx, 1);
          renderTextStyles();
      };
    });

    const bindUpdate = (selector, key, isCheckbox = false, isNumeric = false) => {
        container.querySelectorAll(selector).forEach(el => {
            el.onchange = (e) => {
                const idx = parseInt(e.currentTarget.closest('.ts-row').dataset.idx);
                let val = isCheckbox ? e.target.checked : e.target.value;
                if (isNumeric) val = parseFloat(val);
                textStyles[idx][key] = val;
            };
        });
    };

    bindUpdate('.ts-name', 'name');
    bindUpdate('.ts-font', 'fontFamily');
    bindUpdate('.ts-size', 'size', false, true);
    bindUpdate('.ts-size-mode', 'sizeMode');
    bindUpdate('.ts-color', 'color');
    bindUpdate('.ts-weight', 'weight');
    bindUpdate('.ts-shadow', 'shadow', true);
    bindUpdate('.ts-shadow-color', 'shadowColor');
    bindUpdate('.ts-bg-box', 'bgBox');
    bindUpdate('.ts-bg-color', 'bgColor');
    bindUpdate('.ts-bg-opacity', 'bgOpacity', false, true);
    bindUpdate('.ts-bg-padding', 'bgPadding', false, true);
  };
  
  renderTextStyles();

  container.querySelector('#btn-add-text-style').onclick = () => {
      textStyles.push({
          id: 'style-' + Math.random().toString(36).substr(2, 9),
          name: 'New Style', fontFamily: 'Inter', sizeMode: 'px', size: 32,
          color: '#ffffff', weight: '400', shadow: true, shadowColor: 'rgba(0,0,0,0.8)',
          bgBox: 'none', bgColor: '#000000', bgOpacity: 60, bgPadding: 8
      });
      renderTextStyles();
  };

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

    container.querySelectorAll('.btn-remove-swatch').forEach(btn => {
      btn.onclick = (e) => {
          const idx = parseInt(e.currentTarget.closest('.swatch-row').dataset.idx);
          palette.splice(idx, 1);
          renderSwatches();
      };
    });
    
    container.querySelectorAll('.swatch-color').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.swatch-row').dataset.idx);
           palette[idx].color = e.target.value;
       };
    });

    container.querySelectorAll('.swatch-label').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.swatch-row').dataset.idx);
           palette[idx].label = e.target.value;
       };
    });
  };

  renderSwatches();

  container.querySelector('#btn-link-project').onclick = async (e) => {
    try {
      const handle = await window.showDirectoryPicker();
      if (handle) {
        await dbPut('folders', { key: 'project_root', handle });
        projectRootHandle = handle;
        container.querySelector('#project-root-status').innerHTML = `<span style="color:var(--ps-green); display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Linked to: ${handle.name}</span>`;
        e.target.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">folder_shared</span> Change Link';
        showToast({ variant: 'success', title: 'Project Linked', description: `Thumbnails will now be saved to ${handle.name}/samples.` });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast({ variant: 'error', title: 'Linking failed', description: err.message });
      }
    }
  };

  container.querySelector('#btn-rebuild-thumbs').onclick = async (e) => {
    const btn    = e.currentTarget;
    const status = container.querySelector('#rebuild-thumbs-status');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">hourglass_top</span> Working…';
    try {
      const { generateSmartThumbnail, dataUrlToBlob } = await import('../utils/thumbnails.js');
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
      showToast({ variant: 'error', title: 'Rebuild failed', description: err.message || String(err) });
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">refresh</span> Rebuild';
    }
  };

  // AI endpoint test
  container.querySelector('#btn-test-ai-endpoint').onclick = async (e) => {
    const btn    = e.currentTarget;
    const result = container.querySelector('#ai-endpoint-test-result');
    const url    = container.querySelector('#cfg-ai-endpoint').value.trim();
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

  container.querySelector('#btn-add-swatch').onclick = () => {
      palette.push({ label: 'New Color', color: '#ff0000' });
      renderSwatches();
  };

  container.querySelector('#cfg-license').addEventListener('change', (e) => {
    saveSettings({ license: e.target.value });
    window.location.reload();
  });

  container.querySelector('#settings-save').onclick = () => {
    const nextPalette = [];
    swatchList.querySelectorAll('.swatch-row').forEach(row => {
       nextPalette.push({
           color: row.querySelector('.swatch-color').value,
           label: row.querySelector('.swatch-label').value.trim() || 'Untitled'
       });
    });

    saveSettings({
      license: container.querySelector('#cfg-license').value,
      batch: {
        useInputForOutput: container.querySelector('#cfg-batch-sync').checked
      },
      thumbnails: {
        smart: container.querySelector('#cfg-smart-thumbs').checked
      },
      ai: {
        describerEndpoint: container.querySelector('#cfg-ai-endpoint').value.trim()
      },
      palette: nextPalette,
      textStyles: textStyles,
      masterFonts: masterFonts
    });

    showToast({ variant: 'success', title: 'Settings Saved', description: 'Preferences applied globally.' });
  };
}
