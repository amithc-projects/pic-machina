/**
 * ImageChef — Run log CRUD
 *
 * A Run captures a full batch execution:
 * {
 *   id:           string,
 *   recipeId:     string,
 *   recipeName:   string,
 *   inputFolder:  string,        // path string (display only — handle not stored here)
 *   outputFolder: string,
 *   startedAt:    number,
 *   finishedAt:   number | null,
 *   status:       'running' | 'completed' | 'failed' | 'cancelled',
 *   imageCount:   number,
 *   successCount: number,
 *   failCount:    number,
 *   log:          LogEntry[],    // { ts, level, msg }
 * }
 */

import { dbGet, dbGetAll, dbGetAllByIndex, dbPut, dbDelete } from './db.js';
import { uuid, now } from '../utils/misc.js';

export function getAllRuns()            { return dbGetAll('runs'); }
export function getRun(id)             { return dbGet('runs', id); }
export function getRunsForRecipe(rid)  { return dbGetAllByIndex('runs', 'recipeId', rid); }

export async function createRun(partial) {
  const run = {
    id:           uuid(),
    recipeId:     partial.recipeId ?? '',
    recipeName:   partial.recipeName ?? '',
    inputFolder:  partial.inputFolder ?? '',
    outputFolder: partial.outputFolder ?? '',
    startedAt:    now(),
    finishedAt:   null,
    status:       'running',
    imageCount:   partial.imageCount ?? 0,
    successCount: 0,
    failCount:    0,
    log:          [],
    outputHandleObj: partial.outputHandleObj || null,
  };
  await dbPut('runs', run);
  return run;
}

export function updateRun(run) { return dbPut('runs', run); }
export function deleteRun(id)  { return dbDelete('runs', id); }

/** Append a log line and persist the run. */
export async function appendLog(run, level, msg) {
  run.log.push({ ts: now(), level, msg });
  // Persist every 10 lines to avoid excessive writes
  if (run.log.length % 10 === 0) await dbPut('runs', run);
}
