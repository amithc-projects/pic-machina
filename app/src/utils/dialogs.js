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
