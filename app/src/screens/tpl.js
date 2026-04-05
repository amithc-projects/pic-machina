/**
 * ImageChef — TPL: Template Editor
 *
 * Create and edit reusable perspective templates.
 */

import { getAllTemplates, getTemplate, saveTemplate, deleteTemplate, createEmptyTemplate } from '../data/templates.js';
import { navigate, showToast } from '../main.js';
import { uuid, now, formatDate } from '../utils/misc.js';
import { showConfirm } from '../utils/dialogs.js';

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Block list view ────────────────────────────────────────
async function renderList(container) {
  const templates = await getAllTemplates();

  const emptyUser = templates.length === 0 ? `
    <div class="empty-state" style="padding-top:60px">
      <span class="material-symbols-outlined" style="font-size:48px">wallpaper</span>
      <div class="empty-state-title">No templates yet</div>
      <div class="empty-state-desc">Create your first perspective template to composite videos or images.</div>
      <button class="btn-primary" id="tpl-empty-new">
        <span class="material-symbols-outlined">add</span>
        Create Template
      </button>
    </div>` : '';

  container.innerHTML = `
    <div class="screen tpl-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">wallpaper</span>
          Template Editor
        </div>
        <button class="btn-primary" id="tpl-btn-new">
          <span class="material-symbols-outlined">add</span>
          New Template
        </button>
      </div>

      <div class="tpl-list-body">
        <div class="tpl-grid" id="tpl-grid">
          ${templates.map(t => cardHTML(t)).join('')}
        </div>
        ${emptyUser}
      </div>
    </div>`;

  injectStyles();

  container.querySelector('#tpl-btn-new')?.addEventListener('click', () => createNew());
  container.querySelector('#tpl-empty-new')?.addEventListener('click', () => createNew());

  container.querySelectorAll('.tpl-card-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); navigate(`#tpl?id=${btn.dataset.id}`); });
  });
  
  container.querySelectorAll('.tpl-card-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const confirmed = await showConfirm({
        title: 'Delete Template?',
        body: 'This will permanently remove this template.',
        confirmText: 'Delete',
        variant: 'danger',
        icon: 'delete_forever'
      });
      if (!confirmed) return;
      await deleteTemplate(btn.dataset.id);
      showToast?.({ variant: 'success', title: 'Template deleted' });
      renderList(container); // re-render
    });
  });
  
  container.querySelectorAll('.tpl-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      navigate(`#tpl?id=${card.dataset.id}`);
    });
  });

  async function createNew() {
    const tpl = createEmptyTemplate();
    await saveTemplate(tpl);
    navigate(`#tpl?id=${tpl.id}`);
  }
}

function cardHTML(tpl) {
  const updated = tpl.updatedAt ? formatDate(tpl.updatedAt) : '—';
  const holdImg = "linear-gradient(135deg, #111318 0%, #1e293b 100%)";
  return `
    <article class="tpl-card" data-id="${tpl.id}" tabindex="0">
      <div class="tpl-card-icon" style="background: ${holdImg};">
        <span class="material-symbols-outlined" style="font-size:28px;color:#0ea5e9">wallpaper</span>
      </div>
      <div class="tpl-card-body">
        <div class="tpl-card-name">${escHtml(tpl.name)}</div>
        <div class="tpl-card-desc">${tpl.width} × ${tpl.height} • ${tpl.placeholders?.length || 0} Placeholder(s)</div>
        <div class="tpl-card-meta">
          <span class="text-sm text-muted" style="margin-left:auto">${updated}</span>
        </div>
      </div>
      <div class="tpl-card-actions">
        <button class="btn-icon tpl-card-edit" data-id="${tpl.id}" title="Edit">
          <span class="material-symbols-outlined">edit</span>
        </button>
        <button class="btn-icon tpl-card-delete" data-id="${tpl.id}" title="Delete">
          <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
        </button>
      </div>
    </article>`;
}

