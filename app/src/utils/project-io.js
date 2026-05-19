/**
 * project-io.js
 * 
 * Core utilities for handling Self-Contained Folder architectures
 * using the File System Access API.
 */
import { dbGet, dbPut } from '../data/db.js';


export async function getWorkspaceRoot() {
  const record = await dbGet('folders', 'workspace_root');
  return record ? record.handle : null;
}

export async function setWorkspaceRoot(dirHandle) {
  await dbPut('folders', { key: 'workspace_root', handle: dirHandle });
}

export async function scanWorkspaceProjects(workspaceHandle) {
  const projects = [];
  try {
    for await (const entry of workspaceHandle.values()) {
      if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
        try {
          const fileHandle = await entry.getFileHandle('project.json');
          const file = await fileHandle.getFile();
          const text = await file.text();
          const projectData = JSON.parse(text);
          projects.push({ dirHandle: entry, projectData });
        } catch (e) {
          // No project.json, skip
        }
      }
    }
  } catch (err) {
    console.error('Error scanning workspace:', err);
  }
  return projects;
}

export async function createProjectInWorkspace(workspaceHandle, projectName, initialData = {}) {
  try {
    const dirName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dirHandle = await workspaceHandle.getDirectoryHandle(dirName, { create: true });
    
    // Check if empty (optional)
    
    await dirHandle.getDirectoryHandle('media', { create: true });
    const fileHandle = await dirHandle.getFileHandle('project.json', { create: true });
    const writable = await fileHandle.createWritable();
    
    initialData.title = projectName;
    initialData.name = projectName;
    await writable.write(JSON.stringify(initialData, null, 2));
    await writable.close();
    
    return dirHandle;
  } catch (err) {
    console.error('Error creating project in workspace:', err);
    throw err;
  }
}

export async function verifyPermission(fileHandle, readWrite = true) {
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}

export async function addRecentProject(type, dirHandle, projectData) {
  const storeKey = `recent_${type}`;
  let record = await dbGet('folders', storeKey);
  if (!record) record = { key: storeKey, projects: [] };
  
  record.projects = record.projects.filter(p => p.name !== dirHandle.name);
  record.projects.unshift({
    name: dirHandle.name,
    title: projectData.title || projectData.name || 'Untitled',
    handle: dirHandle,
    lastOpened: Date.now()
  });
  
  if (record.projects.length > 10) record.projects = record.projects.slice(0, 10);
  await dbPut('folders', record);
}

export async function getRecentProjects(type) {
  const storeKey = `recent_${type}`;
  const record = await dbGet('folders', storeKey);
  return record ? record.projects : [];
}

export async function openProjectFromHandle(dirHandle) {
  if (!(await verifyPermission(dirHandle))) {
    throw new Error('Permission to access folder was denied.');
  }
  const fileHandle = await dirHandle.getFileHandle('project.json');
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}

/**
 * Prompts the user to select a folder to act as the project root.
 * Creates an initial project.json and a media/ subfolder.
 * @param {Object} initialData - The initial state to write to project.json
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
export async function createProject(initialData = {}) {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    
    // Create media/ subfolder
    await dirHandle.getDirectoryHandle('media', { create: true });
    
    // Create and write project.json
    const fileHandle = await dirHandle.getFileHandle('project.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(initialData, null, 2));
    await writable.close();
    
    return dirHandle;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error creating project:', err);
      throw err;
    }
    return null;
  }
}

/**
 * Prompts the user to select an existing project folder.
 * Reads and parses the project.json file inside.
 * @returns {Promise<{dirHandle: FileSystemDirectoryHandle, projectData: Object}|null>}
 */
export async function openProject() {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    
    try {
      const fileHandle = await dirHandle.getFileHandle('project.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      const projectData = JSON.parse(text);
      
      return { dirHandle, projectData };
    } catch (e) {
      throw new Error('Selected folder is not a valid project (missing or unreadable project.json).');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error opening project:', err);
      throw err;
    }
    return null;
  }
}

/**
 * Saves project data directly to the project.json in the provided directory handle.
 * @param {FileSystemDirectoryHandle} dirHandle 
 * @param {Object} projectData 
 */
export async function saveProject(dirHandle, projectData) {
  try {
    const fileHandle = await dirHandle.getFileHandle('project.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(projectData, null, 2));
    await writable.close();
  } catch (err) {
    console.error('Error saving project:', err);
    throw err;
  }
}

/**
 * Copies a file (from a File object or FileSystemFileHandle) into the project's media/ folder.
 * @param {File|FileSystemFileHandle} sourceMedia 
 * @param {FileSystemDirectoryHandle} dirHandle 
 * @returns {Promise<string>} The relative path to the new file (e.g. "media/my_video.mp4")
 */
export async function importMediaToProject(sourceMedia, dirHandle) {
  try {
    let sourceFile;
    let targetFileName;

    if (sourceMedia instanceof File) {
      sourceFile = sourceMedia;
      targetFileName = sourceFile.name;
    } else {
      // Assume FileSystemFileHandle
      sourceFile = await sourceMedia.getFile();
      targetFileName = sourceMedia.name;
    }

    const mediaDirHandle = await dirHandle.getDirectoryHandle('media', { create: true });
    
    // Check if file already exists to avoid overwrite.
    try {
      await mediaDirHandle.getFileHandle(targetFileName);
      // Exists. Add timestamp.
      const parts = targetFileName.split('.');
      const ext = parts.pop();
      const base = parts.join('.');
      targetFileName = `${base}_${Date.now().toString().slice(-4)}.${ext}`;
    } catch (e) {
      // Doesn't exist. Proceed.
    }

    const targetFileHandle = await mediaDirHandle.getFileHandle(targetFileName, { create: true });
    const writable = await targetFileHandle.createWritable();
    
    await writable.write(sourceFile);
    await writable.close();
    
    return `media/${targetFileName}`;
  } catch (err) {
    console.error('Error importing media:', err);
    throw err;
  }
}

/**
 * Resolves a relative path (like "media/video.mp4") inside the project directory
 * into a temporary Object URL for the browser to render.
 * @param {string} relativePath 
 * @param {FileSystemDirectoryHandle} dirHandle 
 * @returns {Promise<string|null>} Object URL (e.g. blob:http://...)
 */
export async function resolveMediaUrl(relativePath, dirHandle) {
  try {
    const parts = relativePath.split('/');
    let currentHandle = dirHandle;
    
    // Traverse directories
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    }
    
    const filename = parts[parts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    
    return URL.createObjectURL(file);
  } catch (err) {
    console.error(`Error resolving media URL for ${relativePath}:`, err);
    return null;
  }
}

/**
 * Releases a previously created Object URL to free up memory.
 * @param {string} url 
 */
export function revokeMediaUrl(url) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
