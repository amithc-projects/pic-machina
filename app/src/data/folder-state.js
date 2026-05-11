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
/**
 * @param {Object}      [opts]
 * @param {Function}    [opts.onWorkspace]       Extra callback after trackWorkspaceChange.
 * @param {Function}    [opts.onFileFocus]        Extra callback after setSelectedFile.
 * @param {Function}    [opts.onReady]            Extra callback after setRoot (before restore navigate).
 * @param {boolean}     [opts.skipSubPathRestore] When true, don't restore the shared subPath on ready.
 * @param {boolean}     [opts.skipTracking]       When true, don't update shared _subPath / _selectedFilename
 *                                                on workspace/file-focus events. Use for read-only contexts
 *                                                (e.g. browsing a run's output folder) that should not
 *                                                interfere with the user's input-folder navigation state.
 * @param {string}      [opts.navigateTo]         Path to navigate into immediately after setRoot fires
 *                                                (used for history context to land inside output subfolder).
 */
export function wireFolderState(sk, getHandle, {
  onWorkspace, onFileFocus, onReady,
  skipSubPathRestore = false,
  skipTracking = false,
  navigateTo = null,
} = {}) {
  // ── Ongoing navigation tracking ──────────────────────────
  sk.addEventListener('sidekick:workspace', (e) => {
    if (!skipTracking) trackWorkspaceChange(e.detail.folderName, e.detail.pathLength);
    onWorkspace?.(e);
  });

  sk.addEventListener('sidekick:file-focus', (e) => {
    if (!skipTracking) setSelectedFile(e.detail?.filename || null);
    onFileFocus?.(e);
  });

  // ── Restore on ready ─────────────────────────────────────
  sk.addEventListener('sidekick:ready', async () => {
    const handle = await getHandle().catch(() => null);
    if (!handle) return;

    const { subPath, selectedFilename } = getFolderState();

    // After setRoot the sidekick fires a workspace event for the root (pathLength=1).
    // Use that event as the signal to issue any pending navigate call.
    const pendingPath = skipSubPathRestore ? (navigateTo || null) : null;
    const pendingRestore = !skipSubPathRestore && (subPath.length > 0 || selectedFilename);

    // Pre-commit + register onRoot BEFORE calling setRoot so the listener
    // is guaranteed to be in place when the workspace event fires.
    if (!skipTracking && pendingRestore) {
      // Pre-commit so workspace tracking stays correct during navigation
      setFolderPath(subPath);
    }

    if (pendingPath || pendingRestore) {
      const pathStr = pendingPath ?? subPath.join('/');
      const selFile = pendingRestore ? selectedFilename : null;

      const onRoot = (e) => {
        if (e.detail?.pathLength !== 1) return;
        sk.removeEventListener('sidekick:workspace', onRoot);
        if (pathStr) {
          sk.navigate(pathStr, selFile ? { filename: selFile } : undefined).catch(() => {});
        }
      };
      sk.addEventListener('sidekick:workspace', onRoot);
    }

    sk.setRoot(handle);
    onReady?.(handle);
  }, { once: true });
}