// ── Editor view ────────────────────────────────────────────
async function renderEditor(container, tplId) {
  const tpl = await getTemplate(tplId);
  if (!tpl) { navigate('#tpl'); return; }

  container.innerHTML = `
    <div class="screen tpl-screen" style="flex-direction:row">
      <!-- Sidebar -->
      <div class="tpl-sidebar" style="width:300px; border-right:1px solid var(--ps-border); display:flex; flex-direction:column; background:var(--ps-bg-surface);">
        <div class="screen-header" style="flex-shrink:0;">
          <div class="flex items-center gap-2">
            <button class="btn-icon" id="tpl-back"><span class="material-symbols-outlined">arrow_back</span></button>
            <div class="screen-title" style="font-size:16px;">Template</div>
          </div>
        </div>

        <div style="padding:16px; flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:16px;">
          <div class="bld-config-form">
            <label class="ic-label">Name</label>
            <input type="text" id="tpl-name" class="ic-input" value="${escHtml(tpl.name)}">

            <label class="ic-label" style="margin-top:12px;">Dimensions</label>
            <div class="flex gap-2">
               <input type="number" id="tpl-w" class="ic-input" value="${tpl.width}" style="flex:1" placeholder="Width">
               <span style="align-self:center; color:var(--ps-text-faint)">×</span>
               <input type="number" id="tpl-h" class="ic-input" value="${tpl.height}" style="flex:1" placeholder="Height">
            </div>

            <label class="ic-label" style="margin-top:16px;">Background Map</label>
            <button class="btn-secondary" id="tpl-btn-bg" style="width:100%; justify-content:center;">
              <span class="material-symbols-outlined">upload</span>
              Upload Background
            </button>
            <span class="text-xs text-muted" style="display:block;margin-top:6px;">Replaces current dimensions to match image.</span>
          </div>

          <hr style="border:none; border-top:1px solid var(--ps-border); margin:4px 0;">

          <div class="flex items-center justify-between">
             <label class="ic-label" style="margin:0;">Placeholders</label>
             <button class="btn-ghost" id="tpl-btn-add-ph" style="padding:2px 6px;font-size:12px;">+ Add Slot</button>
          </div>
          <button class="btn-secondary" id="tpl-btn-auto-detect" style="width:100%; justify-content:center; border-color:var(--ps-blue); color:var(--ps-blue); margin-top:8px;">
             <span class="material-symbols-outlined" style="font-size:16px;">magic_button</span> Auto-detect Slots
          </button>
          
          <div id="tpl-ph-list" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>

        <div style="padding:16px; border-top:1px solid var(--ps-border); display:flex; justify-content:space-between; align-items:center;">
           <span id="tpl-save-status" class="text-sm text-muted"></span>
           <button class="btn-primary" id="tpl-save-btn">
             <span class="material-symbols-outlined">save</span>
             Save
           </button>
        </div>
      </div>

      <!-- Canvas Area -->
      <div class="tpl-canvas-area" style="flex:1; background:#000; position:relative; display:flex; align-items:center; justify-content:center; overflow:hidden;">
        <canvas id="tpl-canvas" style="box-shadow:0 10px 40px rgba(0,0,0,0.5); object-fit:contain; max-width:90%; max-height:90%;"></canvas>
      </div>
    </div>`;

  injectStyles();

  // Elements
  const cvs = container.querySelector('#tpl-canvas');
  const ctx = cvs.getContext('2d');
  const phListContainer = container.querySelector('#tpl-ph-list');
  const status = container.querySelector('#tpl-save-status');

  let bgBitmap = null;
  let activePoint = null; // { pIdx, ptIdx }
  let candidatePlaceholders = [];

  // Init Image
  if (tpl.backgroundBlob) {
    try {
      bgBitmap = await createImageBitmap(tpl.backgroundBlob);
    } catch {}
  }

  cvs.width = tpl.width;
  cvs.height = tpl.height;

  function markDirty() { if(status) status.textContent = 'Unsaved…'; }

  function renderList() {
    let html = '';

    if (candidatePlaceholders.length > 0) {
      html += `
        <div style="padding: 10px; background: rgba(50, 200, 100, 0.1); border: 1px solid rgba(50, 200, 100, 0.3); border-radius: 6px; margin-bottom: 8px;">
           <div style="font-weight:600; color:#3ce16b; font-size:12px; margin-bottom:8px;">Candidate Slots (${candidatePlaceholders.length})</div>
           <div style="display:flex; gap:6px; margin-bottom: 8px;">
              <button class="btn-secondary" id="tpl-btn-add-all-cand" style="flex:1; padding:2px; font-size:11px; height:24px;">Add All</button>
              <button class="btn-secondary" id="tpl-btn-rej-all-cand" style="flex:1; padding:2px; font-size:11px; height:24px;">Discard All</button>
           </div>
           <div style="display:flex; flex-direction:column; gap:4px;">
              ${candidatePlaceholders.map((ph, i) => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; background:rgba(0,0,0,0.2); border-radius:4px;">
                  <span class="text-sm">Found ${i+1}</span>
                  <div style="display:flex; gap:2px;">
                    <button class="btn-icon tpl-cand-add" data-idx="${i}"><span class="material-symbols-outlined" style="font-size:16px; color:#3ce16b;">check</span></button>
                    <button class="btn-icon tpl-cand-del" data-idx="${i}"><span class="material-symbols-outlined" style="font-size:16px; color:var(--ps-red);">close</span></button>
                  </div>
                </div>
              `).join('')}
           </div>
        </div>
      `;
    }

    html += tpl.placeholders.map((ph, i) => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--ps-bg-raised); border:1px solid var(--ps-border); border-radius:6px;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          <span class="text-sm">Slot ${i + 1}</span>
          <select class="ic-input tpl-ph-fitmode" data-idx="${i}" style="font-size:12px; padding:2px 6px; height:24px;">
            <option value="stretch" ${(ph.fitMode === 'stretch' || !ph.fitMode) ? 'selected' : ''}>Stretch</option>
            <option value="cover" ${ph.fitMode === 'cover' ? 'selected' : ''}>Cover (Crop)</option>
            <option value="contain" ${ph.fitMode === 'contain' ? 'selected' : ''}>Contain</option>
            <option value="smart-crop" ${ph.fitMode === 'smart-crop' ? 'selected' : ''}>Smart Crop</option>
            <option value="face-crop" ${ph.fitMode === 'face-crop' ? 'selected' : ''}>Face Crop</option>
          </select>
        </div>
        <button class="btn-icon tpl-del-ph" data-idx="${i}" style="width:24px; height:24px;">
           <span class="material-symbols-outlined" style="font-size:14px; color:var(--ps-red);">delete</span>
        </button>
      </div>
    `).join('');

    phListContainer.innerHTML = html;

    phListContainer.querySelector('#tpl-btn-add-all-cand')?.addEventListener('click', () => {
      tpl.placeholders.push(...candidatePlaceholders);
      candidatePlaceholders = [];
      renderList(); drawCanvas(); markDirty();
    });

    phListContainer.querySelector('#tpl-btn-rej-all-cand')?.addEventListener('click', () => {
      candidatePlaceholders = [];
      renderList(); drawCanvas();
    });

    phListContainer.querySelectorAll('.tpl-cand-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        tpl.placeholders.push(candidatePlaceholders.splice(idx, 1)[0]);
        renderList(); drawCanvas(); markDirty();
      });
    });

    phListContainer.querySelectorAll('.tpl-cand-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        candidatePlaceholders.splice(idx, 1);
        renderList(); drawCanvas();
      });
    });

    phListContainer.querySelectorAll('.tpl-ph-fitmode').forEach(sel => {
      sel.addEventListener('change', e => {
        const idx = parseInt(sel.dataset.idx, 10);
        tpl.placeholders[idx].fitMode = e.target.value;
        markDirty();
      });
    });

    phListContainer.querySelectorAll('.tpl-del-ph').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        tpl.placeholders.splice(idx, 1);
        renderList();
        drawCanvas();
        markDirty();
      });
    });
  }

  function drawCanvas() {
    ctx.clearRect(0,0,cvs.width,cvs.height);
    
    // 1. BG
    if (bgBitmap) {
      ctx.drawImage(bgBitmap, 0, 0, cvs.width, cvs.height);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0,0,cvs.width,cvs.height);
    }

    // 2. Placeholders
    tpl.placeholders.forEach((ph, pIdx) => {
      ctx.beginPath();
      ph.points.forEach((pt, idx) => {
         const x = pt.x * cvs.width;
         const y = pt.y * cvs.height;
         if (idx === 0) ctx.moveTo(x, y);
         else ctx.lineTo(x, y);
      });
      ctx.closePath();
      
      // Fill
      ctx.fillStyle = 'rgba(0, 119, 255, 0.25)';
      ctx.fill();

      // Stroke
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Handles
      ph.points.forEach((pt, ptIdx) => {
        const hx = pt.x * cvs.width;
        const hy = pt.y * cvs.height;
        ctx.beginPath();
        ctx.arc(hx, hy, 6, 0, Math.PI * 2);
        ctx.fillStyle = (activePoint && activePoint.pIdx === pIdx && activePoint.ptIdx === ptIdx) ? '#ffffff' : '#0ea5e9';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Label Center
      const cx = (ph.points[0].x + ph.points[1].x + ph.points[2].x + ph.points[3].x) / 4 * cvs.width;
      const cy = (ph.points[0].y + ph.points[1].y + ph.points[2].y + ph.points[3].y) / 4 * cvs.height;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px var(--font-primary)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Slot ${pIdx + 1}`, cx, cy);
    });

    // 3. Candidates
    candidatePlaceholders.forEach((ph, pIdx) => {
      ctx.beginPath();
      ph.points.forEach((pt, idx) => {
         const x = pt.x * cvs.width;
         const y = pt.y * cvs.height;
         if (idx === 0) ctx.moveTo(x, y);
         else ctx.lineTo(x, y);
      });
      ctx.closePath();
      
      ctx.fillStyle = 'rgba(60, 225, 107, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#3ce16b';
      ctx.lineWidth = 2;
      ctx.stroke();

      const cx = (ph.points[0].x + ph.points[1].x + ph.points[2].x + ph.points[3].x) / 4 * cvs.width;
      const cy = (ph.points[0].y + ph.points[1].y + ph.points[2].y + ph.points[3].y) / 4 * cvs.height;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px var(--font-primary)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Found ${pIdx + 1}`, cx, cy);
    });
  }

  // ── Mouse Events ──
  cvs.addEventListener('mousedown', e => {
    const rect = cvs.getBoundingClientRect();
    const scaleX = cvs.width / rect.width;
    const scaleY = cvs.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    const HIT_RADIUS = 20; // easy to grab

    activePoint = null;
    for (let i = tpl.placeholders.length - 1; i >= 0; i--) {
      const ph = tpl.placeholders[i];
      for (let j = 0; j < ph.points.length; j++) {
        const ptX = ph.points[j].x * cvs.width;
        const ptY = ph.points[j].y * cvs.height;
        if (Math.hypot(clickX - ptX, clickY - ptY) < HIT_RADIUS) {
          activePoint = { pIdx: i, ptIdx: j };
          drawCanvas();
          return;
        }
      }
    }
  });

  window.addEventListener('mousemove', e => {
    if (!activePoint) return;
    const rect = cvs.getBoundingClientRect();
    const scaleX = cvs.width / rect.width;
    const scaleY = cvs.height / rect.height;
    
    // Normalize and clamp between 0 and 1
    let u = ((e.clientX - rect.left) * scaleX) / cvs.width;
    let v = ((e.clientY - rect.top) * scaleY) / cvs.height;
    u = Math.max(0, Math.min(1, u));
    v = Math.max(0, Math.min(1, v));

    tpl.placeholders[activePoint.pIdx].points[activePoint.ptIdx] = { x: u, y: v };
    drawCanvas();
    markDirty();
  });

  window.addEventListener('mouseup', () => {
    if (activePoint) {
      activePoint = null;
      drawCanvas();
    }
  });

  // ── Actions ──
  container.querySelector('#tpl-btn-add-ph').addEventListener('click', () => {
    tpl.placeholders.push({
      id: uuid(),
      zIndex: tpl.placeholders.length,
      fitMode: 'cover',
      points: [{x:0.2,y:0.2}, {x:0.8,y:0.2}, {x:0.8,y:0.8}, {x:0.2,y:0.8}]
    });
    renderList();
    drawCanvas();
    markDirty();
  });

  container.querySelector('#tpl-btn-auto-detect').addEventListener('click', async () => {
    if (!tpl.backgroundBlob) {
      showToast?.({ variant: 'error', title: 'Upload Background', message: 'You must upload a background image to scan.' });
      return;
    }
    const btn = container.querySelector('#tpl-btn-auto-detect');
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">hourglass_empty</span> Scanning...';
    btn.disabled = true;
    try {
      const { detectQuadrilaterals } = await import('../utils/scanner.js');
      candidatePlaceholders = await detectQuadrilaterals(tpl.backgroundBlob);
      if (candidatePlaceholders.length === 0) {
        showToast?.({ variant: 'info', title: 'No Slots Found', message: 'The scanner could not find distinct shapes. Please add manually.' });
      } else {
        showToast?.({ variant: 'success', title: `Found ${candidatePlaceholders.length} Potential Slots` });
      }
      renderList();
      drawCanvas();
    } catch (err) {
      console.error(err);
      showToast?.({ variant: 'error', title: 'Scanner Error', message: err.message });
    } finally {
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">magic_button</span> Auto-detect Slots';
      btn.disabled = false;
    }
  });

  container.querySelector('#tpl-btn-bg').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async ev => {
      const f = ev.target.files[0];
      if(!f) return;
      if (bgBitmap) bgBitmap.close();
      bgBitmap = await createImageBitmap(f);
      tpl.width = bgBitmap.width;
      tpl.height = bgBitmap.height;
      cvs.width = tpl.width;
      cvs.height = tpl.height;
      tpl.backgroundBlob = f;
      container.querySelector('#tpl-w').value = tpl.width;
      container.querySelector('#tpl-h').value = tpl.height;
      drawCanvas();
      markDirty();
    };
    inp.click();
  });

  container.querySelector('#tpl-w').addEventListener('change', e => { tpl.width=parseInt(e.target.value)||1080; cvs.width=tpl.width; drawCanvas(); markDirty(); });
  container.querySelector('#tpl-h').addEventListener('change', e => { tpl.height=parseInt(e.target.value)||1080; cvs.height=tpl.height; drawCanvas(); markDirty(); });

  async function doSave() {
    tpl.name = container.querySelector('#tpl-name').value || 'Untitled Template';
    await saveTemplate(tpl);
    if(status) status.textContent = 'Saved';
    showToast?.({ variant: 'success', title: 'Template saved' });
  }

  container.querySelector('#tpl-save-btn').addEventListener('click', doSave);
  container.querySelector('#tpl-back').addEventListener('click', async () => { await doSave(); navigate('#tpl'); });
  container.querySelector('#tpl-name').addEventListener('input', markDirty);

  // Ready
  renderList();
  drawCanvas();
}

