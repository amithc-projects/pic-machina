/**
 * ImageChef — Batch runner (main thread side)
 *
 * Spawns the Web Worker, coordinates file writes via File System Access API,
 * and routes progress/log messages to the run record.
 */

import { writeFile, getOrCreateOutputSubfolder } from '../data/folders.js';
import { createRun, updateRun, appendLog }        from '../data/runs.js';
import { getAllBlocks }                            from '../data/blocks.js';

let _worker = null;

function getWorker() {
  if (!_worker) {
    _worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  }
  return _worker;
}

/**
 * Start a batch job.
 *
 * @param {object} opts
 * @param {object}   opts.recipe         — full recipe object with nodes
 * @param {File[]}   opts.files          — input File array
 * @param {FileSystemDirectoryHandle} opts.outputHandle — output folder handle
 * @param {string}   opts.subfolder      — sub-folder name (default 'output')
 * @param {function} opts.onProgress     — (processed, total, filename) => void
 * @param {function} opts.onLog          — (level, msg) => void
 * @param {function} opts.onComplete     — (run) => void
 * @param {function} opts.onError        — (msg) => void
 * @returns {{ cancel: function, runId: string }}
 */
export async function startBatch({ recipe, files, outputHandle, subfolder = 'output', onProgress, onLog, onComplete, onError }) {
  // Resolve output subfolder
  const subHandle = await getOrCreateOutputSubfolder(outputHandle, subfolder);

  // Resolve all block definitions for inlining in the worker
  const allBlocks   = await getAllBlocks();
  const blocksById  = Object.fromEntries(allBlocks.map(b => [b.id, b]));

  // Create run record
  const run = await createRun({
    recipeId:     recipe.id,
    recipeName:   recipe.name,
    inputFolder:  '',
    outputFolder: subfolder,
    imageCount:   files.length,
  });

  const worker = getWorker();

  worker.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (payload.runId !== run.id) return;

    if (type === 'PROGRESS') {
      run.successCount = payload.processed; // approximate
      onProgress?.(payload.processed, payload.total, payload.filename);
    }

    if (type === 'LOG') {
      await appendLog(run, payload.level, payload.msg);
      onLog?.(payload.level, payload.msg);
    }

    if (type === 'FILE_DONE') {
      // Write blob to output folder
      try {
        const folder = payload.subfolder ? await getOrCreateOutputSubfolder(outputHandle, payload.subfolder) : subHandle;
        await writeFile(folder, payload.filename, payload.blob);
      } catch (err) {
        onLog?.('error', `Write failed: ${payload.filename} — ${err.message}`);
      }
    }

    if (type === 'COMPLETE') {
      run.finishedAt    = Date.now();
      run.status        = 'completed';
      run.successCount  = payload.successCount;
      run.failCount     = payload.failCount;
      await updateRun(run);
      onComplete?.(run);
    }

    if (type === 'ERROR') {
      run.status     = 'failed';
      run.finishedAt = Date.now();
      await updateRun(run);
      onError?.(payload.msg);
    }
  };

  worker.postMessage({
    type: 'START',
    payload: {
      recipe,
      files,
      outputConfig: { subfolder, blocks: blocksById },
      runId: run.id,
    }
  });

  return {
    runId: run.id,
    cancel: async () => {
      worker.postMessage({ type: 'CANCEL', payload: { runId: run.id } });
      run.status     = 'cancelled';
      run.finishedAt = Date.now();
      await updateRun(run);
    }
  };
}
