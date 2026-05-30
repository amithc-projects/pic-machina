import { exportAll, importAll } from '../utils/backup.js';
import { showConfirm } from '../utils/dialogs.js';
import { t } from '../i18n/index.js';

export async function render(container, hash) {
  container.innerHTML = `
    <div class="screen bup-screen" style="display:flex;flex-direction:column;height:100%;background:var(--ps-surface)">
      <div class="screen-header" style="flex-shrink:0;">
        <div class="flex items-center gap-2">
           <span class="material-symbols-outlined" style="color:var(--ps-blue)">settings_backup_restore</span>
           <div class="screen-title">${t('bup.title')}</div>
        </div>
      </div>

      <div style="padding: 24px; max-width:900px; margin:0 auto; width:100%; display:flex; flex-direction:column; gap:24px; overflow-y: auto;">
        <div style="border:1px solid var(--ps-border); border-radius:6px; padding: 24px; background:var(--ps-bg-app);">
          <h4 style="margin-top: 0; margin-bottom:12px; font-size:16px;">${t('bup.export.heading')}</h4>
          <p class="text-sm text-muted" style="margin-bottom: 24px; line-height:1.5;">${t('bup.export.desc')}</p>
          <button class="btn-primary" id="db-bk-export" style="justify-content:center;">
            <span class="material-symbols-outlined" style="font-size:18px; margin-right:8px;">download</span> ${t('bup.export.button')}
          </button>
        </div>

        <div style="border:1px solid rgba(239, 68, 68, 0.4); border-radius:6px; padding: 24px; background:rgba(239, 68, 68, 0.05);">
          <h4 style="margin-top: 0; margin-bottom:12px; color: var(--ps-red); font-size:16px;">${t('bup.restore.heading')}</h4>
          <p class="text-sm text-muted" style="margin-bottom: 24px; line-height:1.5;">${t('bup.restore.descPre')} <strong style="color:var(--ps-red);">${t('bup.restore.warning')}</strong> ${t('bup.restore.descPost')}</p>

          <label class="btn-secondary" style="display:inline-flex; align-items:center; cursor: pointer; color: var(--ps-red); border-color: rgba(239,68,68,0.3);">
            <span class="material-symbols-outlined" style="font-size:18px; margin-right:8px;">upload</span> ${t('bup.restore.button')}
            <input type="file" id="db-bk-import-input" accept=".json,application/json" style="display:none">
          </label>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#db-bk-export').onclick = () => {
    exportAll();
  };
  
  container.querySelector('#db-bk-import-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const confirmed = await showConfirm({
        title: t('bup.confirm.title'),
        body: t('bup.confirm.body'),
        confirmText: t('bup.confirm.confirmText'),
        cancelText: t('common.cancel'),
        variant: 'danger',
        icon: 'warning',
      });
      if (confirmed) {
        importAll(file, { wipeFirst: true });
      } else {
        e.target.value = '';
      }
    }
  };
}
