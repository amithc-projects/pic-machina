import fs from 'fs';

let io = fs.readFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/utils/project-io.js', 'utf-8');

const newMethods = `
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
`;

io = io.replace("export async function verifyPermission", newMethods + "\nexport async function verifyPermission");

fs.writeFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/utils/project-io.js', io, 'utf-8');
console.log('project-io updated');
