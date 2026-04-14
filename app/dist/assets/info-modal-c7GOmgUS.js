import{g as n,r}from"./image-info-RCB_TI9T.js";import"./ai-bgremoval-CLcXU_4U.js";function f(a,t){let e=document.getElementById("ic-info-modal");if(e&&e.remove(),e=document.createElement("dialog"),e.id="ic-info-modal",e.className="modal",e.style.cssText="width:800px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;padding:0;border-radius:14px;border:1px solid var(--ps-border);background:var(--ps-bg-surface)",e.innerHTML=`
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
      </div>`,document.body.appendChild(e),e.showModal(),e.querySelector("#info-modal-close")?.addEventListener("click",()=>e.close()),e.addEventListener("click",i=>{i.target===e&&e.close()}),n(a).then(i=>{const o=e.querySelector("#info-modal-before");o&&(o.innerHTML="",o.appendChild(r(i)))}).catch(i=>{const o=e.querySelector("#info-modal-before");o&&(o.innerHTML='<div class="text-sm text-muted">Error reading before file</div>')}),t){let i=Promise.resolve(t);typeof t=="string"&&(i=fetch(t).then(o=>o.blob())),i.then(o=>n(o)).then(o=>{const d=e.querySelector("#info-modal-after");d&&(d.innerHTML="",d.appendChild(r(o)))}).catch(o=>{const d=e.querySelector("#info-modal-after");d&&(d.innerHTML='<div class="text-sm text-muted">Error reading after file</div>')})}else{const i=e.querySelector("#info-modal-after");i&&(i.innerHTML='<div class="text-sm text-muted">Preview not yet generated</div>')}}export{f as renderFileInfoModal};
