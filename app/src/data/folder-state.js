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
try {
  const saved = localStorage.getItem('ic-folder-subpath');
  if (saved) _subPath = JSON.parse(saved);
} catch (e) {}

/**
 * Stable snapshot of _subPath taken just before each screen swap (in main.js doSwap).
 * The sidekick's React app resets its path stack to [] when unmounting, firing a
 * workspace event that corrupts _subPath WHILE the element is still connected — so
 * isConnected guards can't help. _committedSubPath is written before teardown and
 * is therefore immune to the unmount event.
 */
let _committedSubPath = [..._subPath];

/** Last focused filename, or null */
let _selectedFilename = null;
try {
  _selectedFilename = localStorage.getItem('ic-folder-selectedFile');
} catch (e) {}

/**
 * Call from a sidekick:workspace listener to keep the path in sync.
 *   folderName = e.detail.folderName
 *   pathLength = e.detail.pathLength
 *   pathNames  = e.detail.pathNames  (optional — full names array from sidekick,
 *                                     index 0 is the root, rest are sub-path segments)
 *
 * When pathNames is provided (sidekick v2+) we can set _subPath directly and
 * accurately, even when the sidekick jumps multiple levels at once (e.g. during
 * a navigate('a/b/c') call that fires a single workspace event at depth 4).
 */
export function trackWorkspaceChange(folderName, pathLength, pathNames, label = '?', rootHandle = null) {
  const before = [..._subPath];
  if (Array.isArray(pathNames)) {
    _subPath = pathNames.slice(1);
  } else if (pathLength === 1) {
    _subPath = [];
  } else if (pathLength > _subPath.length + 1) {
    _subPath.push(folderName);
  } else if (pathLength <= _subPath.length) {
    _subPath = _subPath.slice(0, pathLength - 1);
  }
  
  if (rootHandle) {
    if (pathLength === 1) {
      console.log(`[folder-state] SET ROOT [${label}] → [${rootHandle.name}]`);
    }
    import('./folders.js').then(m => m.setCurrentFolder(rootHandle)).catch(() => {});
  }

  if (JSON.stringify(before) !== JSON.stringify(_subPath)) {
    console.log(`[folder-state] WRITE [${label}] subPath: [${before.join('/')}] → [${_subPath.join('/')}]`);
    try { localStorage.setItem('ic-folder-subpath', JSON.stringify(_subPath)); } catch (e) {}
  }
}

/**
 * Directly assign the path array — call before sk.navigate() during restore
 * so that subsequent workspace tracking events stay in sync.
 */
export function setFolderPath(pathArray) {
  console.log(`[folder-state] SET PATH → [${pathArray.join('/')}]`);
  _subPath = [...pathArray];
}

/**
 * Call from a sidekick:file-focus listener.
 */
export function setSelectedFile(filename) {
  _selectedFilename = filename || null;
  try {
    if (filename) localStorage.setItem('ic-folder-selectedFile', filename);
    else localStorage.removeItem('ic-folder-selectedFile');
  } catch (e) {}
}

/**
 * Clear all tracked folder state — call after picking a new root folder so
 * other screens don't try to restore a stale subfolder path.
 */
export function resetFolderState() {
  console.log(`[folder-state] RESET (was [${_subPath.join('/')}])`);
  _subPath = [];
  _committedSubPath = [];
  _selectedFilename = null;
  try {
    localStorage.removeItem('ic-folder-subpath');
    localStorage.removeItem('ic-folder-selectedFile');
  } catch (e) {}
}

/**
 * Snapshot _subPath into _committedSubPath. Call this from main.js immediately
 * before clearing the old screen's DOM, so the stable snapshot is captured
 * before the outgoing sidekick's React unmount can corrupt _subPath.
 */
export function commitFolderState() {
  _committedSubPath = [..._subPath];
  console.log(`[folder-state] COMMIT [${_committedSubPath.join('/')}]`);
}

/**
 * Returns a snapshot of the current folder state.
 */
export function getFolderState(label = '?') {
  console.log(`[folder-state] READ [${label}] committed=[${_committedSubPath.join('/')}] live=[${_subPath.join('/')}] file=${_selectedFilename}`);
  return {
    subPath: [..._committedSubPath],
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
  label = '?',
} = {}) {
  // ── Ongoing navigation tracking ──────────────────────────
  sk.addEventListener('sidekick:workspace', (e) => {
    // Ignore workspace events from a sidekick that is being torn down — the
    // React app inside resets its path stack to [] on unmount, which would
    // corrupt the shared state right before the next screen reads it.
    if (!skipTracking && sk.isConnected) {
      trackWorkspaceChange(e.detail.folderName, e.detail.pathLength, e.detail.pathNames, label, e.detail.rootHandle);
    }
    onWorkspace?.(e);
  });

  sk.addEventListener('sidekick:file-focus', (e) => {
    if (!skipTracking) setSelectedFile(e.detail?.filename || null);
    onFileFocus?.(e);
  });

  // ── Restore on ready ─────────────────────────────────────
  sk.addEventListener('sidekick:ready', async () => {
    console.log(`[folder-state] READY [${label}]`);
    const handle = await getHandle().catch(() => null);
    if (!handle) { console.log(`[folder-state] READY [${label}] — no handle, skipping restore`); return; }

    const { subPath, selectedFilename } = getFolderState(label);
    const targetPath = skipSubPathRestore
      ? (navigateTo || null)
      : (subPath.length > 0 ? subPath.join('/') : null);
    const targetFile = skipSubPathRestore ? null : selectedFilename;

    console.log(`[folder-state] RESTORE [${label}] root="${handle.name}" targetPath="${targetPath}" file="${targetFile}"`);

    await new Promise(resolve => {
      if (!targetPath) {
        sk.setRoot(handle);
        resolve();
        return;
      }
      const onRoot = (e) => {
        if (e.detail?.pathLength !== 1) return;
        sk.removeEventListener('sidekick:workspace', onRoot);
        console.log(`[folder-state] RESTORE [${label}] root confirmed, navigating to "${targetPath}"`);
        sk.navigate(targetPath, targetFile ? { filename: targetFile } : undefined)
          .catch(err => console.warn(`[folder-state] RESTORE [${label}] navigate failed`, err))
          .finally(resolve);
      };
      sk.addEventListener('sidekick:workspace', onRoot);
      sk.setRoot(handle);
    });

    console.log(`[folder-state] RESTORE [${label}] done`);
    onReady?.(handle);
  }, { once: true });
}
