const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/scanner-GypPpLxj.js","assets/misc-BYzs6oS8.js"])))=>i.map(i=>d[i]);
import{_ as P}from"./ai-bgremoval-CLcXU_4U.js";import{getTemplate as j,getAllTemplates as z,deleteTemplate as B,createEmptyTemplate as _,saveTemplate as $}from"./templates-B6ijJcCq.js";import{n as k,s as v}from"./index-Cvca53V-.js";import{u as H,f as R}from"./misc-BYzs6oS8.js";import{s as F}from"./dialogs-CUir_jZ5.js";function q(l){return String(l).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}async function I(l){const g=await z(),a=g.length===0?`
    <div class="empty-state" style="padding-top:60px">
      <span class="material-symbols-outlined" style="font-size:48px">wallpaper</span>
      <div class="empty-state-title">No templates yet</div>
      <div class="empty-state-desc">Create your first perspective template to composite videos or images.</div>
      <button class="btn-primary" id="tpl-empty-new">
        <span class="material-symbols-outlined">add</span>
        Create Template
      </button>
    </div>`:"";l.innerHTML=`
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
          ${g.map(e=>U(e)).join("")}
        </div>
        ${a}
      </div>
    </div>`,A(),l.querySelector("#tpl-btn-new")?.addEventListener("click",()=>s()),l.querySelector("#tpl-empty-new")?.addEventListener("click",()=>s()),l.querySelectorAll(".tpl-card-edit").forEach(e=>{e.addEventListener("click",c=>{c.stopPropagation(),k(`#tpl?id=${e.dataset.id}`)})}),l.querySelectorAll(".tpl-card-delete").forEach(e=>{e.addEventListener("click",async c=>{c.stopPropagation(),await F({title:"Delete Template?",body:"This will permanently remove this template.",confirmText:"Delete",variant:"danger",icon:"delete_forever"})&&(await B(e.dataset.id),v?.({variant:"success",title:"Template deleted"}),I(l))})}),l.querySelectorAll(".tpl-card").forEach(e=>{e.addEventListener("click",c=>{c.target.closest("button")||k(`#tpl?id=${e.dataset.id}`)})});async function s(){const e=_();await $(e),k(`#tpl?id=${e.id}`)}}function U(l){const g=l.updatedAt?R(l.updatedAt):"—";return`
    <article class="tpl-card" data-id="${l.id}" tabindex="0">
      <div class="tpl-card-icon" style="background: linear-gradient(135deg, #111318 0%, #1e293b 100%);">
        <span class="material-symbols-outlined" style="font-size:28px;color:#0ea5e9">wallpaper</span>
      </div>
      <div class="tpl-card-body">
        <div class="tpl-card-name">${q(l.name)}</div>
        <div class="tpl-card-desc">${l.width} × ${l.height} • ${l.placeholders?.length||0} Placeholder(s)</div>
        <div class="tpl-card-meta">
          <span class="text-sm text-muted" style="margin-left:auto">${g}</span>
        </div>
      </div>
      <div class="tpl-card-actions">
        <button class="btn-icon tpl-card-edit" data-id="${l.id}" title="Edit">
          <span class="material-symbols-outlined">edit</span>
        </button>
        <button class="btn-icon tpl-card-delete" data-id="${l.id}" title="Delete">
          <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
        </button>
      </div>
    </article>`}async function D(l,g){const a=await j(g);if(!a){k("#tpl");return}l.innerHTML=`
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
            <input type="text" id="tpl-name" class="ic-input" value="${q(a.name)}">

            <label class="ic-label" style="margin-top:12px;">Dimensions</label>
            <div class="flex gap-2">
               <input type="number" id="tpl-w" class="ic-input" value="${a.width}" style="flex:1" placeholder="Width">
               <span style="align-self:center; color:var(--ps-text-faint)">×</span>
               <input type="number" id="tpl-h" class="ic-input" value="${a.height}" style="flex:1" placeholder="Height">
            </div>

            <label class="ic-label" style="margin-top:16px;">Background Map</label>
            <div class="flex gap-2">
              <button class="btn-secondary" id="tpl-btn-bg" style="flex:1; justify-content:center; padding: 6px;">
                <span class="material-symbols-outlined">image</span>
                Image
              </button>
              <button class="btn-secondary" id="tpl-btn-bg-video" style="flex:1; justify-content:center; padding: 6px;">
                <span class="material-symbols-outlined">movie</span>
                Video
              </button>
            </div>
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
    </div>`,A();const s=l.querySelector("#tpl-canvas"),e=s.getContext("2d"),c=l.querySelector("#tpl-ph-list"),w=l.querySelector("#tpl-save-status");let p=null,f=null,u=[];if(a.backgroundBlob)try{p=await createImageBitmap(a.backgroundBlob)}catch{}s.width=a.width,s.height=a.height;function m(){w&&(w.textContent="Unsaved…")}function b(){let t="";u.length>0&&(t+=`
        <div style="padding: 10px; background: rgba(50, 200, 100, 0.1); border: 1px solid rgba(50, 200, 100, 0.3); border-radius: 6px; margin-bottom: 8px;">
           <div style="font-weight:600; color:#3ce16b; font-size:12px; margin-bottom:8px;">Candidate Slots (${u.length})</div>
           <div style="display:flex; gap:6px; margin-bottom: 8px;">
              <button class="btn-secondary" id="tpl-btn-add-all-cand" style="flex:1; padding:2px; font-size:11px; height:24px;">Add All</button>
              <button class="btn-secondary" id="tpl-btn-rej-all-cand" style="flex:1; padding:2px; font-size:11px; height:24px;">Discard All</button>
           </div>
           <div style="display:flex; flex-direction:column; gap:4px;">
              ${u.map((i,n)=>`
                <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; background:rgba(0,0,0,0.2); border-radius:4px;">
                  <span class="text-sm">Found ${n+1}</span>
                  <div style="display:flex; gap:2px;">
                    <button class="btn-icon tpl-cand-add" data-idx="${n}"><span class="material-symbols-outlined" style="font-size:16px; color:#3ce16b;">check</span></button>
                    <button class="btn-icon tpl-cand-del" data-idx="${n}"><span class="material-symbols-outlined" style="font-size:16px; color:var(--ps-red);">close</span></button>
                  </div>
                </div>
              `).join("")}
           </div>
        </div>
      `),t+=a.placeholders.map((i,n)=>`
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--ps-bg-raised); border:1px solid var(--ps-border); border-radius:6px;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          <span class="text-sm">Slot ${n+1}</span>
          <select class="ic-input tpl-ph-fitmode" data-idx="${n}" style="font-size:12px; padding:2px 6px; height:24px;">
            <option value="stretch" ${i.fitMode==="stretch"||!i.fitMode?"selected":""}>Stretch</option>
            <option value="cover" ${i.fitMode==="cover"?"selected":""}>Cover (Crop)</option>
            <option value="contain" ${i.fitMode==="contain"?"selected":""}>Contain</option>
            <option value="smart-crop" ${i.fitMode==="smart-crop"?"selected":""}>Smart Crop</option>
            <option value="face-crop" ${i.fitMode==="face-crop"?"selected":""}>Face Crop</option>
          </select>
        </div>
        <button class="btn-icon tpl-del-ph" data-idx="${n}" style="width:24px; height:24px;">
           <span class="material-symbols-outlined" style="font-size:14px; color:var(--ps-red);">delete</span>
        </button>
      </div>
    `).join(""),c.innerHTML=t,c.querySelector("#tpl-btn-add-all-cand")?.addEventListener("click",()=>{a.placeholders.push(...u),u=[],b(),r(),m()}),c.querySelector("#tpl-btn-rej-all-cand")?.addEventListener("click",()=>{u=[],b(),r()}),c.querySelectorAll(".tpl-cand-add").forEach(i=>{i.addEventListener("click",()=>{const n=parseInt(i.dataset.idx,10);a.placeholders.push(u.splice(n,1)[0]),b(),r(),m()})}),c.querySelectorAll(".tpl-cand-del").forEach(i=>{i.addEventListener("click",()=>{const n=parseInt(i.dataset.idx,10);u.splice(n,1),b(),r()})}),c.querySelectorAll(".tpl-ph-fitmode").forEach(i=>{i.addEventListener("change",n=>{const o=parseInt(i.dataset.idx,10);a.placeholders[o].fitMode=n.target.value,m()})}),c.querySelectorAll(".tpl-del-ph").forEach(i=>{i.addEventListener("click",()=>{const n=parseInt(i.dataset.idx,10);a.placeholders.splice(n,1),b(),r(),m()})})}function r(){e.clearRect(0,0,s.width,s.height),p?e.drawImage(p,0,0,s.width,s.height):(e.fillStyle="#1e293b",e.fillRect(0,0,s.width,s.height)),a.placeholders.forEach((t,i)=>{e.beginPath(),t.points.forEach((d,y)=>{const x=d.x*s.width,h=d.y*s.height;y===0?e.moveTo(x,h):e.lineTo(x,h)}),e.closePath(),e.fillStyle="rgba(0, 119, 255, 0.25)",e.fill(),e.strokeStyle="#0ea5e9",e.lineWidth=2,e.stroke(),t.points.forEach((d,y)=>{const x=d.x*s.width,h=d.y*s.height;e.beginPath(),e.arc(x,h,6,0,Math.PI*2),e.fillStyle=f&&f.pIdx===i&&f.ptIdx===y?"#ffffff":"#0ea5e9",e.fill(),e.strokeStyle="#000000",e.lineWidth=1,e.stroke()});const n=(t.points[0].x+t.points[1].x+t.points[2].x+t.points[3].x)/4*s.width,o=(t.points[0].y+t.points[1].y+t.points[2].y+t.points[3].y)/4*s.height;e.fillStyle="#ffffff",e.font="bold 24px var(--font-primary)",e.textAlign="center",e.textBaseline="middle",e.fillText(`Slot ${i+1}`,n,o)}),u.forEach((t,i)=>{e.beginPath(),t.points.forEach((d,y)=>{const x=d.x*s.width,h=d.y*s.height;y===0?e.moveTo(x,h):e.lineTo(x,h)}),e.closePath(),e.fillStyle="rgba(60, 225, 107, 0.2)",e.fill(),e.strokeStyle="#3ce16b",e.lineWidth=2,e.stroke();const n=(t.points[0].x+t.points[1].x+t.points[2].x+t.points[3].x)/4*s.width,o=(t.points[0].y+t.points[1].y+t.points[2].y+t.points[3].y)/4*s.height;e.fillStyle="#ffffff",e.font="bold 20px var(--font-primary)",e.textAlign="center",e.textBaseline="middle",e.fillText(`Found ${i+1}`,n,o)})}s.addEventListener("mousedown",t=>{const i=s.getBoundingClientRect(),n=s.width/i.width,o=s.height/i.height,d=(t.clientX-i.left)*n,y=(t.clientY-i.top)*o,x=20;f=null;for(let h=a.placeholders.length-1;h>=0;h--){const E=a.placeholders[h];for(let S=0;S<E.points.length;S++){const C=E.points[S].x*s.width,M=E.points[S].y*s.height;if(Math.hypot(d-C,y-M)<x){f={pIdx:h,ptIdx:S},r();return}}}}),window.addEventListener("mousemove",t=>{if(!f)return;const i=s.getBoundingClientRect(),n=s.width/i.width,o=s.height/i.height;let d=(t.clientX-i.left)*n/s.width,y=(t.clientY-i.top)*o/s.height;d=Math.max(0,Math.min(1,d)),y=Math.max(0,Math.min(1,y)),a.placeholders[f.pIdx].points[f.ptIdx]={x:d,y},r(),m()}),window.addEventListener("mouseup",()=>{f&&(f=null,r())}),l.querySelector("#tpl-btn-add-ph").addEventListener("click",()=>{a.placeholders.push({id:H(),zIndex:a.placeholders.length,fitMode:"cover",points:[{x:.2,y:.2},{x:.8,y:.2},{x:.8,y:.8},{x:.2,y:.8}]}),b(),r(),m()}),l.querySelector("#tpl-btn-auto-detect").addEventListener("click",async()=>{if(!a.backgroundBlob){v?.({variant:"error",title:"Upload Background"});return}const t=l.querySelector("#tpl-btn-auto-detect");t.innerHTML='<span class="material-symbols-outlined" style="font-size:16px;">hourglass_empty</span> Scanning...',t.disabled=!0;try{const{detectQuadrilaterals:i}=await P(async()=>{const{detectQuadrilaterals:n}=await import("./scanner-GypPpLxj.js");return{detectQuadrilaterals:n}},__vite__mapDeps([0,1]));u=await i(a.backgroundBlob),u.length===0?v?.({variant:"info",title:"No Slots Found",message:"The scanner could not find distinct shapes. Please add manually."}):v?.({variant:"success",title:`Found ${u.length} Potential Slots`}),b(),r()}catch(i){console.error(i),v?.({variant:"error",title:"Scanner Error",message:i.message})}finally{t.innerHTML='<span class="material-symbols-outlined" style="font-size:16px;">magic_button</span> Auto-detect Slots',t.disabled=!1}}),l.querySelector("#tpl-btn-bg").addEventListener("click",()=>{const t=document.createElement("input");t.type="file",t.accept="image/*",t.onchange=async i=>{const n=i.target.files[0];n&&(p&&p.close(),p=await createImageBitmap(n),a.width=p.width,a.height=p.height,s.width=a.width,s.height=a.height,a.backgroundBlob=n,a.backgroundVideoHandle=null,l.querySelector("#tpl-w").value=a.width,l.querySelector("#tpl-h").value=a.height,r(),m())},t.click()}),l.querySelector("#tpl-btn-bg-video").addEventListener("click",async()=>{try{if(!window.showOpenFilePicker){v?.({variant:"error",message:"Video backgrounds require a browser supporting File System Access API."});return}const i=(await window.showOpenFilePicker({types:[{description:"Video Files",accept:{"video/*":[".mp4",".webm",".mov"]}}],multiple:!1}))[0],n=await i.getFile(),o=document.createElement("video");o.muted=!0,o.src=URL.createObjectURL(n),o.preload="metadata",o.style.cssText="position:fixed;opacity:0;pointer-events:none;width:1px;height:1px",document.body.appendChild(o),o.onloadedmetadata=()=>{o.currentTime=0},o.onerror=()=>{v?.({variant:"error",message:"Could not decode video file."}),document.body.removeChild(o)},o.onseeked=async()=>{p&&p.close();const d=document.createElement("canvas");d.width=o.videoWidth,d.height=o.videoHeight,d.getContext("2d").drawImage(o,0,0),p=await createImageBitmap(d),a.width=p.width,a.height=p.height,s.width=a.width,s.height=a.height,a.backgroundVideoHandle=i,a.backgroundBlob=null,l.querySelector("#tpl-w").value=a.width,l.querySelector("#tpl-h").value=a.height,r(),m(),document.body.removeChild(o),URL.revokeObjectURL(o.src)}}catch(t){t.name!=="AbortError"&&console.error(t)}}),l.querySelector("#tpl-w").addEventListener("change",t=>{a.width=parseInt(t.target.value)||1080,s.width=a.width,r(),m()}),l.querySelector("#tpl-h").addEventListener("change",t=>{a.height=parseInt(t.target.value)||1080,s.height=a.height,r(),m()});async function L(){a.name=l.querySelector("#tpl-name").value||"Untitled Template",await $(a),w&&(w.textContent="Saved"),v?.({variant:"success",title:"Template saved"})}l.querySelector("#tpl-save-btn").addEventListener("click",L),l.querySelector("#tpl-back").addEventListener("click",async()=>{await L(),k("#tpl")}),l.querySelector("#tpl-name").addEventListener("input",m),b(),r()}async function W(l,g){const s=new URLSearchParams(g.split("?")[1]||"").get("id");s?await D(l,s):await I(l)}let T=!1;function A(){if(T)return;T=!0;const l=document.createElement("style");l.textContent=`
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
  `,document.head.appendChild(l)}export{W as render};
