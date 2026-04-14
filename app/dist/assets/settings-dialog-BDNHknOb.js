import{getSettings as d,saveSettings as x}from"./settings-4MvqzOHa.js";import{d as u,c as y,s as i}from"./index-Cvca53V-.js";import"./ai-bgremoval-CLcXU_4U.js";async function h(){const c=d(),a=c.palette||[];let r=null;try{const t=await u("folders","project_root");t&&(r=t.handle)}catch(t){console.warn("Failed to fetch project root handle",t)}const s=document.createElement("div");s.style.cssText="position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.75); backdrop-filter:blur(6px);",s.innerHTML=`
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
                  ${r?`<span style="color:var(--ps-green); display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Linked to: ${r.name}</span>`:"Not linked. Thumbnails will use base64 fallback."}
                </span>
              </div>
              <button class="btn-secondary" id="btn-link-project" style="font-size:11px; padding:6px 12px;">
                <span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">folder_shared</span>
                ${r?"Change Link":"Link Project Folder"}
              </button>
            </div>
            <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.4;">
              Linking the project root allows the app to save recipe thumbnails directly into the <code>samples/</code> and <code>user-samples/</code> folders for persistence.
            </p>
          </div>
        </section>

        <!-- Batch Core -->
        <section style="display:flex; flex-direction:column; gap:12px;">
          <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">Batch Engine</h4>
          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:var(--ps-bg-overlay); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
            <input type="checkbox" id="cfg-batch-sync" ${c.batch?.useInputForOutput?"checked":""} style="margin-top:2px;" />
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
  `,document.body.appendChild(s);const o=s.querySelector("#swatch-list"),n=()=>{o.innerHTML=a.map((t,e)=>`
      <div class="swatch-row" data-idx="${e}" style="display:flex; align-items:center; gap:8px;">
        <input type="color" class="swatch-color" value="${t.color}" style="width:32px; height:32px; padding:0; border:1px solid var(--ps-border); border-radius:4px; cursor:pointer;" />
        <input type="text" class="ic-input swatch-label" value="${t.label}" placeholder="Color Name" style="flex:1;" />
        <button class="btn-icon btn-remove-swatch" title="Remove" style="color:var(--ps-red); width:28px; height:28px;">
            <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
        </button>
      </div>
    `).join(""),a.length===0&&(o.innerHTML='<span style="font-size:11px; color:var(--ps-text-faint);">No swatches configured. Click Add Swatch to create one.</span>'),o.querySelectorAll(".btn-remove-swatch").forEach(t=>{t.onclick=e=>{const l=parseInt(e.currentTarget.closest(".swatch-row").dataset.idx);a.splice(l,1),n()}}),o.querySelectorAll(".swatch-color").forEach(t=>{t.onchange=e=>{const l=parseInt(e.currentTarget.closest(".swatch-row").dataset.idx);a[l].color=e.target.value}}),o.querySelectorAll(".swatch-label").forEach(t=>{t.onchange=e=>{const l=parseInt(e.currentTarget.closest(".swatch-row").dataset.idx);a[l].label=e.target.value}})};n(),s.querySelector("#btn-link-project").onclick=async t=>{try{const e=await window.showDirectoryPicker();e&&(await y("folders",{key:"project_root",handle:e}),r=e,s.querySelector("#project-root-status").innerHTML=`<span style="color:var(--ps-green); display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Linked to: ${e.name}</span>`,t.target.innerHTML='<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">folder_shared</span> Change Link',i({variant:"success",title:"Project Linked",description:`Thumbnails will now be saved to ${e.name}/samples.`}))}catch(e){e.name!=="AbortError"&&i({variant:"danger",title:"Linking failed",description:e.message})}},s.querySelector("#btn-add-swatch").onclick=()=>{a.push({label:"New Color",color:"#ff0000"}),n()};const p=()=>s.remove();s.querySelector("#settings-close").onclick=p,s.querySelector("#settings-save").onclick=()=>{const t=[];o.querySelectorAll(".swatch-row").forEach(e=>{t.push({color:e.querySelector(".swatch-color").value,label:e.querySelector(".swatch-label").value.trim()||"Untitled"})}),x({batch:{useInputForOutput:s.querySelector("#cfg-batch-sync").checked},palette:t}),i({variant:"success",title:"Settings Saved",description:"Preferences applied globally."}),p()}}export{h as showSettingsModal};
