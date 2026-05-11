/**
 * Shared in-memory folder navigation state — shared across fld, set, ned, bld.
 *
 * Tracks the current sub-folder path below the persisted root so that
 * switching between screens restores the exact folder the user was in.
 *
 * Root handle persistence: IndexedDB via folders.js setCurrentFolder().
 * Sub-path tracking: module-level in-memory (intentionally cleared on full
 * page reload, because FSA handles also need re-permission after reload).
 *
 * Usage pattern in each screen:
 *
 *   // 1. Track navigations
 *   sk.addEventListener('sidekick:workspace', (e) => {
 *     trackWorkspaceChange(e.detail.folderName, e.detail.pathLength);
 *   });
 *
 *   // 2. Track selected file
 *   sk.addEventListener('sidekick:file-focus', (e) => {
 *     setSelectedFile(e.detail?.filename || null);
 *   });
 *
 *   // 3. On ready, restore state
 *   sk.addEventListener('sidekick:ready', async () => {
 *     const initHandle = await getFolder('input').catch(() => null);
 *     if (!initHandle) return;
 *     const { subPath, selectedFilename } = getFolderState();
 *     sk.setRoot(initHandle);
 *     if (subPath.length > 0 || selectedFilename) {
 *       // Pre-commit so workspace tracking during restore stays correct
 *       setFolderPath(subPath);
 *       const onRoot = (e) => {
 *         if (e.detail?.pathLength !== 1) return;
 *         sk.removeEventListener('sidekick:workspace', onRoot);
 *         const pathStr = subPath.join('/');
 *         sk.navigate(pathStr, selectedFilename ? { filename: selectedFilename } : undefined)
 *           .catch(() => {});
 *       };
 *       sk.addEventListener('sidekick:workspace', onRoot);
 *     }
 *   }, { once: true });
 */

/**
 * Map a pic-machina recipe's `inputType` field to the comma-separated
 * `allowed-types` attribute string consumed by <sidekick-manager>.
 *
 *   recipe.inputType  | allowed-types
 *   ──────────────────┼─────────────────────
 *   'image'           | 'images'
 *   'video'           | 'video'
 *   'any' / undefined | 'images,video,audio'
 *
 * @param {object|null} recipe    Recipe object (may be null).
 * @param {object}      [override] Optional { videoOnly: boolean } to force video-only
 *                                 (used by ned.js when a node is video-specific).
 * @returns {string|null}         Comma-separated types, or null if no constraint.
 */
export function allowedTypesAttrForRecipe(recipe, override) {
  if (override?.videoOnly) return 'video';
  if (!recipe) return null;
  if (recipe.inputType === 'image') return 'images';
  if (recipe.inputType === 'video') return 'video';
  return 'images,video,audio';
}

/** Current sub-path segments below the persisted root, e.g. ['events', '2024'] */
let _subPath = [];

/** Last focused filename, or null */
let _selectedFilename = null;

/**
 * Call from a sidekick:workspace listener to keep the path in sync.
 *   folderName = e.detail.folderName
 *   pathLength = e.detail.pathLength
 */
export function trackWorkspaceChange(folderName, pathLength) {
  if (pathLength === 1) {
    // At root — clear sub-path
    _subPath = [];
  } else if (pathLength > _subPath.length + 1) {
    // Navigated one level deeper (double-click on a subfolder)
    _subPath.push(folderName);
  } else if (pathLength <= _subPath.length) {
    // Navigated up (breadcrumb click or back) — truncate
    _subPath = _subPath.slice(0, pathLength - 1);
  }
  // pathLength === _subPath.length + 1 → no-op (same location, folder refreshed)
}

/**
 * Directly assign the path array — call before sk.navigate() during restore
 * so that subsequent workspace tracking events stay in sync.
 */
export function setFolderPath(pathArray) {
  _subPath = [...pathArray];
}

/**
 * Call from a sidekick:file-focus listener.
 */
export function setSelectedFile(filename) {
  _selectedFilename = filename || null;
}

/**
 * Returns a snapshot of the current folder state.
 */
export function getFolderState() {
  return {
    subPath: [..._subPath],
    selectedFilename: _selectedFilename,
  };
}

/**
 * Wire folder-state tracking + restoration onto a sidekick-manager element.
 *
 * @param {HTMLElement} sk        The <sidekick-manager> element.
 * @param {Function}    getHandle Async fn that returns the root FileSystemDirectoryHandle.
 * @param {Object}      [opts]
 * @param {Function}    [opts.onWorkspace]    Extra callback after trackWorkspaceChange.
 * @param {Function}    [opts.onFileFocus]    Extra callback after setSelectedFile.
 * @param {Function}    [opts.onReady]        Extra callback after setRoot (before restore navigate).
 */
export function wireFolderState(sk, getHandle, { onWorkspace, onFileFocus, onReady, skipSubPathRestore = false } = {}) {
  // ── Ongoing navigation tracking ──────────────────────────
  sk.addEventListener('sidekick:workspace', (e) => {
    trackWorkspaceChange(e.detail.folderName, e.detail.pathLength);
    onWorkspace?.(e);
  });

  sk.addEventListener('sidekick:file-focus', (e) => {
    setSelectedFile(e.detail?.filename || null);
    onFileFocus?.(e);
  });

  // ── Restore on ready ─────────────────────────────────────
  sk.addEventListener('sidekick:ready', async () => {
    const handle = await getHandle().catch(() => null);
    if (!handle) return;

    const { subPath, selectedFilename } = getFolderState();
    sk.setRoot(handle);
    onReady?.(handle);

    if (!skipSubPathRestore && (subPath.length > 0 || selectedFilename)) {
      // Pre-commit so workspace tracking stays correct during navigation
      setFolderPath(subPath);
      const onRoot = (e) => {
        if (e.detail?.pathLength !== 1) return;
        sk.removeEventListener('sidekick:workspace', onRoot);
        const pathStr = subPath.join('/');
        sk.navigate(pathStr || '', selectedFilename ? { filename: selectedFilename } : undefined)
          .catch(() => {});
      };
      sk.addEventListener('sidekick:workspace', onRoot);
    }
  }, { once: true });
}
