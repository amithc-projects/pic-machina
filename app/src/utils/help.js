/**
 * ImageChef — Tutorial & Help Utility
 */

export function showHelpModal() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.75); backdrop-filter:blur(6px);';
  modal.innerHTML = `
    <div style="background:var(--ps-surface); border:1px solid var(--ps-border); border-radius:12px; width:720px; max-width:95vw; box-shadow:0 10px 50px rgba(0,0,0,0.6); overflow:hidden; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--ps-border); background:rgba(0,0,0,0.2);">
        <h3 style="margin:0; font-size:16px; font-weight:600; display:flex; align-items:center; gap:8px;">
          <span class="material-symbols-outlined" style="color:var(--ps-blue);">school</span>
          Interactive Tutorial
        </h3>
        <button class="btn-icon" id="help-bk-close" style="width:28px; height:28px;">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>
      <div style="padding: 24px; display:flex; flex-direction:column; gap:16px; background:var(--ps-bg-app);">
        <p class="text-sm text-muted" style="margin:0; line-height:1.5;">Watch this quick breakdown to master the interface, build powerful chained macro recipes, and unleash localized AI across hundreds of your images in seconds.</p>
        
        <div style="background:#000; border-radius:8px; overflow:hidden; border:1px solid var(--ps-border); aspect-ratio:16/9; display:flex; align-items:center; justify-content:center; position:relative;">
          <video src="/assets/tutorial.mp4" controls preload="none" style="width:100%; height:100%; outline:none;" poster="/assets/tutorial-poster.jpg"></video>
          <!-- Absolute centered placeholder fallback in case video fails to load or isn't built yet -->
          <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; color:rgba(255,255,255,0.4);" class="video-placeholder">
            <span class="material-symbols-outlined" style="font-size:48px; margin-bottom:12px;">movie</span>
            <span style="font-size:14px; font-weight:500;">Tutorial Video Pending...</span>
          </div>
        </div>
        </div>
        <div style="display:flex; justify-content:center; align-items:center; border-top:1px solid var(--ps-border); padding-top:16px;">
           <button class="btn-primary" id="help-btn-docs" style="display:flex;align-items:center;gap:6px;font-size:13px;padding:8px 16px;">
             <span class="material-symbols-outlined" style="font-size:16px">menu_book</span>
             Browse Transformations Documentation
           </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Auto-hide the placeholder text when video plays
  const videoEl = modal.querySelector('video');
  const placeholderEl = modal.querySelector('.video-placeholder');
  videoEl.addEventListener('play', () => { if (placeholderEl) placeholderEl.style.display = 'none'; });
  
  modal.querySelector('#help-bk-close').onclick = () => {
    videoEl.pause();
    modal.remove();
  };
  
  modal.querySelector('#help-btn-docs').onclick = () => {
    videoEl.pause();
    modal.remove();
    window.location.hash = '#hlp';
  };
}
