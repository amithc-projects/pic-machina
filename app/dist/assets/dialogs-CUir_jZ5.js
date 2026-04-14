async function u({title:d,body:r,confirmText:_="Confirm",cancelText:t="Cancel",variant:a="danger",icon:s="help"}){return new Promise(g=>{const e=document.createElement("dialog");e.className=`ic-dialog ic-dialog--${a}`,e.innerHTML=`
      <div class="ic-dialog__content">
        <div class="ic-dialog__icon-wrap">
          <span class="material-symbols-outlined ic-dialog__icon">${s}</span>
        </div>
        <div class="ic-dialog__body-wrap">
          <h2 class="ic-dialog__title">${d}</h2>
          <p class="ic-dialog__body">${r}</p>
        </div>
        <div class="ic-dialog__actions">
          <button class="btn-secondary ic-dialog__btn-cancel" value="cancel">${t}</button>
          <button class="btn-${a} ic-dialog__btn-confirm" value="confirm">${_}</button>
        </div>
      </div>
    `,document.body.appendChild(e),e.showModal(),a==="danger"?e.querySelector(".ic-dialog__btn-cancel").focus():e.querySelector(".ic-dialog__btn-confirm").focus();const l=i=>{e.close(),g(i),setTimeout(()=>e.remove(),300)};e.querySelector(".ic-dialog__btn-cancel").onclick=()=>l(!1),e.querySelector(".ic-dialog__btn-confirm").onclick=()=>l(!0),e.addEventListener("cancel",i=>{i.preventDefault(),l(!1)}),e.addEventListener("click",i=>{i.target===e&&l(!1)})})}async function b({title:d,body:r,btn1Text:_="Leave Gap",btn1Value:t="leave",btn2Text:a="Shift Sequence",btn2Value:s="shift",cancelText:g="Cancel",variant:e="primary",icon:l="format_list_numbered"}){return new Promise(i=>{const c=document.createElement("dialog");c.className=`ic-dialog ic-dialog--${e}`,c.innerHTML=`
      <div class="ic-dialog__content">
        <div class="ic-dialog__icon-wrap">
          <span class="material-symbols-outlined ic-dialog__icon">${l}</span>
        </div>
        <div class="ic-dialog__body-wrap">
          <h2 class="ic-dialog__title">${d}</h2>
          <p class="ic-dialog__body">${r}</p>
        </div>
        <div class="ic-dialog__actions" style="flex-wrap: wrap;">
          <button class="btn-secondary ic-dialog__btn-cancel" style="flex: 1 1 100%; margin-bottom: 8px;" value="cancel">${g}</button>
          <button class="btn-secondary ic-dialog__btn-1" style="flex: 1" value="${t}">${_}</button>
          <button class="btn-${e} ic-dialog__btn-2" style="flex: 1" value="${s}">${a}</button>
        </div>
      </div>
    `,document.body.appendChild(c),c.showModal();const o=n=>{c.close(),i(n),setTimeout(()=>c.remove(),300)};c.querySelector(".ic-dialog__btn-cancel").onclick=()=>o("cancel"),c.querySelector(".ic-dialog__btn-1").onclick=()=>o(t),c.querySelector(".ic-dialog__btn-2").onclick=()=>o(s),c.addEventListener("cancel",n=>{n.preventDefault(),o("cancel")}),c.addEventListener("click",n=>{n.target===c&&o("cancel")})})}export{b as a,u as s};
