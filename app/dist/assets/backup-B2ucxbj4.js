import{g as p,a as x,s as l}from"./index-Cvca53V-.js";import"./ai-bgremoval-CLcXU_4U.js";async function y(){p();const e=["recipes","blocks","templates"],o={version:1,checksum:"PicMachinaExport",metadata:{exportedAt:new Date().toISOString()},data:{}};try{for(const s of e)o.data[s]=await x(s);const t=new Blob([JSON.stringify(o,null,2)],{type:"application/json"}),r=URL.createObjectURL(t),a=document.createElement("a");a.href=r,a.download=`PicMachina_Backup_${new Date().toISOString().slice(0,10)}.json`,a.click(),URL.revokeObjectURL(r),l({variant:"success",title:"Backup Successful",description:"Your configuration has been downloaded."})}catch(t){console.error("Backup failed:",t),l({variant:"error",title:"Backup Failed",description:t.message})}}async function g(e,{wipeFirst:o=!0}={}){try{const t=await e.text(),r=JSON.parse(t);if(r.checksum!=="PicMachinaExport"||!r.data)throw new Error("Invalid backup file format. Missing PicMachina checksum.");const a=p(),s=["recipes","blocks","templates"];let c=0;for(const i of s)r.data[i]&&await new Promise((u,b)=>{const n=a.transaction(i,"readwrite"),d=n.objectStore(i);o&&d.clear();for(const m of r.data[i])d.put(m),c++;n.oncomplete=()=>u(),n.onerror=()=>b(n.error)});l({variant:"success",title:"Restore Complete",description:`Successfully restored ${c} configuration records. Reloading...`}),setTimeout(()=>window.location.reload(),1500)}catch(t){console.error("Restore failed:",t),l({variant:"error",title:"Restore Failed",description:t.message||"The backup file is corrupt or unreadable."})}}function w(){const e=document.createElement("div");e.style.cssText="position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px);",e.innerHTML=`
    <div style="background:var(--ps-surface); border:1px solid var(--ps-border); border-radius:8px; width:400px; max-width:90vw; box-shadow:0 10px 40px rgba(0,0,0,0.5); overflow:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid var(--ps-border); background:rgba(0,0,0,0.2);">
        <h3 style="margin:0; font-size:16px; font-weight:600;">Database Backup & Restore</h3>
        <button class="btn-icon" id="db-bk-close" style="width:28px; height:28px;">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 24px; padding: 24px;">
        <div style="border:1px solid var(--ps-border); border-radius:6px; padding: 16px; background:rgba(0,0,0,0.1);">
          <h4 style="margin-top: 0; margin-bottom:8px;">Export Database</h4>
          <p class="text-xs text-muted" style="margin-bottom: 16px; line-height:1.4;">Download a JSON snapshot of all your local Recipes, UI Blocks, and Templates. This file can be used to migrate your configurations to another browser.</p>
          <button class="btn-primary" id="db-bk-export" style="width: 100%; justify-content:center;">
            <span class="material-symbols-outlined" style="font-size:16px; margin-right:8px;">download</span> Download Backup
          </button>
        </div>
        
        <div style="border:1px solid rgba(239, 68, 68, 0.4); border-radius:6px; padding: 16px; background:rgba(239, 68, 68, 0.05);">
          <h4 style="margin-top: 0; margin-bottom:8px; color: var(--ps-red);">Restore from File</h4>
          <p class="text-xs text-muted" style="margin-bottom: 16px; line-height:1.4;">Upload a previously exported JSON backup file. <strong style="color:var(--ps-red);">Warning: This is a destructive action.</strong> All existing recipes will be wiped and replaced by the imported file's contents.</p>
          
          <label class="btn-secondary" style="width: 100%; justify-content: center; cursor: pointer; color: var(--ps-red); border-color: rgba(239,68,68,0.3);">
            <span class="material-symbols-outlined" style="font-size:16px; margin-right:8px;">upload</span> Select Backup File
            <input type="file" id="db-bk-import-input" accept=".json,application/json" style="display:none">
          </label>
        </div>
      </div>
    </div>
  `,document.body.appendChild(e),e.querySelector("#db-bk-close").onclick=()=>e.remove(),e.querySelector("#db-bk-export").onclick=()=>{y(),e.remove()},e.querySelector("#db-bk-import-input").onchange=o=>{const t=o.target.files?.[0];t&&(confirm("Are you absolutely sure you want to overwrite your entire database with this file? All unsaved/un-exported work will be permanently deleted.")?(g(t,{wipeFirst:!0}),e.querySelector(".modal-dialog").style.opacity="0.5",e.querySelector(".modal-dialog").style.pointerEvents="none"):o.target.value="")}}export{y as exportAll,g as importAll,w as showBackupModal};
