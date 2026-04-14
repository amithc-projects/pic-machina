const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/templates-B6ijJcCq.js","assets/index-Cvca53V-.js","assets/ai-bgremoval-CLcXU_4U.js","assets/index-B3Ki0sLy.css","assets/misc-BYzs6oS8.js"])))=>i.map(i=>d[i]);
import{_ as v}from"./ai-bgremoval-CLcXU_4U.js";function o(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function g(e,d,p="rp"){const t=`${p}-param-${e.name}`,a=d??e.defaultValue??"";switch(e.type){case"boolean":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${t}">${o(e.label)}</label>
          <label class="ned-toggle">
            <input type="checkbox" id="${t}" name="${e.name}" ${a?"checked":""}>
            <span class="ned-toggle-track"></span>
          </label>
        </div>`;case"video-layout-select":case"template-select":case"select":const s=e.type==="template-select"?"ic-input ic-template-select":e.type==="video-layout-select"?"ic-input ic-video-layout-select":"ic-input";return`
        <div class="ned-field">
          <label class="ned-field-label" for="${t}">${o(e.label)}</label>
          <select id="${t}" name="${e.name}" class="${s}" data-value="${o(String(a))}">
            ${(e.options||[]).map(n=>`<option value="${o(n.value)}" ${n.value==a?"selected":""}>${o(n.label)}</option>`).join("")}
          </select>
        </div>`;case"range":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${t}">${o(e.label)}
            <span id="${t}-val" class="mono text-sm" style="margin-left:auto;color:var(--ps-blue)">${a}</span>
          </label>
          <input type="range" id="${t}" name="${e.name}" class="ic-range"
            min="${e.min??0}" max="${e.max??100}" step="${e.step??1}" value="${a}">
        </div>`;case"color":{let n="";try{v(()=>import("./settings-4MvqzOHa.js"),[]).then(i=>{}).catch(()=>{}),n=(JSON.parse(localStorage.getItem("ic-settings"))?.palette||[{label:"Black",color:"#000000"},{label:"White",color:"#ffffff"},{label:"Pink",color:"#f472b6"},{label:"Blue",color:"#3b82f6"}]).map(i=>`
          <div class="ned-saved-color" data-color="${i.color}" style="background:${i.color}; width:20px; height:20px; border-radius:4px; border:1px solid rgba(255,255,255,0.2); cursor:pointer;" title="${i.label}"></div>
        `).join("")}catch{}return`
        <div class="ned-field">
          <label class="ned-field-label" for="${t}">${o(e.label)}</label>
          <div class="ned-color-row" style="margin-bottom:4px;">
            <input type="color" id="${t}" name="${e.name}" value="${a}" class="ned-color-input">
            <input type="text" id="${t}-hex" class="ic-input" value="${a}" maxlength="7"
              style="flex:1;font-family:var(--font-mono);font-size:12px">
          </div>
          <div class="ned-saved-colors-wrap" id="${t}-saved-wrap" style="display:flex; gap:4px; flex-wrap:wrap;">
            ${n}
            <button class="btn-ghost" title="Manage Swatches..." onclick="document.querySelector('#nav-settings')?.click()" style="padding:0; min-height:20px; width:20px; height:20px; margin-left:2px; border-radius:4px; background:var(--ps-bg-overlay);">
               <span class="material-symbols-outlined" style="font-size:14px; color:var(--ps-text-muted);">settings</span>
            </button>
          </div>
        </div>`}case"number":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${t}">${o(e.label)}</label>
          <input type="number" id="${t}" name="${e.name}" class="ic-input"
            value="${a}" ${e.min!=null?`min="${e.min}"`:""} ${e.max!=null?`max="${e.max}"`:""}
            ${e.step!=null?`step="${e.step}"`:""}>
        </div>`;case"textarea":return`
        <div class="ned-field">
          <label class="ned-field-label" for="${t}">${o(e.label)}</label>
          <textarea id="${t}" name="${e.name}" class="ic-input" rows="4">${o(String(a))}</textarea>
        </div>`;default:return`
        <div class="ned-field">
          <label class="ned-field-label" for="${t}">${o(e.label)}</label>
          <input type="text" id="${t}" name="${e.name}" class="ic-input" value="${o(String(a))}">
        </div>`}}function $(e,d,p="rp"){const t={};for(const a of d){const s=`${p}-param-${a.name}`,n=e.querySelector(`#${s}`);n&&(a.type==="boolean"?t[a.name]=n.checked:a.type==="range"||a.type==="number"?t[a.name]=parseFloat(n.value):t[a.name]=n.value)}return t}let f=!1;function m(){if(f||typeof document>"u")return;f=!0;const e=document.createElement("style");e.textContent=`
    .ned-field { display:flex; flex-direction:column; gap:4px; margin-bottom:2px; }
    .ned-field-label { font-size:12px; font-weight:500; color:var(--ps-text-muted); display:flex; align-items:center; gap:4px; }
    .ned-toggle { display:flex; align-items:center; cursor:pointer; width:fit-content; }
    .ned-toggle input[type=checkbox] { display:none; }
    .ned-toggle-track {
      width:36px; height:20px; border-radius:10px; background:var(--ps-bg-overlay);
      border:1px solid var(--ps-border); position:relative; transition:background 150ms;
    }
    .ned-toggle input:checked + .ned-toggle-track { background:var(--ps-blue); border-color:var(--ps-blue); }
    .ned-toggle-track::after {
      content:''; position:absolute; top:3px; left:3px;
      width:12px; height:12px; border-radius:50%; background:#fff; transition:transform 150ms;
    }
    .ned-toggle input:checked + .ned-toggle-track::after { transform:translateX(16px); }
    .ned-color-row { display:flex; align-items:center; gap:8px; }
    .ned-color-input { width:36px; height:32px; padding:2px; border:1px solid var(--ps-border); border-radius:6px; background:var(--ps-bg-app); cursor:pointer; }
    .ic-range { width:100%; accent-color:var(--ps-blue); }
  `,document.head.appendChild(e)}function x(e,d,p="rp"){for(const s of d){const n=`${p}-param-${s.name}`;if(s.type==="range"){const l=e.querySelector(`#${n}`),i=e.querySelector(`#${n}-val`);l&&i&&l.addEventListener("input",()=>{i.textContent=l.value})}if(s.type==="color"){const l=e.querySelector(`#${n}`),i=e.querySelector(`#${n}-hex`),r=e.querySelector(`#${n}-saved-wrap`);l&&i&&(l.addEventListener("input",()=>{i.value=l.value}),i.addEventListener("input",()=>{/^#[0-9a-f]{6}$/i.test(i.value)&&(l.value=i.value)}),r&&r.addEventListener("click",c=>{if(c.target.classList.contains("ned-saved-color")){const u=c.target.getAttribute("data-color");l.value=u,i.value=u,l.dispatchEvent(new Event("input",{bubbles:!0})),l.dispatchEvent(new Event("change",{bubbles:!0}))}}))}}const t=e.querySelectorAll(".ic-template-select"),a=e.querySelectorAll(".ic-video-layout-select");(t.length>0||a.length>0)&&v(async()=>{const{getAllTemplates:s}=await import("./templates-B6ijJcCq.js");return{getAllTemplates:s}},__vite__mapDeps([0,1,2,3,4])).then(({getAllTemplates:s})=>{s().then(n=>{t.forEach(l=>{const i=l.dataset.value||l.value;let r='<option value="">-- Select Template --</option>';n.forEach(c=>{r+=`<option value="${c.id}" ${c.id===i?"selected":""}>${o(c.name)}</option>`}),l.innerHTML=r}),a.forEach(l=>{const i=l.dataset.value||l.value;let r=l.innerHTML;n.length>0&&(r+='<optgroup label="Templates">',n.forEach(c=>{r+=`<option value="${c.id}" ${c.id===i?"selected":""}>${o(c.name)}</option>`}),r+="</optgroup>"),l.innerHTML=r,i&&(l.value=i)})})})}export{x as b,$ as c,m as i,g as r};