// ── Entry point ────────────────────────────────────────────
export async function render(container, hash) {
  const params  = new URLSearchParams((hash.split('?')[1] || ''));
  const tplId = params.get('id');
  if (tplId) {
    await renderEditor(container, tplId);
  } else {
    await renderList(container);
  }
}

let _tplStyles = false;
function injectStyles() {
  if (_tplStyles) return;
  _tplStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .tpl-screen { display:flex; flex-direction:column; height:100%; }
    .tpl-list-body { flex:1; overflow-y:auto; padding:20px; }
    .tpl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
    .tpl-card {
      background:var(--ps-bg-surface); border:1px solid var(--ps-border); border-radius:10px;
      display:flex; align-items:center; gap:12px; padding:14px;
      cursor:pointer; transition:border-color 150ms, box-shadow 150ms;
    }
    .tpl-card:hover { border-color:var(--ps-blue); box-shadow:0 4px 16px rgba(0,119,255,0.1); }
    .tpl-card-icon { width:48px; height:48px; border-radius:10px; background:rgba(0,119,255,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .tpl-card-body { flex:1; overflow:hidden; }
    .tpl-card-name { font-size:14px; font-weight:600; margin-bottom:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .tpl-card-desc { font-size:12px; color:var(--ps-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:6px; }
    .tpl-card-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .tpl-card-actions { display:flex; gap:4px; flex-shrink:0; }
  `;
  document.head.appendChild(s);
}
