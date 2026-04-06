/**
 * PicMachina — Dialog Utilities
 *
 * Provides premium, Aurora-styled custom dialogs (confirm/alert) 
 * using the native HTML5 <dialog> element.
 */

/**
 * Shows a custom confirm dialog. Returns a Promise<boolean>.
 * 
 * @param {Object} options
 * @param {string} options.title - Dialog title
 * @param {string} options.body - Detailed message body
 * @param {string} [options.confirmText='Confirm'] - Label for the primary action button
 * @param {string} [options.cancelText='Cancel'] - Label for the cancel button
 * @param {string} [options.variant='danger'] - 'danger' | 'warning' | 'primary'
 * @param {string} [options.icon='help'] - Material Symbols icon name
 */
export async function showConfirm({ 
  title, 
  body, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  variant = 'danger',
  icon = 'help'
}) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = `ic-dialog ic-dialog--${variant}`;
    
    dialog.innerHTML = `
      <div class="ic-dialog__content">
        <div class="ic-dialog__icon-wrap">
          <span class="material-symbols-outlined ic-dialog__icon">${icon}</span>
        </div>
        <div class="ic-dialog__body-wrap">
          <h2 class="ic-dialog__title">${title}</h2>
          <p class="ic-dialog__body">${body}</p>
        </div>
        <div class="ic-dialog__actions">
          <button class="btn-secondary ic-dialog__btn-cancel" value="cancel">${cancelText}</button>
          <button class="btn-${variant} ic-dialog__btn-confirm" value="confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    dialog.showModal();

    // Auto-focus the cancel button for safety on 'danger' variant
    if (variant === 'danger') {
      dialog.querySelector('.ic-dialog__btn-cancel').focus();
    } else {
      dialog.querySelector('.ic-dialog__btn-confirm').focus();
    }

    const handleClose = (res) => {
      dialog.close();
      resolve(res);
      setTimeout(() => dialog.remove(), 300); // Wait for fade-out animation
    };

    dialog.querySelector('.ic-dialog__btn-cancel').onclick = () => handleClose(false);
    dialog.querySelector('.ic-dialog__btn-confirm').onclick = () => handleClose(true);
    
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      handleClose(false);
    });

    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) handleClose(false);
    });
  });
}

/**
 * Shows a custom alert dialog. Returns a Promise<void>.
 * 
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.body
 * @param {string} [options.confirmText='OK']
 * @param {string} [options.variant='primary']
 * @param {string} [options.icon='info']
 */
export async function showAlert({ 
  title, 
  body, 
  confirmText = 'OK', 
  variant = 'primary',
  icon = 'info'
}) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = `ic-dialog ic-dialog--${variant}`;
    
    dialog.innerHTML = `
      <div class="ic-dialog__content">
        <div class="ic-dialog__icon-wrap">
          <span class="material-symbols-outlined ic-dialog__icon">${icon}</span>
        </div>
        <div class="ic-dialog__body-wrap">
          <h2 class="ic-dialog__title">${title}</h2>
          <p class="ic-dialog__body">${body}</p>
        </div>
        <div class="ic-dialog__actions">
          <button class="btn-${variant} ic-dialog__btn-confirm" style="width:100%; justify-content:center" value="confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    dialog.showModal();

    const handleClose = () => {
      dialog.close();
      resolve();
      setTimeout(() => dialog.remove(), 300);
    };

    dialog.querySelector('.ic-dialog__btn-confirm').onclick = () => handleClose();
    dialog.addEventListener('cancel', handleClose);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) handleClose(); });
  });
}

/**
 * Shows a custom 3-button confirm dialog. Returns a Promise resolving to a string action.
 * 
 * @param {Object} options
 * @param {string} options.title - Dialog title
 * @param {string} options.body - Detailed message body
 * @param {string} [options.btn1Text='Leave Gap']
 * @param {string} [options.btn1Value='leave']
 * @param {string} [options.btn2Text='Shift Sequence']
 * @param {string} [options.btn2Value='shift']
 * @param {string} [options.cancelText='Cancel']
 * @param {string} [options.variant='primary']
 * @param {string} [options.icon='format_list_numbered']
 */
export async function showThreeWayConfirm({ 
  title, 
  body, 
  btn1Text = 'Leave Gap', 
  btn1Value = 'leave',
  btn2Text = 'Shift Sequence',
  btn2Value = 'shift',
  cancelText = 'Cancel', 
  variant = 'primary',
  icon = 'format_list_numbered'
}) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = `ic-dialog ic-dialog--${variant}`;
    
    dialog.innerHTML = `
      <div class="ic-dialog__content">
        <div class="ic-dialog__icon-wrap">
          <span class="material-symbols-outlined ic-dialog__icon">${icon}</span>
        </div>
        <div class="ic-dialog__body-wrap">
          <h2 class="ic-dialog__title">${title}</h2>
          <p class="ic-dialog__body">${body}</p>
        </div>
        <div class="ic-dialog__actions" style="flex-wrap: wrap;">
          <button class="btn-secondary ic-dialog__btn-cancel" style="flex: 1 1 100%; margin-bottom: 8px;" value="cancel">${cancelText}</button>
          <button class="btn-secondary ic-dialog__btn-1" style="flex: 1" value="${btn1Value}">${btn1Text}</button>
          <button class="btn-${variant} ic-dialog__btn-2" style="flex: 1" value="${btn2Value}">${btn2Text}</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    dialog.showModal();

    const handleClose = (res) => {
      dialog.close();
      resolve(res);
      setTimeout(() => dialog.remove(), 300);
    };

    dialog.querySelector('.ic-dialog__btn-cancel').onclick = () => handleClose('cancel');
    dialog.querySelector('.ic-dialog__btn-1').onclick = () => handleClose(btn1Value);
    dialog.querySelector('.ic-dialog__btn-2').onclick = () => handleClose(btn2Value);
    
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      handleClose('cancel');
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) handleClose('cancel');
    });
  });
}
