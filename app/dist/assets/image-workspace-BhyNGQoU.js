const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/info-modal-c7GOmgUS.js","assets/image-info-RCB_TI9T.js","assets/ai-bgremoval-CLcXU_4U.js","assets/folders-Dd6tun-c.js","assets/index-Cvca53V-.js","assets/index-B3Ki0sLy.css"])))=>i.map(i=>d[i]);
import{_ as h}from"./ai-bgremoval-CLcXU_4U.js";import{i as u,e as f}from"./video-frame-DqH3KaHz.js";class v{constructor(e,i={}){this.container=e,this.options=Object.assign({allowFolder:!0,allowUpload:!0,onRender:async t=>({beforeUrl:URL.createObjectURL(t),afterUrl:URL.createObjectURL(t),beforeLabel:"Original",afterLabel:"Result",context:null}),onInfo:async(t,s,a)=>{const{renderFileInfoModal:l}=await h(async()=>{const{renderFileInfoModal:n}=await import("./info-modal-c7GOmgUS.js");return{renderFileInfoModal:n}},__vite__mapDeps([0,1,2]));l(t,s)},customControlsHtml:"",onBindCustomControls:t=>{},onFilesChange:(t,s)=>{}},i),this.files=[],this.activeFile=null,this.compareMode=localStorage.getItem("ic-cmp-mode")==="true",this.compareLayout=localStorage.getItem("ic-cmp-layout")||"slider",this.isZoomEnabled=localStorage.getItem("ic-zoom-enabled")==="true",this.isDraggingLayout=!1,this.lastRenderResult=null,this.initDOM(),this.bindEvents()}initDOM(){this.container.innerHTML=`
      <div class="ic-image-workspace" style="display:flex;flex-direction:column;height:100%;background:var(--ps-surface)">
        <div class="iw-header" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--ps-border)">
          <div class="iw-title" style="font-size:13px;font-weight:500;color:var(--ps-text)">Preview</div>
          <style>
             .ic-image-workspace.is-single-mode .iw-custom-controls { opacity: 0.5; pointer-events: none; }
          </style>
          <div class="iw-controls" style="display:flex;align-items:center;gap:8px">

            <div class="iw-cmp-controls" style="display:none;align-items:center;gap:8px">
              <button class="btn-icon iw-zoom-btn" title="Toggle Zoom on hover" style="color:${this.isZoomEnabled?"var(--ps-blue)":"var(--ps-text-muted)"}">
                <span class="material-symbols-outlined">search</span>
              </button>
              <button class="btn-icon iw-info-btn" title="Toggle Info metadata modal" style="color:var(--ps-text-muted)">
                <span class="material-symbols-outlined">info</span>
              </button>
              <div class="iw-mode-toggle" style="display:flex;background:var(--ps-bg);border-radius:4px;padding:2px">
                <button class="btn-icon iw-layout-single ${this.compareMode?"":"is-active"}" title="Single Preview" style="border-radius:3px;width:28px;height:28px">
                  <span class="material-symbols-outlined" style="font-size:16px">crop_square</span>
                </button>
                <button class="btn-icon iw-layout-slider ${this.compareMode&&this.compareLayout==="slider"?"is-active":""}" title="Slider" style="border-radius:3px;width:28px;height:28px">
                  <span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span>
                </button>
                <button class="btn-icon iw-layout-side ${this.compareMode&&this.compareLayout==="side"?"is-active":""}" title="Side by side" style="border-radius:3px;width:28px;height:28px">
                  <span class="material-symbols-outlined" style="font-size:16px">vertical_split</span>
                </button>
              </div>
              <div class="iw-custom-controls" style="display:flex;align-items:center">${this.options.customControlsHtml}</div>
            </div>

            <div style="display:flex;gap:8px">
              ${this.options.allowUpload?`
                <label class="btn-secondary iw-upload-label" style="cursor:pointer" title="Upload a test image">
                  <span class="material-symbols-outlined" style="font-size:14px">image</span>
                  Image
                  <input type="file" class="iw-file-input" accept="image/*" style="display:none">
                </label>
              `:""}
              ${this.options.allowFolder?`
                <button class="btn-secondary iw-folder-btn" title="Select a test folder">
                  <span class="material-symbols-outlined" style="font-size:14px">folder_open</span>
                  Folder
                </button>
              `:""}
            </div>
          </div>
        </div>
        
        <div class="iw-stage" style="flex:1;position:relative;overflow:hidden;min-height:200px">
          <div class="empty-state" style="padding:24px;text-align:center;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
             <span class="material-symbols-outlined" style="font-size:36px;color:var(--ps-text-muted)">image</span>
             <div style="font-size:12px;margin-top:8px">Drop an image here</div>
          </div>
        </div>

        <div class="iw-carousel" style="display:none;padding:12px;gap:8px;overflow-x:auto;white-space:nowrap;border-top:1px solid var(--ps-border);background:var(--ps-bg);min-height:73px"></div>
        
        <style>
          .iw-stage.iw-dragover { outline:2px dashed var(--ps-blue); outline-offset:-4px; }
          .iw-layout-slider.is-active, .iw-layout-side.is-active { background:var(--ps-surface); box-shadow:0 1px 2px rgba(0,0,0,0.1); color:var(--ps-text) !important; }
          .iw-layout-slider, .iw-layout-side { color:var(--ps-text-muted); width:24px;height:24px; }
          .iw-thumb { height:48px;width:48px;object-fit:cover;border-radius:4px;cursor:pointer;border:2px solid transparent;flex-shrink:0;background:var(--ps-bg); }
          .iw-thumb.is-active { border-color:var(--ps-blue); }
          
          .iw-cmp-wrap { position:absolute;inset:0;width:100%;height:100%;overflow:hidden; }
          .iw-cmp-img { position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;pointer-events:none; }
          .iw-cmp-handle { position:absolute;top:0;bottom:0;width:20px;margin-left:-10px;cursor:col-resize;display:flex;align-items:center;justify-content:center;z-index:10; }
          .iw-cmp-handle-line { position:absolute;top:0;bottom:0;left:9px;width:2px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,0.5); }
          .iw-cmp-handle-knob { position:relative;width:28px;height:28px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);color:#333; }
          .iw-cmp-label { position:absolute;top:10px;padding:4px 8px;background:rgba(0,0,0,0.6);color:#fff;border-radius:4px;font-size:11px;font-weight:500;z-index:5;pointer-events:none;backdrop-filter:blur(4px); }
          .iw-cmp-label--l { left:10px; }
          .iw-cmp-label--r { right:10px; }
          
          .iw-side-view { display:flex;width:100%;height:100%;overflow:hidden; }
          .iw-side { flex:1;position:relative;min-width:0;display:flex;align-items:center;justify-content:center; }
          .iw-side-img { position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block; }
          .iw-divider { width:1px;background:var(--ps-border);z-index:2; }
          .iw-side-label { position:absolute;top:10px;left:10px;padding:4px 8px;background:rgba(0,0,0,0.6);color:#fff;border-radius:4px;font-size:11px;font-weight:500;pointer-events:none;z-index:5;backdrop-filter:blur(4px); }
          .iw-side-label--blue { background:var(--ps-blue); }
          
          .iw-single-wrap { position:absolute;inset:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center; }
        </style>
      </div>
    `,this.stage=this.container.querySelector(".iw-stage"),this.carousel=this.container.querySelector(".iw-carousel"),this.cmpControls=this.container.querySelector(".iw-cmp-controls"),this.modeToggleGroup=this.container.querySelector(".iw-mode-toggle")}bindEvents(){this.container.querySelector(".iw-zoom-btn")?.addEventListener("click",e=>{this.isZoomEnabled=!this.isZoomEnabled,localStorage.setItem("ic-zoom-enabled",this.isZoomEnabled),e.currentTarget.style.color=this.isZoomEnabled?"var(--ps-blue)":"var(--ps-text-muted)",this.isZoomEnabled||this.resetZoom()}),this.stage.addEventListener("mousemove",e=>{if(!this.isZoomEnabled||this.isDraggingLayout)return;const i=this.stage.querySelector(".iw-cmp-wrap, .iw-side-view, .iw-single-wrap");if(!i)return;const t=this.stage.getBoundingClientRect(),s=(e.clientX-t.left)/t.width*100,a=(e.clientY-t.top)/t.height*100;i.style.transformOrigin=`${s}% ${a}%`,i.style.transform="scale(2)",i.style.transition="none"}),this.stage.addEventListener("mouseleave",()=>{this.isZoomEnabled&&this.resetZoom()}),this.options.onBindCustomControls&&this.options.onBindCustomControls(this.container),this.container.querySelector(".iw-layout-single")?.addEventListener("click",()=>{this.compareMode=!1,this._tempCompareMode=!1,localStorage.setItem("ic-cmp-mode","false"),this.updateLayoutToggleUI(),this.renderCurrentState()}),this.container.querySelector(".iw-layout-slider")?.addEventListener("click",()=>{this.compareLayout="slider",this.compareMode=!0,this._tempCompareMode=!0,localStorage.setItem("ic-cmp-layout","slider"),localStorage.setItem("ic-cmp-mode","true"),this.updateLayoutToggleUI(),this.renderCurrentState()}),this.container.querySelector(".iw-layout-side")?.addEventListener("click",()=>{this.compareLayout="side",this.compareMode=!0,this._tempCompareMode=!0,localStorage.setItem("ic-cmp-layout","side"),localStorage.setItem("ic-cmp-mode","true"),this.updateLayoutToggleUI(),this.renderCurrentState()}),this.container.querySelector(".iw-info-btn")?.addEventListener("click",()=>{this.activeFile&&this.lastRenderResult&&this.options.onInfo(this.activeFile,this.lastRenderResult.afterUrl,this.lastRenderResult.context)}),this.stage.addEventListener("dragover",e=>{e.preventDefault(),this.stage.classList.add("iw-dragover")}),this.stage.addEventListener("dragleave",()=>this.stage.classList.remove("iw-dragover")),this.stage.addEventListener("drop",async e=>{e.preventDefault(),this.stage.classList.remove("iw-dragover");const i=Array.from(e.dataTransfer?.files||[]).filter(t=>t.type.startsWith("image/"));i.length!==0&&this.loadFiles(i)}),this.container.querySelector(".iw-file-input")?.addEventListener("change",e=>{e.target.files?.[0]&&this.loadFiles([e.target.files[0]])}),this.container.querySelector(".iw-folder-btn")?.addEventListener("click",async()=>{try{const e=await window.showDirectoryPicker({mode:"read"}),{listImages:i}=await h(async()=>{const{listImages:s}=await import("./folders-Dd6tun-c.js");return{listImages:s}},__vite__mapDeps([3,2,4,5])),t=await i(e);t.length>0&&this.loadFiles(t)}catch(e){e.name!=="AbortError"&&console.error(e)}})}updateLayoutToggleUI(){this.container.querySelector(".iw-layout-single")?.classList.toggle("is-active",!this.compareMode),this.container.querySelector(".iw-layout-slider")?.classList.toggle("is-active",this.compareMode&&this.compareLayout==="slider"),this.container.querySelector(".iw-layout-side")?.classList.toggle("is-active",this.compareMode&&this.compareLayout==="side"),this.container.querySelector(".ic-image-workspace")?.classList.toggle("is-single-mode",!this.compareMode)}resetZoom(){const e=this.stage.querySelector(".iw-cmp-wrap, .iw-side-view, .iw-single-wrap");e&&(e.style.transform="none",e.style.transition="transform 0.1s ease")}loadFiles(e){this.files=e,this.activeFile=this.files[0],this.options.onFilesChange(this.files,this.activeFile),this.renderCarousel(),this.triggerProcess()}setFiles(e,i=0){this.files=e||[],this.activeFile=this.files[i]||this.files[0],this.options.onFilesChange(this.files,this.activeFile),this.renderCarousel(),this.triggerProcess()}async triggerProcess(){if(this.activeFile){this.stage.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%"><div class="spinner"></div></div>';try{this.lastRenderResult=await this.options.onRender(this.activeFile);const e=this.lastRenderResult?.canCompare??!0;this.modeToggleGroup&&(this.modeToggleGroup.style.display=e?"flex":"none"),!e&&this.compareMode?this._tempCompareMode=!1:this._tempCompareMode=this.compareMode,this.cmpControls.style.display="flex",this.updateLayoutToggleUI(),this.renderCurrentState()}catch(e){console.error(e),this.stage.innerHTML=`<div class="empty-state">Error: ${e.message}</div>`}}}renderCurrentState(){if(!this.lastRenderResult)return;const{beforeUrl:e,afterUrl:i,beforeLabel:t,afterLabel:s}=this.lastRenderResult;if(!(this._tempCompareMode??this.compareMode)){this.stage.innerHTML=`
        <div class="iw-single-wrap">
          <img src="${i}" class="iw-cmp-img" style="position:relative" draggable="false">
          <span class="iw-cmp-label iw-cmp-label--r" style="display:flex;align-items:center;">
             ${s||"Result"}
             <a href="${i}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
          </span>
        </div>`;return}if(this.compareLayout==="side")this.stage.innerHTML=`
        <div class="iw-side-view">
          <div class="iw-side">
            <div class="iw-side-label" style="display:flex;align-items:center;pointer-events:auto;">
               ${t||"Original"}
               <a href="${e}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
            </div>
            <img src="${e}" class="iw-side-img" draggable="false">
          </div>
          <div class="iw-divider"></div>
          <div class="iw-side">
            <div class="iw-side-label iw-side-label--blue" style="display:flex;align-items:center;pointer-events:auto;">
               ${s||"Result"}
               <a href="${i}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
            </div>
            <img src="${i}" class="iw-side-img" draggable="false">
          </div>
        </div>`;else{this.stage.innerHTML=`
        <div class="iw-cmp-wrap" id="iw-cmp-wrap">
          <img class="iw-cmp-img" id="iw-cmp-before" src="${e}" draggable="false" style="clip-path:inset(0 50% 0 0)">
          <img class="iw-cmp-img" id="iw-cmp-after" src="${i}" draggable="false" style="clip-path:inset(0 0 0 50%)">
          <div class="iw-cmp-handle" id="iw-cmp-handle" style="left:50%">
            <div class="iw-cmp-handle-line"></div>
            <div class="iw-cmp-handle-knob"><span class="material-symbols-outlined" style="font-size:18px">swap_horiz</span></div>
          </div>
          <span class="iw-cmp-label iw-cmp-label--l" style="display:flex;align-items:center;pointer-events:auto;">
             ${t||"Original"}
             <a href="${e}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
          </span>
          <span class="iw-cmp-label iw-cmp-label--r" style="display:flex;align-items:center;pointer-events:auto;">
             ${s||"Result"}
             <a href="${i}" target="_blank" title="Open in new tab" style="color:inherit;text-decoration:none;display:flex;margin-left:6px;"><span class="material-symbols-outlined" style="font-size:14px;">open_in_new</span></a>
          </span>
        </div>`;const l=this.stage.querySelector("#iw-cmp-wrap"),n=this.stage.querySelector("#iw-cmp-handle"),m=this.stage.querySelector("#iw-cmp-before"),g=this.stage.querySelector("#iw-cmp-after"),r=o=>{const c=l.getBoundingClientRect(),d=Math.max(.01,Math.min(.99,(o-c.left)/c.width)),p=(d*100).toFixed(1);n.style.left=`${p}%`,m.style.clipPath=`inset(0 ${(100-d*100).toFixed(1)}% 0 0)`,g.style.clipPath=`inset(0 0 0 ${p}%)`};n.addEventListener("mousedown",o=>{this.isDraggingLayout=!0,o.preventDefault()}),window.addEventListener("mousemove",o=>{this.isDraggingLayout&&r(o.clientX)}),window.addEventListener("mouseup",()=>{this.isDraggingLayout=!1}),n.addEventListener("touchstart",o=>{this.isDraggingLayout=!0,o.preventDefault()},{passive:!1}),window.addEventListener("touchmove",o=>{this.isDraggingLayout&&r(o.touches[0].clientX)},{passive:!0}),window.addEventListener("touchend",()=>{this.isDraggingLayout=!1})}}renderCarousel(){if(this.files.length<=1||!this.options.allowFolder){this.carousel.style.display="none";return}this.carousel.style.display="flex",this.carousel.innerHTML="";const e=Math.min(this.files.length,50);for(let i=0;i<e;i++){const t=this.files[i],s=document.createElement("img");if(s.className=`iw-thumb ${t===this.activeFile?"is-active":""}`,u(t))f(t).then(a=>{a.toBlob(l=>{l&&(s.src=URL.createObjectURL(l))},"image/jpeg",.8)}).catch(()=>{s.src=""});else{const a=URL.createObjectURL(t);s.src=a,s.onload=()=>URL.revokeObjectURL(a)}s.addEventListener("click",()=>{this.activeFile=t,this.options.onFilesChange(this.files,this.activeFile),this.carousel.querySelectorAll(".iw-thumb").forEach(a=>a.classList.remove("is-active")),s.classList.add("is-active"),this.triggerProcess()}),this.carousel.appendChild(s)}}}export{v as ImageWorkspace};
