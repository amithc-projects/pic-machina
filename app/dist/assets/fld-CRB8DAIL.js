const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/assets-C7EZRbUi.js","assets/ai-bgremoval-CLcXU_4U.js","assets/index-Cvca53V-.js","assets/index-B3Ki0sLy.css","assets/image-workspace-BhyNGQoU.js","assets/video-frame-DqH3KaHz.js"])))=>i.map(i=>d[i]);
import{_ as Z}from"./ai-bgremoval-CLcXU_4U.js";import{a as Pe}from"./runs-BVDshokl.js";import{getFolder as ne,pickFolder as ke,loadVideoPreviews as De,writeVideoPreview as Le}from"./folders-Dd6tun-c.js";import{e as Be}from"./video-frame-DqH3KaHz.js";import{j as Ve}from"./recipes-C3zZWtxZ.js";import{i as ze,n as K}from"./index-Cvca53V-.js";import{b as X}from"./misc-BYzs6oS8.js";import{i as We,g as Ge,r as Ke}from"./image-info-RCB_TI9T.js";import{ingestFile as Te,setSidecarField as Xe}from"./assets-C7EZRbUi.js";import{s as Ye}from"./dialogs-CUir_jZ5.js";let Ee=!1;function _e(){if(Ee)return;Ee=!0;const s=document.createElement("style");s.textContent=`
    .ap-panel {
      display: flex; flex-direction: column; height: 100%; overflow-y: auto;
      padding: 12px; gap: 12px; font-size: 13px; color: var(--ps-text);
      box-sizing: border-box;
    }
    .ap-section {
      background: var(--ps-bg-surface);
      border: 1px solid var(--ps-border);
      border-radius: 10px;
      overflow: hidden;
    }
    .ap-section-head {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px;
      font-size: 11px; font-weight: 600; letter-spacing: .04em;
      text-transform: uppercase; color: var(--ps-text-muted);
      background: var(--ps-bg-app);
      border-bottom: 1px solid var(--ps-border);
      cursor: pointer; user-select: none;
    }
    .ap-section-head .material-symbols-outlined { font-size: 14px; }
    .ap-section-head .ap-chevron { margin-left: auto; font-size: 14px; transition: transform 200ms; }
    .ap-section-head.is-collapsed .ap-chevron { transform: rotate(-90deg); }
    .ap-section-body { padding: 4px 0; }
    .ap-section.is-collapsed .ap-section-body { display: none; }
    .ap-row {
      display: grid; grid-template-columns: 120px 1fr;
      gap: 4px 8px; align-items: start;
      padding: 5px 12px;
    }
    .ap-row:hover { background: var(--ps-bg-hover); }
    .ap-key {
      font-size: 11px; color: var(--ps-text-muted); font-weight: 500;
      padding-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .ap-val {
      font-size: 12px; color: var(--ps-text);
      word-break: break-word; line-height: 1.4;
    }
    .ap-val-muted { color: var(--ps-text-faint); font-style: italic; }
    .ap-ocr-text {
      padding: 8px 12px; font-size: 11px; font-family: var(--font-mono);
      color: var(--ps-text-muted); line-height: 1.5;
      max-height: 100px; overflow-y: auto;
      background: var(--ps-bg-app); border-top: 1px solid var(--ps-border);
    }

    /* Editable sidecar rows */
    .ap-sidecar-row {
      display: grid; grid-template-columns: 110px 1fr auto;
      gap: 4px 6px; align-items: center; padding: 4px 8px;
    }
    .ap-sidecar-row:hover { background: var(--ps-bg-hover); }
    .ap-sidecar-key, .ap-sidecar-val {
      background: transparent; border: 1px solid transparent;
      border-radius: 5px; padding: 3px 6px; font-size: 12px;
      color: var(--ps-text); width: 100%; box-sizing: border-box;
      font-family: inherit;
      transition: border-color 120ms, background 120ms;
    }
    .ap-sidecar-key { color: var(--ps-text-muted); font-weight: 500; font-size: 11px; }
    .ap-sidecar-val:hover, .ap-sidecar-val:focus,
    .ap-sidecar-key:hover, .ap-sidecar-key:focus {
      border-color: var(--ps-blue); background: var(--ps-bg-app); outline: none;
    }
    .ap-sidecar-del {
      background: transparent; border: none; cursor: pointer;
      color: var(--ps-text-faint); display: flex; align-items: center;
      border-radius: 4px; padding: 2px; opacity: 0; transition: opacity 120ms;
    }
    .ap-sidecar-del .material-symbols-outlined { font-size: 14px; }
    .ap-sidecar-row:hover .ap-sidecar-del { opacity: 1; }
    .ap-sidecar-del:hover { color: #e55; background: rgba(220,50,50,.1); }
    .ap-add-row {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; border-top: 1px solid var(--ps-border);
      margin-top: 2px;
    }
    .ap-add-key, .ap-add-val {
      flex: 1; background: var(--ps-bg-app); border: 1px solid var(--ps-border);
      border-radius: 5px; padding: 4px 8px; font-size: 12px;
      color: var(--ps-text); font-family: inherit;
    }
    .ap-add-key:focus, .ap-add-val:focus { outline: none; border-color: var(--ps-blue); }
    .ap-add-key { max-width: 110px; }
    .ap-add-btn {
      background: var(--ps-blue); border: none; color: #fff; cursor: pointer;
      border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600;
      white-space: nowrap; flex-shrink: 0;
    }
    .ap-add-btn:hover { filter: brightness(1.1); }
    .ap-empty { padding: 10px 12px; font-size: 12px; color: var(--ps-text-faint); font-style: italic; }
    .ap-hash { font-family: var(--font-mono); font-size: 10px; color: var(--ps-text-faint); padding: 6px 12px 8px; }
    .ap-loading { display:flex; align-items:center; justify-content:center; height:100%; gap:8px; }
    .ap-save-badge {
      font-size:10px; color: var(--ps-green, #22c55e); font-weight:600;
      margin-left: 6px; opacity: 0; transition: opacity 400ms;
    }
    .ap-save-badge.is-visible { opacity: 1; }
  `,document.head.appendChild(s)}function j(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Y(s){return s?new Date(s).toLocaleString(void 0,{dateStyle:"medium",timeStyle:"short"}):""}function J(s,o,p,c=!1){const u=document.createElement("div");return u.className=`ap-section${c?" is-collapsed":""}`,u.innerHTML=`
    <div class="ap-section-head">
      <span class="material-symbols-outlined">${j(s)}</span>
      ${j(o)}
      <span class="material-symbols-outlined ap-chevron">expand_more</span>
    </div>
    <div class="ap-section-body">${p}</div>
  `,u.querySelector(".ap-section-head").addEventListener("click",()=>{u.classList.toggle("is-collapsed")}),u}function y(s,o){return o==null||o===""?"":`<div class="ap-row"><div class="ap-key">${j(s)}</div><div class="ap-val">${j(String(o))}</div></div>`}let Se=!1;function Je(){if(Se)return;Se=!0;const s=document.createElement("style");s.textContent=`
    .ii-copy-row { display:flex; align-items:baseline; gap:4px; }
    .ii-copy-val { flex:1; }
    .ii-copy-btn {
      flex-shrink:0; background:none; border:none; cursor:pointer;
      color:var(--ps-text-faint); padding:0 2px; border-radius:3px;
      display:inline-flex; align-items:center; opacity:0; transition:opacity 120ms;
    }
    .ii-copy-btn .material-symbols-outlined { font-size:11px; }
    tr:hover .ii-copy-btn { opacity:1; }
    .ii-copy-btn:hover { color:var(--ps-blue); background:var(--ps-bg-hover); }
    .ii-copy-btn.did-copy { color:var(--ps-green, #22c55e); opacity:1; }
    .img-info-extracted-heading {
      padding:10px 14px 4px;
      font-size:11px; font-weight:700; letter-spacing:.06em;
      text-transform:uppercase; color:var(--ps-text-faint);
      border-top:1px solid var(--ps-border);
    }
  `,document.head.appendChild(s)}function Qe(s){const o=document.createElement("button");return o.className="ii-copy-btn",o.title=`Copy ${s}`,o.innerHTML='<span class="material-symbols-outlined">content_copy</span>',o.addEventListener("click",p=>{p.stopPropagation(),navigator.clipboard.writeText(s).then(()=>{o.classList.add("did-copy"),o.innerHTML='<span class="material-symbols-outlined">check</span>',setTimeout(()=>{o.classList.remove("did-copy"),o.innerHTML='<span class="material-symbols-outlined">content_copy</span>'},1400)})}),o}function _(s,o,p,c){if(p==null||p===""||p===0&&c!=="{{sidecar.faceCount}}")return;const u=document.createElement("tr"),x=document.createElement("td");x.className="img-info-key",x.textContent=o;const v=document.createElement("td");v.className="img-info-val";const n=document.createElement("span");n.className="ii-copy-row";const r=document.createElement("span");r.className="ii-copy-val",r.textContent=String(p),n.appendChild(r),c&&n.appendChild(Qe(c)),v.appendChild(n),u.appendChild(x),u.appendChild(v),s.appendChild(u)}function Q(s,o,p){if(!p.rows.length)return null;const c=document.createElement("details");c.open=!0,c.className="img-info-section";const u=document.createElement("summary");return u.className="img-info-section-title",u.innerHTML=`<span class="material-symbols-outlined" style="font-size:13px">${j(o)}</span> ${j(s)}`,c.appendChild(u),c.appendChild(p),c}async function Ze(s){Je();try{await ze();const o=await Te(s),p=n=>n.geo||n.ocr||n.vision||Object.keys(n.sidecar??{}).length;if(!p(o)){const{getAssetsByFilename:n}=await Z(async()=>{const{getAssetsByFilename:w}=await import("./assets-C7EZRbUi.js");return{getAssetsByFilename:w}},__vite__mapDeps([0,1,2,3])),r=await n(s.name),m=w=>[w.geo,w.ocr,w.vision].filter(Boolean).length+Object.keys(w.sidecar??{}).length,b=r.sort((w,U)=>m(U)-m(w))[0];b&&m(b)>0&&Object.assign(o,{geo:o.geo??b.geo,ocr:o.ocr??b.ocr,vision:o.vision??b.vision,sidecar:Object.keys(o.sidecar??{}).length?o.sidecar:b.sidecar??{},exif:Object.keys(o.exif??{}).length?o.exif:b.exif??{}})}if(!p(o))return null;const c=document.createDocumentFragment(),u=document.createElement("div");if(u.className="img-info-extracted-heading",u.textContent="Extracted Metadata",c.appendChild(u),o.geo){const n=document.createElement("table");n.className="img-info-table";const r=o.geo;_(n,"Location",r.location,"{{sidecar.location}}"),_(n,"City",r.city,"{{sidecar.city}}"),_(n,"State",r.state,"{{sidecar.state}}"),_(n,"Country",r.country,"{{sidecar.country}}"),_(n,"Road",r.road,"{{sidecar.road}}"),_(n,"Postcode",r.postcode,"{{sidecar.postcode}}");const m=Q("Geocode","location_on",n);m&&c.appendChild(m)}if(o.ocr){const n=document.createElement("table");n.className="img-info-table";const r=o.ocr;r.tags?.length&&_(n,"Tags",r.tags.join(", "),"{{sidecar.ocrTags}}"),r.text&&_(n,"Text",r.text.slice(0,120)+(r.text.length>120?"…":""),"{{sidecar.ocrText}}");const m=Q("OCR Text","text_fields",n);m&&c.appendChild(m)}if(o.vision){const n=document.createElement("table");n.className="img-info-table";const r=o.vision;r.peopleLabel&&_(n,"People",r.peopleLabel,"{{sidecar.peopleLabel}}"),r.personCount!=null&&_(n,"Persons",r.personCount,"{{sidecar.personCount}}"),r.faceCount!=null&&_(n,"Faces",r.faceCount,"{{sidecar.faceCount}}"),r.poseLabel&&_(n,"Pose",r.poseLabel,"{{sidecar.poseLabel}}");const m=Q("Vision / People","group",n);m&&c.appendChild(m)}const x=Object.keys(o.sidecar??{});if(x.length){const n=document.createElement("table");n.className="img-info-table";for(const m of x)_(n,m,o.sidecar[m],`{{sidecar.${m}}}`);const r=Q("Custom Fields","edit_note",n);r&&c.appendChild(r)}const v=document.createElement("div");return v.appendChild(c),v}catch{return null}}async function et(s){_e();const o=document.createElement("div");return o.className="ap-panel",o.innerHTML='<div class="ap-loading"><div class="spinner"></div><span class="text-sm text-muted">Loading metadata…</span></div>',tt(s,o),o}async function tt(s,o){try{await ze();const p=await Te(s);if(!(u=>u.geo||u.ocr||u.vision||Object.keys(u.sidecar??{}).length)(p)){const{getAssetsByFilename:u}=await Z(async()=>{const{getAssetsByFilename:r}=await import("./assets-C7EZRbUi.js");return{getAssetsByFilename:r}},__vite__mapDeps([0,1,2,3])),x=await u(s.name),v=r=>[r.geo,r.ocr,r.vision].filter(Boolean).length+Object.keys(r.sidecar??{}).length,n=x.sort((r,m)=>v(m)-v(r))[0];n&&v(n)>0&&Object.assign(p,{geo:p.geo??n.geo,ocr:p.ocr??n.ocr,vision:p.vision??n.vision,sidecar:Object.keys(p.sidecar??{}).length?p.sidecar:n.sidecar??{},exif:Object.keys(p.exif??{}).length?p.exif:n.exif??{}})}o.innerHTML="",o.appendChild(at(p,s))}catch(p){o.innerHTML=`<div class="ap-empty">Failed to load metadata: ${j(p.message)}</div>`}}function at(s,o){const p=document.createDocumentFragment(),c=s.exif??{},u=[y("Date",c.date),y("Camera",[c.cameraMake,c.cameraModel].filter(Boolean).join(" ")),y("Exposure",c.exposure),y("Aperture",c.aperture?`f/${c.aperture}`:null),y("ISO",c.iso),y("Focal Length",c.focalLength),y("Author",c.author),y("Copyright",c.copyright),y("Description",c.description),c.gps?y("GPS",`${c.gps.lat.toFixed(5)}, ${c.gps.lng.toFixed(5)}`):""].join("");u.trim()&&p.appendChild(J("camera","EXIF",u));const x=s.geo;if(x){const b=[y("Location",x.location),y("City",x.city),y("County",x.county),y("State",x.state),y("Country",x.country),y("Postcode",x.postcode),y("Road",x.road),y("Suburb",x.suburb),y("Geocoded",Y(x.geocodedAt))].join("");p.appendChild(J("location_on","Geocode",b))}const v=s.ocr;if(v){let b="";v.tags?.length&&(b+=y("Tags",v.tags.join(", "))),b+=y("Words",v.words?.length),b+=y("OCR date",Y(v.ocrAt)),v.text&&(b+=`<div class="ap-ocr-text">${j(v.text.slice(0,500))}${v.text.length>500?"…":""}</div>`),p.appendChild(J("text_fields","OCR Text",b))}const n=s.vision;if(n){const b=[y("People",n.peopleLabel),y("Persons",n.personCount!=null?String(n.personCount):null),y("Faces",n.faceCount!=null?String(n.faceCount):null),y("Pose",n.poseLabel),y("Analysed",Y(n.detectedAt))].join("");p.appendChild(J("group","Vision / People",b))}p.appendChild(st(s));const r=document.createElement("div");r.className="ap-hash",r.textContent=`hash: ${s.hash.slice(0,16)}…  ·  ingested: ${Y(s.ingestedAt)}`,p.appendChild(r);const m=document.createElement("div");return m.style.cssText="display:contents",m.appendChild(p),m}function st(s){const o=document.createElement("div");o.className="ap-section",o.innerHTML=`
    <div class="ap-section-head">
      <span class="material-symbols-outlined">edit_note</span>
      Custom Metadata
      <span class="ap-save-badge" id="ap-save-badge">Saved</span>
      <span class="material-symbols-outlined ap-chevron">expand_more</span>
    </div>
    <div class="ap-section-body" id="ap-sidecar-body"></div>
  `,o.querySelector(".ap-section-head").addEventListener("click",m=>{o.classList.toggle("is-collapsed")});const p=o.querySelector("#ap-sidecar-body"),c=o.querySelector("#ap-save-badge");let u={...s.sidecar??{}};function x(){c.classList.add("is-visible"),clearTimeout(c._t),c._t=setTimeout(()=>c.classList.remove("is-visible"),1800)}async function v(m,b){try{await Xe(s.hash,m,b),u[m]=b,x()}catch(w){console.error("[asset-panel] save failed:",w)}}async function n(m){delete u[m];try{const{patchAsset:b}=await Z(async()=>{const{patchAsset:w}=await import("./assets-C7EZRbUi.js");return{patchAsset:w}},__vite__mapDeps([0,1,2,3]));await b(s.hash,{sidecar:{...u}}),x()}catch(b){console.error("[asset-panel] delete failed:",b)}r()}function r(){p.innerHTML="";const m=Object.keys(u);if(m.length===0){const k=document.createElement("div");k.className="ap-empty",k.textContent="No custom fields yet. Add one below.",p.appendChild(k)}else for(const k of m){const z=document.createElement("div");z.className="ap-sidecar-row",z.innerHTML=`
          <input class="ap-sidecar-key" value="${j(k)}" readonly title="${j(k)}">
          <input class="ap-sidecar-val" value="${j(u[k]??"")}">
          <button class="ap-sidecar-del" title="Delete field">
            <span class="material-symbols-outlined">delete</span>
          </button>
        `;const E=z.querySelector(".ap-sidecar-val");E.addEventListener("change",()=>v(k,E.value)),E.addEventListener("keydown",A=>{A.key==="Enter"&&E.blur()}),z.querySelector(".ap-sidecar-del").addEventListener("click",()=>n(k)),p.appendChild(z)}const b=document.createElement("div");b.className="ap-add-row",b.innerHTML=`
      <input class="ap-add-key" placeholder="field name" spellcheck="false">
      <input class="ap-add-val" placeholder="value">
      <button class="ap-add-btn">Add</button>
    `;const w=b.querySelector(".ap-add-key"),U=b.querySelector(".ap-add-val");b.querySelector(".ap-add-btn").addEventListener("click",async()=>{const k=w.value.trim().replace(/\s+/g,"_"),z=U.value;if(!k){w.focus();return}u[k]=z,await v(k,z),w.value="",U.value="",r()}),U.addEventListener("keydown",k=>{k.key==="Enter"&&b.querySelector(".ap-add-btn").click()}),p.appendChild(b)}return r(),o}const Re=new Set([".jpg",".jpeg",".png",".webp",".gif",".tif",".tiff",".bmp",".heic"]),re=new Set([".mp4",".mov",".webm"]);function S(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function P(s){return s.slice(s.lastIndexOf(".")).toLowerCase()}function q(s){const o=P(s);return Re.has(o)?"image":re.has(o)?"video":"other"}async function Ce(s){const o=[];for await(const[p,c]of s.entries()){if(c.kind!=="file"||p.startsWith("."))continue;const u=P(p);(Re.has(u)||re.has(u))&&o.push({file:await c.getFile(),handle:c})}return o.sort((p,c)=>p.file.name.localeCompare(c.file.name))}async function bt(s,o){const p=new URLSearchParams((o||"").split("?")[1]||""),c=p.get("run"),u=p.get("from")||"out",x=u==="que"?"out":u,v=c?await Pe(c):null;let n=null,r=!1;if(!c)if(n=await ne("browse").catch(()=>null),n)r=!0;else{s.innerHTML=`
        <div class="screen">
          <div class="screen-header">
            <div class="screen-title">
              <span class="material-symbols-outlined">folder_open</span>
              Folder Viewer
            </div>
          </div>
          <div class="screen-body" style="align-items:center;justify-content:center">
            <div class="empty-state">
              <span class="material-symbols-outlined" style="font-size:48px">folder_open</span>
              <div class="empty-state-title">No folder selected</div>
              <div class="empty-state-desc">Open a folder to browse its contents, or go to Output History to view a completed batch run.</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px">
                <button class="btn-primary" id="fld-browse-folder">
                  <span class="material-symbols-outlined">folder_open</span> Open Folder
                </button>
                <button class="btn-secondary" id="fld-go-out">
                  <span class="material-symbols-outlined">history</span> Output History
                </button>
              </div>
            </div>
          </div>
        </div>`,s.querySelector("#fld-go-out")?.addEventListener("click",()=>K("#out")),s.querySelector("#fld-browse-folder")?.addEventListener("click",async()=>{try{await ke("browse"),K("#fld")}catch(e){e.name!=="AbortError"&&console.error(e)}});return}s.innerHTML=`
    <div class="screen fld-screen">
      <div class="fld-toolbar">
        <button class="btn-icon" id="fld-back" title="Back">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="fld-breadcrumb">
          ${r?`<span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-text-muted)">folder_open</span>
               <span class="fld-crumb-recipe">${S(n.name)}</span>`:`<span class="fld-crumb-recipe">${S(v?.recipeName||"Output")}</span>
               <span class="material-symbols-outlined fld-crumb-sep">chevron_right</span>
               <span class="fld-crumb-folder">${S(v?.outputFolder||"output")}/</span>`}
        </div>

        <div style="flex:1"></div>

        ${r?`<button class="btn-secondary btn-sm" id="fld-change-folder" style="margin-right:8px">
          <span class="material-symbols-outlined" style="font-size:16px">folder_open</span> Change Folder
        </button>`:""}

        <div id="fld-selection-actions" class="flex items-center gap-1" style="margin-right:8px">
          <button class="btn-secondary btn-sm" id="fld-btn-select-all" title="Select all visible items">
            <span class="material-symbols-outlined" style="font-size:16px">done_all</span>
            Select All
          </button>
          <button class="btn-secondary btn-sm" id="fld-btn-deselect-all" title="Deselect all">
            Deselect
          </button>
          <button class="btn-secondary btn-sm" id="fld-btn-delete-sel" title="Delete selected items from disk">
            <span class="material-symbols-outlined" style="font-size:18px;color:var(--ps-red)">delete</span>
          </button>
          <div style="width:1px;height:20px;background:var(--ps-border);margin:0 4px"></div>
        </div>

        <div class="fld-view-toggle" role="group">
          <button class="fld-view-btn is-active" data-fld-view="grid" title="Grid view">
            <span class="material-symbols-outlined">grid_view</span>
          </button>
          <button class="fld-view-btn" data-fld-view="filmstrip" title="Filmstrip view">
            <span class="material-symbols-outlined">view_carousel</span>
          </button>
          <button class="fld-view-btn" data-fld-view="list" title="List view">
            <span class="material-symbols-outlined">view_list</span>
          </button>
        </div>

        <button class="btn-secondary btn-sm" id="fld-btn-slideshow" title="Play Slideshow" style="margin-left:8px">
          <span class="material-symbols-outlined" style="font-size:18px">play_circle</span>
          Slideshow
        </button>
        <div class="fld-sort-row">
          <select id="fld-sort" class="ic-input" style="font-size:12px;padding:5px 8px;height:32px">
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="size">Size</option>
          </select>
        </div>
        <div class="fld-filter-chips" id="fld-filter-chips">
          <button class="fld-chip is-active" data-filter="all">All</button>
          <button class="fld-chip" data-filter="image">
            <span class="material-symbols-outlined" style="font-size:12px">image</span>
            Images
          </button>
          <button class="fld-chip" data-filter="video">
            <span class="material-symbols-outlined" style="font-size:12px">movie</span>
            Video
          </button>
          <button class="fld-chip" data-filter="other">Other</button>
        </div>
      </div>

      <div class="fld-body" id="fld-body">
        <div class="fld-main" id="fld-main">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;gap:10px">
            <div class="spinner spinner--lg"></div>
            <span class="text-sm text-muted">Loading files…</span>
          </div>
        </div>
        <div class="fld-resize-handle" id="fld-resize-handle" style="display:none"></div>
        <div class="fld-detail" id="fld-detail" style="display:none"></div>
      </div>
    </div>`,it(),We(),s.querySelector("#fld-back")?.addEventListener("click",()=>K(`#${x}`)),s.querySelector("#fld-change-folder")?.addEventListener("click",async()=>{try{await ke("browse"),K("#fld")}catch(e){e.name!=="AbortError"&&console.error(e)}});let m=null,b=[],w=new Map,U=!1,k=[],z=new Map,E=[],A=localStorage.getItem("ic-view-mode")||"filmstrip",ee="all",te="name",M=null,T=new Set,I=-1;localStorage.getItem("ic-cmp-mode");let C=[],ae=null,F=0,de=3e3,R=!1;s.querySelectorAll("[data-fld-view]").forEach(e=>{e.addEventListener("click",()=>{A=e.dataset.fldView,localStorage.setItem("ic-view-mode",A),s.querySelectorAll("[data-fld-view]").forEach(a=>a.classList.toggle("is-active",a===e)),ue()})}),s.querySelectorAll("[data-fld-view]").forEach(e=>{e.classList.toggle("is-active",e.dataset.fldView===A)}),s.querySelectorAll("[data-filter]").forEach(e=>{e.addEventListener("click",()=>{ee=e.dataset.filter,s.querySelectorAll("[data-filter]").forEach(a=>a.classList.toggle("is-active",a===e)),G()})}),s.querySelector("#fld-sort")?.addEventListener("change",e=>{te=e.target.value,G()}),s.querySelector("#fld-btn-select-all")?.addEventListener("click",()=>{E.forEach(e=>T.add(e.file.name)),V()}),s.querySelector("#fld-btn-deselect-all")?.addEventListener("click",()=>{T.clear(),V()}),s.querySelector("#fld-btn-delete-sel")?.addEventListener("click",qe);const O=s.querySelector("#fld-detail"),D=s.querySelector("#fld-resize-handle"),ce="ic-fld-detail-width";let B=Math.max(220,Math.min(700,parseInt(localStorage.getItem(ce))||340));function pe(e){B=Math.max(220,Math.min(700,e)),O&&(O.style.width=B+"px",O.style.minWidth=B+"px")}function se(){D&&(D.style.display=""),O&&(O.style.display="flex"),pe(B)}let W=!1;D?.addEventListener("mousedown",e=>{W=!0,D.classList.add("is-dragging"),document.body.style.cursor="col-resize",document.body.style.userSelect="none",e.preventDefault()});function fe(e){if(!W)return;const a=s.querySelector("#fld-body");a&&pe(a.getBoundingClientRect().right-e.clientX)}function me(){W&&(W=!1,D?.classList.remove("is-dragging"),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(ce,String(B)))}document.addEventListener("mousemove",fe),document.addEventListener("mouseup",me),s.querySelector("#fld-btn-slideshow")?.addEventListener("click",()=>{const e=E.filter(a=>q(a.file.name)==="image");if(!e.length){window.AuroraToast?.show({variant:"warning",title:"No images to show"});return}Ie(e)});try{let e;if(r)e=n;else{let i=v?.outputHandleObj||await ne("output");if(!i){ie("Output folder not accessible. Grant permission in Batch Setup.");return}const d=v?.outputFolder||"output";try{e=await i.getDirectoryHandle(d)}catch{ie(`Subfolder "${d}" not found.`);return}}m=e,[b,w]=await Promise.all([Ce(e),De(e)]);const a=await ne("input").catch(()=>null);if(a)try{k=[];for await(const[,i]of a.entries())i.kind==="file"&&k.push(await i.getFile());for(const i of k){const d=i.name.replace(/\.[^.]+$/,"");z.set(d,i),z.set(d.replace(/_[a-z0-9]+$/i,""),i)}}catch{}const t={image:0,video:0,other:0};b.forEach(i=>{const d=q(i.file.name);t[d]=(t[d]||0)+1}),s.querySelectorAll("[data-filter]").forEach(i=>{const d=i.dataset.filter;if(d!=="all"){const l=t[d]||0;if(l>0&&!i.querySelector(".fld-chip-count")){const f=document.createElement("span");f.className="fld-chip-count",f.textContent=l,i.appendChild(f)}}}),G()}catch(e){ie(`Error: ${e.message}`)}function ie(e){const a=s.querySelector("#fld-main");a&&(a.innerHTML=`<div class="empty-state" style="height:100%">
      <span class="material-symbols-outlined">folder_off</span>
      <div class="empty-state-title">No files</div>
      <div class="empty-state-desc">${S(e)}</div>
    </div>`)}function G(){E=b.filter(e=>ee==="all"||q(e.file.name)===ee),E.sort((e,a)=>te==="type"?q(e.file.name).localeCompare(q(a.file.name))||e.file.name.compare(a.file.name):te==="size"?a.file.size-e.file.size:e.file.name.localeCompare(a.file.name)),ue()}function ue(){oe();const e=s.querySelector("#fld-main");if(e){if(!E.length){e.innerHTML=`<div class="empty-state" style="height:100%">
        <span class="material-symbols-outlined">filter_none</span>
        <div class="empty-state-title">No files match</div>
      </div>`,V();return}A==="grid"?Ue(e):A==="filmstrip"?Fe(e):Ae(e),V(),je()}}function je(){if(U)return;const e=b.filter(a=>re.has(P(a.file.name))&&!w.has(a.file.name));e.length&&(U=!0,(async()=>{for(const a of e){try{const t=await Be(a.file),i=await new Promise(d=>t.toBlob(d,"image/jpeg",.85));if(i&&m){await Le(m,a.file.name,i);const d=await m.getFileHandle(`.${a.file.name}.preview.jpg`).then(l=>l.getFile()).catch(()=>null);d&&(w.set(a.file.name,d),be(a.file.name,d))}}catch{}await new Promise(t=>setTimeout(t,50))}U=!1})())}function be(e,a){const t=URL.createObjectURL(a);C.push(t),s.querySelectorAll(`[data-preview-pending="${CSS.escape(e)}"]`).forEach(i=>{const d=i.closest(".fld-thumb")||i.closest(".fld-fs-thumb")||i.parentElement,l=i.classList.contains("fld-thumb-vid"),h=i.classList.contains("fld-fs-thumb-img"),f=document.createElement("img");if(f.draggable=!1,f.src=t,l){f.className="fld-thumb-img",i.replaceWith(f);const g=document.createElement("button");g.className="fld-thumb-chg-preview",g.title="Change preview frame",g.dataset.name=e,g.innerHTML='<span class="material-symbols-outlined">photo_camera</span>';const L=b.find(H=>H.file.name===e);L&&g.addEventListener("click",H=>{H.stopPropagation(),ge(L)}),d?.appendChild(g)}else h?(f.className="fld-fs-thumb-img",i.replaceWith(f)):(f.className="fld-list-thumb",i.replaceWith(f))}),s.querySelectorAll(".fld-list-icon").forEach(i=>{if(i.closest("[data-fld-ent-name]")?.dataset.fldEntName===e){const l=document.createElement("img");l.className="fld-list-thumb",l.src=t,l.draggable=!1,i.replaceWith(l)}})}async function ge(e){const a=document.getElementById("fld-chg-preview-dialog");a&&a.remove();const t=document.createElement("div");t.id="fld-chg-preview-dialog",t.className="fld-modal-overlay",t.innerHTML=`
      <div class="fld-modal" style="max-width:700px;width:90vw">
        <div class="fld-modal-header">
          <strong>Change Preview Frame</strong>
          <span style="color:var(--ps-text-muted);font-size:13px;margin-left:8px">${S(e.file.name)}</span>
          <button class="btn-icon" id="fld-chg-close" style="margin-left:auto">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="fld-modal-body" style="display:flex;flex-direction:column;gap:12px;padding:16px">
          <video id="fld-chg-video" controls muted style="width:100%;border-radius:6px;background:#000;max-height:50vh"></video>
          <div style="display:flex;align-items:center;gap:10px;justify-content:flex-end">
            <span style="font-size:13px;color:var(--ps-text-muted)">Seek to the frame you want, then capture.</span>
            <button class="btn-primary" id="fld-chg-capture">
              <span class="material-symbols-outlined">photo_camera</span> Use This Frame
            </button>
          </div>
        </div>
      </div>`,document.body.appendChild(t);const i=t.querySelector("#fld-chg-video"),d=URL.createObjectURL(e.file);i.src=d,t.querySelector("#fld-chg-close").addEventListener("click",()=>{URL.revokeObjectURL(d),t.remove()}),t.addEventListener("click",l=>{l.target===t&&(URL.revokeObjectURL(d),t.remove())}),t.querySelector("#fld-chg-capture").addEventListener("click",async()=>{const l=document.createElement("canvas");l.width=i.videoWidth,l.height=i.videoHeight,l.getContext("2d").drawImage(i,0,0);const h=await new Promise(f=>l.toBlob(f,"image/jpeg",.9));if(h&&m){await Le(m,e.file.name,h);const f=await m.getFileHandle(`.${e.file.name}.preview.jpg`).catch(()=>null),g=f?await f.getFile():null;g&&(w.set(e.file.name,g),be(e.file.name,g),s.querySelectorAll(`[data-name="${CSS.escape(e.file.name)}"].fld-thumb-chg-preview`).forEach(L=>{const $=L.closest(".fld-thumb")?.querySelector(".fld-thumb-img");$&&(URL.revokeObjectURL($.src),$.src=URL.createObjectURL(g),C.push($.src))}))}URL.revokeObjectURL(d),t.remove()})}function le(e,a,t){const i=t.metaKey||t.ctrlKey;if(t.shiftKey&&I>=0){const l=Math.min(I,a),h=Math.max(I,a);for(let f=l;f<=h;f++)T.add(E[f].file.name)}else i?(T.has(e.file.name)?T.delete(e.file.name):T.add(e.file.name),I=a):(T.clear(),T.add(e.file.name),I=a,Oe(e));V()}async function qe(){const e=Array.from(T);if(!(!e.length||!await Ye({title:`Delete ${e.length} Item${e.length!==1?"s":""}?`,body:"This will permanently remove these files from your computer. This action cannot be undone.",confirmText:"Delete Forever",variant:"danger",icon:"delete_forever"})))try{if(!m)throw new Error("Folder not accessible");for(const t of e)b.find(i=>i.file.name===t)&&await m.removeEntry(t);b=await Ce(m),T.clear(),I=-1,M=null,G(),window.AuroraToast&&window.AuroraToast.show({variant:"success",title:"Files deleted",description:`Successfully removed ${e.length} item${e.length!==1?"s":""}.`})}catch(t){console.error(t),window.AuroraToast&&window.AuroraToast.show({variant:"danger",title:"Deletion failed",description:t.message})}}function V(){const e=T.size,a=s.querySelector("#fld-btn-select-all"),t=s.querySelector("#fld-btn-deselect-all"),i=s.querySelector("#fld-btn-delete-sel");a&&(a.style.display=e<E.length?"":"none"),t&&(t.style.display=e>0?"":"none"),i&&(i.disabled=e===0),s.querySelectorAll("[data-fld-ent-name]").forEach(d=>{d.classList.toggle("is-multiselected",T.has(d.dataset.fldEntName))})}function Ue(e){e.className="fld-main fld-main--grid",e.innerHTML="";const a=document.createElement("div");a.className="fld-grid",e.appendChild(a),E.forEach((t,i)=>{const d=q(t.file.name),l=document.createElement("div");l.className=`fld-cell${M?.file.name===t.file.name?" is-selected":""}`,l.dataset.idx=i,l.dataset.fldEntName=t.file.name;const h=URL.createObjectURL(t.file);C.push(h);const f=d==="video"?w.get(t.file.name):null,g=f?URL.createObjectURL(f):null;g&&C.push(g),l.innerHTML=`
        <div class="fld-thumb ${d==="video"?"fld-thumb--video":""}">
          ${d==="video"?g?`<img src="${g}" class="fld-thumb-img" draggable="false">
                 <div class="fld-thumb-video-badge"><span class="material-symbols-outlined">play_circle</span></div>
                 <button class="fld-thumb-chg-preview" title="Change preview frame" data-name="${S(t.file.name)}">
                   <span class="material-symbols-outlined">photo_camera</span>
                 </button>`:`<video src="${h}" class="fld-thumb-vid" preload="metadata" muted data-preview-pending="${S(t.file.name)}"></video>
                 <div class="fld-thumb-video-badge"><span class="material-symbols-outlined">play_circle</span></div>`:`<img src="${h}" class="fld-thumb-img" loading="lazy" draggable="false">`}
        </div>
        <div class="fld-cell-name">${S(t.file.name)}</div>`,l.querySelector(".fld-thumb-chg-preview")?.addEventListener("click",L=>{L.stopPropagation(),ge(t)}),l.addEventListener("click",L=>{le(t,i,L)}),a.appendChild(l)})}function Fe(e){e.className="fld-main fld-main--filmstrip",e.innerHTML=`
      <div class="fld-fs-preview" id="fld-fs-preview">
        <div class="empty-state" style="height:100%">
          <span class="material-symbols-outlined" style="font-size:40px">touch_app</span>
          <div class="empty-state-title">Select a file below</div>
        </div>
      </div>
      <div class="fld-fs-strip" id="fld-fs-strip"></div>`;const a=e.querySelector("#fld-fs-strip");E.forEach((t,i)=>{const d=q(t.file.name),l=document.createElement("div");l.className=`fld-fs-thumb${M?.file.name===t.file.name?" is-selected":""}`,l.dataset.idx=i,l.dataset.fldEntName=t.file.name;const h=URL.createObjectURL(t.file);C.push(h);const f=d==="video"?w.get(t.file.name):null,g=f?URL.createObjectURL(f):null;g&&C.push(g),l.innerHTML=`
        ${d==="video"?g?`<img src="${g}" class="fld-fs-thumb-img" draggable="false">
               <span class="fld-fs-video-badge material-symbols-outlined">play_circle</span>`:`<video src="${h}" class="fld-fs-thumb-img" preload="metadata" muted data-preview-pending="${S(t.file.name)}"></video>
               <span class="fld-fs-video-badge material-symbols-outlined">play_circle</span>`:`<img src="${h}" class="fld-fs-thumb-img" loading="lazy" draggable="false">`}`,l.addEventListener("click",L=>{le(t,i,L)}),a.appendChild(l)}),M&&(ve(M),se(),ye(O,M))}async function ve(e){const a=s.querySelector("#fld-fs-preview");if(!a)return;await he(a,e,!0),s.querySelector("#fld-fs-strip")?.querySelector(".fld-fs-thumb.is-selected")?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})}function Ae(e){e.className="fld-main fld-main--list",e.innerHTML=`
      <table class="fld-list-table">
        <thead>
          <tr>
            <th class="fld-list-th" style="width:40px"></th>
            <th class="fld-list-th">Name</th>
            <th class="fld-list-th" style="width:80px">Type</th>
            <th class="fld-list-th" style="width:80px">Size</th>
            <th class="fld-list-th" style="width:80px;text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody id="fld-list-body"></tbody>
      </table>`;const a=e.querySelector("#fld-list-body");E.forEach((t,i)=>{const d=q(t.file.name),l=document.createElement("tr");l.className=`fld-list-row${M?.file.name===t.file.name?" is-selected":""}`,l.dataset.idx=i,l.dataset.fldEntName=t.file.name;const h=URL.createObjectURL(t.file);C.push(h);const f=d==="video"?w.get(t.file.name):null,g=f?URL.createObjectURL(f):null;g&&C.push(g),T.has(t.file.name),l.innerHTML=`
        <td class="fld-list-td">
          ${d==="video"?g?`<img src="${g}" class="fld-list-thumb" draggable="false">`:'<div class="fld-list-icon"><span class="material-symbols-outlined" style="color:var(--ps-blue)">movie</span></div>':`<img src="${h}" class="fld-list-thumb" loading="lazy" draggable="false">`}
        </td>
        <td class="fld-list-td">
          <span class="fld-list-name">${S(t.file.name)}</span>
        </td>
        <td class="fld-list-td">${d==="video"?'<span class="ic-badge ic-badge--blue">MP4</span>':`<span class="ic-badge">${P(t.file.name).slice(1).toUpperCase()}</span>`}</td>
        <td class="fld-list-td mono text-sm text-muted">${X(t.file.size)}</td>
        <td class="fld-list-td" style="text-align:right">
          <button class="btn-icon fld-list-dl" data-idx="${i}" title="Download">
            <span class="material-symbols-outlined" style="font-size:15px">download</span>
          </button>
        </td>`,l.addEventListener("click",L=>{L.target.closest(".fld-list-dl")||le(t,i,L)}),l.querySelector(".fld-list-dl")?.addEventListener("click",L=>{L.stopPropagation(),He(t.file)}),a.appendChild(l)})}let N=null;async function Me(){if(N)return N;const{ImageWorkspace:e}=await Z(async()=>{const{ImageWorkspace:t}=await import("./image-workspace-BhyNGQoU.js");return{ImageWorkspace:t}},__vite__mapDeps([4,1,5])),a=document.createElement("div");return a.style.flex="1",a.style.display="flex",a.style.flexDirection="column",a.style.minWidth="0",a.style.minHeight="0",N=new e(a,{allowUpload:!1,allowFolder:!1,customControlsHtml:`
        <button class="btn-icon iw-meta-btn" title="View Extracted AI Metadata">
           <span class="material-symbols-outlined">edit_note</span>
        </button>
      `,onBindCustomControls:t=>{t.querySelector(".iw-meta-btn")?.addEventListener("click",async()=>{if(!N.activeFile)return;_e();const i=t.querySelector(".iw-stage");i.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div class="spinner"></div></div>';const d=await et(N.activeFile);i.innerHTML="",i.style.overflow="hidden",i.appendChild(d)})},onRender:async t=>{const i=t.name.replace(/\.[^.]+$/,""),d=i.replace(/[-_][a-z0-9]+$/i,""),l=z.get(i)||z.get(d),h=URL.createObjectURL(l||t),f=URL.createObjectURL(t);return C.push(h,f),{beforeUrl:h,afterUrl:f,beforeLabel:l?"Input":"File",afterLabel:l?"Output":"File",context:{filename:t.name},canCompare:!!l}}}),N}async function Oe(e){if(M=e,s.querySelectorAll(".fld-cell, .fld-fs-thumb, .fld-list-row").forEach(a=>{const t=parseInt(a.dataset.idx);a.classList.toggle("is-selected",E[t]===e)}),A==="filmstrip"){await ve(e),se(),ye(O,e);return}se(),await he(O,e,!1)}async function he(e,a,t){const i=a.file,d=q(i.name),l=URL.createObjectURL(i);if(C.push(l),d==="video")e.innerHTML=`
        <div class="fld-detail-inner">
          ${t?"":`
          <div class="fld-detail-header">
            <div class="fld-detail-title">${S(i.name)}</div>
            <div class="fld-detail-meta">
              <span class="ic-badge" style="background:rgba(0,119,255,.15);color:var(--ps-blue)">Video</span>
              <span class="text-sm text-muted">${X(i.size)}</span>
            </div>
          </div>`}
          <div class="fld-detail-preview" style="flex:1;display:flex;align-items:center;justify-content:center;background:#000;position:relative">
            <video src="${l}" class="fld-detail-video" controls preload="metadata"
              style="max-width:100%;max-height:100%;display:block"></video>
          </div>
          ${t?"":`
          <div class="fld-detail-footer">
            <button class="btn-secondary" style="width:100%" onclick="(function(u,n){const a=document.createElement('a');a.href=u;a.download=n;a.click()})('${l}','${S(i.name)}')">
              <span class="material-symbols-outlined">download</span> Download
            </button>
          </div>`}
        </div>`;else{const h=await Me();e.innerHTML=`
        <div class="fld-detail-inner">
          ${t?"":`
          <div class="fld-detail-header">
            <div class="fld-detail-title">${S(i.name)}</div>
            <div class="fld-detail-meta">
              <span class="ic-badge">${P(i.name).slice(1).toUpperCase()}</span>
              <span class="text-sm text-muted">${X(i.size)}</span>
            </div>
          </div>`}
          <div class="fld-detail-preview" id="fld-ws-mount" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>
          ${t?"":`
          <div class="fld-detail-footer">
            <button class="btn-secondary" style="flex:1" onclick="(function(u,n){const a=document.createElement('a');a.href=u;a.download=n;a.click()})('${l}','${S(i.name)}')">
              <span class="material-symbols-outlined">download</span> Download
            </button>
            ${v?.recipeId?`<button class="btn-secondary fld-btn-set-thumb" title="Set as recipe thumbnail">
              <span class="material-symbols-outlined">photo_library</span>
            </button>`:""}
          </div>`}
        </div>`,e.querySelector("#fld-ws-mount").appendChild(h.container),e.querySelector(".fld-btn-set-thumb")?.addEventListener("click",g=>xe(i,g.currentTarget)),h.setFiles([i])}}async function ye(e,a){const t=a.file,i=q(t.name),d=URL.createObjectURL(t);C.push(d),e.innerHTML=`
      <div class="fld-detail-inner">
        <div class="fld-detail-header">
          <div class="fld-detail-title">${S(t.name)}</div>
          <div class="fld-detail-meta">
            ${i==="video"?'<span class="ic-badge" style="background:rgba(0,119,255,.15);color:var(--ps-blue)">Video</span>':`<span class="ic-badge">${P(t.name).slice(1).toUpperCase()}</span>`}
            <span class="text-sm text-muted">${X(t.size)}</span>
          </div>
        </div>
        <div class="fld-detail-preview" id="fld-info-panel-view">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;gap:8px">
            <div class="spinner"></div><span class="text-sm text-muted">Reading metadata…</span>
          </div>
        </div>
        <div class="fld-detail-footer">
          <button class="btn-secondary" style="flex:1" onclick="(function(u,n){const a=document.createElement('a');a.href=u;a.download=n;a.click()})('${d}','${S(t.name)}')">
            <span class="material-symbols-outlined">download</span> Download
          </button>
          ${v?.recipeId?`<button class="btn-secondary fld-btn-set-thumb" title="Set as recipe thumbnail">
            <span class="material-symbols-outlined">photo_library</span>
          </button>`:""}
        </div>
      </div>`,e.querySelector(".fld-btn-set-thumb")?.addEventListener("click",g=>xe(t,g.currentTarget));const l=e.querySelector("#fld-info-panel-view");if(!l)return;const h=await Ge(t);l.innerHTML="",l.appendChild(Ke(h));const f=await Ze(t);f&&l.appendChild(f)}function He(e){const a=URL.createObjectURL(e),t=document.createElement("a");t.href=a,t.download=e.name,t.click(),setTimeout(()=>URL.revokeObjectURL(a),5e3)}async function xe(e,a){a&&(a.disabled=!0,a.innerHTML='<img src="/assets/animated_logo.gif" style="width:18px;height:18px;display:block">');try{await Ve(v.recipeId,e),window.AuroraToast?.show({variant:"success",title:"Recipe thumbnail updated",description:"The recipe card in the Library will now show this image."})}catch(t){window.AuroraToast?.show({variant:"danger",title:"Failed to set thumbnail",description:t.message})}finally{a&&(a.disabled=!1,a.innerHTML='<span class="material-symbols-outlined">photo_library</span>')}}function oe(){C.forEach(e=>URL.revokeObjectURL(e)),C=[]}function Ie(e){F=0,R=!0;const a=document.createElement("div");a.className="fld-ss-overlay",a.innerHTML=`
      <div class="fld-ss-header">
        <div class="fld-ss-title">Slideshow</div>
        <div class="fld-ss-counter">1 / ${e.length}</div>
        <div style="flex:1"></div>
        <div class="fld-ss-controls">
          <button class="fld-ss-btn" id="fld-ss-prev" title="Previous (Left Arrow)">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button class="fld-ss-btn" id="fld-ss-play" title="Play/Pause (Space)">
            <span class="material-symbols-outlined" id="fld-ss-play-icon">pause</span>
          </button>
          <button class="fld-ss-btn" id="fld-ss-next" title="Next (Right Arrow)">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
          <div class="fld-ss-sep"></div>
          <select class="fld-ss-speed" id="fld-ss-speed">
            <option value="2000">2s</option>
            <option value="3000" selected>3s</option>
            <option value="5000">5s</option>
            <option value="10000">10s</option>
          </select>
        </div>
        <button class="fld-ss-close" id="fld-ss-close" title="Close (Esc)">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="fld-ss-main" id="fld-ss-main"></div>
    `,document.body.appendChild(a);const t=a.querySelector("#fld-ss-main"),i=a.querySelector(".fld-ss-counter"),d=a.querySelector("#fld-ss-play-icon");function l($){F=($+e.length)%e.length;const Ne=e[F],we=URL.createObjectURL(Ne.file);t.innerHTML=`<img src="${we}" class="fld-ss-img">`,i.textContent=`${F+1} / ${e.length}`,setTimeout(()=>URL.revokeObjectURL(we),1e4)}function h(){R=!R,d.textContent=R?"pause":"play_arrow",R?f():g()}function f(){g(),ae=setInterval(()=>{l(F+1)},de)}function g(){clearInterval(ae)}function L(){g(),a.remove(),document.removeEventListener("keydown",H)}function H($){$.key==="Escape"&&L(),$.key===" "&&($.preventDefault(),h()),$.key==="ArrowLeft"&&(l(F-1),R&&f()),$.key==="ArrowRight"&&(l(F+1),R&&f())}a.querySelector("#fld-ss-prev").onclick=()=>{l(F-1),R&&f()},a.querySelector("#fld-ss-next").onclick=()=>{l(F+1),R&&f()},a.querySelector("#fld-ss-play").onclick=h,a.querySelector("#fld-ss-close").onclick=L,a.querySelector("#fld-ss-speed").onchange=$=>{de=parseInt($.target.value),R&&f()},document.addEventListener("keydown",H),l(0),R&&f()}return()=>{oe(),clearInterval(ae),document.removeEventListener("mousemove",fe),document.removeEventListener("mouseup",me)}}let $e=!1;function it(){if($e)return;$e=!0;const s=document.createElement("style");s.textContent=`
    .fld-screen { display:flex; flex-direction:column; height:100%; }

    /* Toolbar */
    .fld-toolbar {
      display:flex; align-items:center; gap:8px; padding:8px 14px;
      border-bottom:1px solid var(--ps-border); background:var(--ps-bg-surface);
      flex-shrink:0; flex-wrap:wrap;
    }
    .fld-breadcrumb { display:flex; align-items:center; gap:4px; min-width:0; }
    .fld-crumb-recipe { font-size:13px; font-weight:600; color:var(--ps-text); white-space:nowrap; max-width:180px; overflow:hidden; text-overflow:ellipsis; }
    .fld-crumb-sep { font-size:16px; color:var(--ps-text-faint); flex-shrink:0; }
    .fld-crumb-folder { font-size:12px; font-family:var(--font-mono); color:var(--ps-blue); white-space:nowrap; }
    .fld-view-toggle { display:flex; background:var(--ps-bg-app); border:1px solid var(--ps-border); border-radius:8px; overflow:hidden; }
    .fld-view-btn { display:flex; align-items:center; padding:6px 9px; background:transparent; border:none; color:var(--ps-text-muted); cursor:pointer; transition:background 150ms,color 150ms; }
    .fld-view-btn .material-symbols-outlined { font-size:16px; }
    .fld-view-btn.is-active { background:var(--ps-blue); color:#fff; }
    .fld-view-btn:hover:not(.is-active) { background:var(--ps-bg-hover); color:var(--ps-text); }
    .fld-sort-row select { background:var(--ps-bg-app); border:1px solid var(--ps-border); color:var(--ps-text); border-radius:6px; }
    .fld-filter-chips { display:flex; gap:4px; align-items:center; }
    .fld-chip {
      display:flex; align-items:center; gap:4px; padding:4px 10px;
      font-size:11px; font-weight:500; border-radius:20px;
      border:1px solid var(--ps-border); background:transparent;
      color:var(--ps-text-muted); cursor:pointer; transition:all 120ms;
      font-family:var(--font-primary);
    }
    .fld-chip:hover { background:var(--ps-bg-hover); color:var(--ps-text); }
    .fld-chip.is-active { background:var(--ps-blue); border-color:var(--ps-blue); color:#fff; }
    .fld-chip-count { background:rgba(255,255,255,0.2); border-radius:10px; padding:0 5px; font-size:10px; }
    .fld-chip.is-active .fld-chip-count { background:rgba(255,255,255,0.25); }

    /* Body layout */
    .fld-body { display:flex; flex:1; overflow:hidden; }

    /* Main */
    .fld-main { flex:1; overflow:auto; padding:12px; }

    /* Grid view */
    .fld-main--grid { }
    .fld-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; }
    .fld-cell {
      display:flex; flex-direction:column; gap:5px; padding:6px;
      border-radius:10px; border:2px solid transparent; cursor:pointer;
      transition:background 100ms, border-color 150ms;
    }
    .fld-cell:hover { background:var(--ps-bg-hover); }
    .fld-cell.is-selected { border-color:var(--ps-blue); background:rgba(0,119,255,0.06); }
    .fld-cell.is-multiselected, .fld-fs-thumb.is-multiselected, .fld-list-row.is-multiselected { background:rgba(0,119,255,0.12) !important; color:var(--ps-text) !important; }
    .fld-cell.is-multiselected { border-color:var(--ps-blue); }

    .fld-thumb {
      aspect-ratio:1; border-radius:8px; overflow:hidden;
      background:var(--ps-bg-surface); border:1px solid var(--ps-border);
      position:relative;
    }
    .fld-thumb--video { }
    .fld-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
    .fld-thumb-vid { width:100%; height:100%; object-fit:cover; display:block; }
    .fld-thumb-video-badge {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.4); pointer-events:none;
    }
    .fld-thumb-video-badge .material-symbols-outlined { font-size:36px; color:rgba(255,255,255,0.9); }
    .fld-thumb-chg-preview {
      position:absolute; bottom:4px; right:4px; z-index:2;
      background:rgba(0,0,0,0.6); border:none; border-radius:4px;
      color:#fff; cursor:pointer; padding:3px 5px; display:none;
      align-items:center; line-height:1;
    }
    .fld-thumb-chg-preview .material-symbols-outlined { font-size:14px; }
    .fld-thumb:hover .fld-thumb-chg-preview { display:flex; }

    /* Change-preview modal overlay (reused .fld-modal-overlay pattern) */
    .fld-modal-overlay {
      position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.65);
      backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center;
    }
    .fld-modal-overlay .fld-modal {
      background:var(--ps-bg-surface); border-radius:12px;
      border:1px solid var(--ps-border); display:flex; flex-direction:column;
      max-height:90vh; overflow:hidden;
    }
    .fld-modal-header {
      display:flex; align-items:center; gap:8px; padding:14px 16px;
      border-bottom:1px solid var(--ps-border); font-size:15px; font-weight:600;
    }
    .fld-modal-body { overflow-y:auto; }
    .fld-cell-name { font-size:10px; color:var(--ps-text-muted); font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center; }

    /* Filmstrip view */
    .fld-main--filmstrip { display:flex; flex-direction:column; padding:0; }
    .fld-fs-preview {
      flex:1; overflow:hidden; border-bottom:1px solid var(--ps-border);
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%,var(--ps-bg-app) 0% 50%) 0 0/24px 24px;
    }
    .fld-fs-strip {
      height:110px; min-height:110px; display:flex; gap:6px; overflow-x:auto; overflow-y:hidden;
      padding:8px 12px; background:var(--ps-bg-surface); align-items:center;
      scrollbar-width:thin;
    }
    .fld-fs-thumb {
      height:88px; width:88px; min-width:88px; border-radius:8px; overflow:hidden;
      border:2px solid transparent; cursor:pointer; position:relative; flex-shrink:0;
      background:var(--ps-bg-app); transition:border-color 150ms;
    }
    .fld-fs-thumb:hover { border-color:var(--ps-border); }
    .fld-fs-thumb.is-selected { border-color:var(--ps-blue); }
    .fld-fs-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
    .fld-fs-video-badge { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:28px; color:rgba(255,255,255,0.9); background:rgba(0,0,0,0.35); }

    /* List view */
    .fld-main--list { padding:0; }
    .fld-list-table { width:100%; border-collapse:collapse; }
    .fld-list-th { padding:8px 12px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--ps-text-faint); border-bottom:1px solid var(--ps-border); position:sticky; top:0; background:var(--ps-bg-surface); z-index:2; }
    .fld-list-row { cursor:pointer; transition:background 80ms; border-bottom:1px solid var(--ps-border); }

    /* Slideshow Overlay */
    .fld-ss-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:9999;
      display:flex; flex-direction:column; color:#fff; font-family:var(--font-primary);
      backdrop-filter:blur(10px);
    }
    .fld-ss-header {
      display:flex; align-items:center; padding:12px 20px; background:rgba(20,20,20,0.8);
      border-bottom:1px solid rgba(255,255,255,0.1);
    }
    .fld-ss-title { font-weight:600; font-size:14px; margin-right:15px; color:var(--ps-blue); }
    .fld-ss-counter { font-family:var(--font-mono); font-size:12px; color:rgba(255,255,255,0.5); }
    .fld-ss-controls { display:flex; align-items:center; gap:10px; }
    .fld-ss-btn {
      background:transparent; border:none; color:#fff; cursor:pointer;
      width:36px; height:36px; display:flex; align-items:center; justify-content:center;
      border-radius:50%; transition:background 150ms;
    }
    .fld-ss-btn:hover { background:rgba(255,255,255,0.1); }
    .fld-ss-btn .material-symbols-outlined { font-size:24px; }
    .fld-ss-sep { width:1px; height:20px; background:rgba(255,255,255,0.15); margin:0 5px; }
    .fld-ss-speed {
      background:transparent; border:1px solid rgba(255,255,255,0.2); color:#fff;
      font-size:11px; border-radius:5px; padding:2px 4px; outline:none;
    }
    .fld-ss-speed option { background:#222; }
    .fld-ss-close {
      background:transparent; border:none; color:rgba(255,255,255,0.6); cursor:pointer;
      margin-left:20px; transition:color 150ms;
    }
    .fld-ss-close:hover { color:#fff; }
    .fld-ss-main { flex:1; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
    .fld-ss-img { max-width:100%; max-height:100%; object-fit:contain; animation:ss-fade 400ms ease-out; }
    @keyframes ss-fade {
      from { opacity:0; transform:scale(0.98); }
      to { opacity:1; transform:scale(1); }
    }
    .fld-list-row:hover { background:var(--ps-bg-hover); }
    .fld-list-row.is-selected { background:rgba(0,119,255,0.07); }
    .fld-list-td { padding:6px 12px; vertical-align:middle; }
    .fld-list-thumb { width:36px; height:36px; object-fit:cover; border-radius:6px; display:block; }
    .fld-list-icon { width:36px; height:36px; display:flex; align-items:center; justify-content:center; }
    .fld-list-name { font-size:12px; color:var(--ps-text); font-family:var(--font-mono); }

    /* Resize handle between main and detail */
    .fld-resize-handle {
      width:5px; flex-shrink:0; cursor:col-resize;
      background:var(--ps-border);
      transition:background 120ms;
      position:relative;
    }
    .fld-resize-handle:hover, .fld-resize-handle.is-dragging {
      background:var(--ps-blue);
    }

    /* Detail panel */
    .fld-detail {
      min-width:220px; border:none;
      display:flex; flex-direction:column; overflow:hidden; flex-shrink:0;
      background:var(--ps-bg-app);
    }
    .fld-detail-inner { display:flex; flex-direction:column; height:100%; }
    .fld-detail-header { padding:12px 14px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .fld-detail-title { font-size:12px; font-weight:600; color:var(--ps-text); font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:6px; }
    .fld-detail-meta { display:flex; gap:6px; align-items:center; }
    .fld-detail-cmp-toolbar { display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid var(--ps-border); flex-shrink:0; }
    .fld-detail-preview {
      flex:1; overflow:hidden; position:relative;
      background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%,var(--ps-bg-app) 0% 50%) 0 0/20px 20px;
    }
    .fld-detail-footer { padding:10px 14px; border-top:1px solid var(--ps-border); flex-shrink:0; display:flex; gap:6px; align-items:center; }
    .fld-detail-video { background:#000; }


    .fld-modal {
      border:none; border-radius:16px; padding:0; background:var(--ps-bg-surface);
      box-shadow:0 24px 80px rgba(0,0,0,0.5); color:var(--ps-text);
      width:360px; max-width:90vw; outline:none;
    }
    .fld-modal::backdrop { background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); }
    .fld-modal-content { padding:24px; display:flex; flex-direction:column; align-items:center; text-align:center; }
    .fld-modal-icon {
      width:56px; height:56px; border-radius:28px; display:flex; align-items:center; justify-content:center;
      margin-bottom:16px;
    }
    .fld-modal-icon--danger { background:rgba(239,68,68,0.1); color:#ef4444; }
    .fld-modal-icon .material-symbols-outlined { font-size:32px; }
    .fld-modal-title { font-size:18px; font-weight:700; margin-bottom:8px; }
    .fld-modal-body { font-size:14px; color:var(--ps-text-muted); line-height:1.5; margin-bottom:24px; }
    .fld-modal-footer { display:flex; gap:12px; width:100%; }
    .fld-modal-footer button { flex:1; justify-content:center; padding:10px; }
  `,document.head.appendChild(s)}export{bt as render};
