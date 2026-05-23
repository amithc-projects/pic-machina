import fs from 'fs';

let tme = fs.readFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/tme.js', 'utf-8');

tme = tme.replace(
  "import { renderParamField, collectParams, bindParamFieldEvents } from '../utils/param-fields.js';",
  "import { renderParamField, collectParams, bindParamFieldEvents } from '../utils/param-fields.js';\nimport { FsaBrowser } from '../components/fsa-browser.js';"
);

// Insert floating panel div at the end of the container HTML
tme = tme.replace(
  /<\/div>\n\s*<\/div>\n\s*`;\n\n\s*const poolContainer/,
  `    <div id="tme-fsa-browser-panel" style="position:fixed; top:48px; left:300px; width:600px; height:calc(100vh - 100px); z-index:9999; display:none; box-shadow: 0 4px 32px rgba(0,0,0,0.8); border-radius:8px; overflow:hidden;"></div>
      </div>
    </div>
  \`;\n\n  const poolContainer`
);

// Replace importFolderLogic
const oldImportFolderLogic = `  if (btnImportFolder) {
    btnImportFolder.addEventListener('click', async () => {
      try {
        const dirHandle = await window.showDirectoryPicker();
        
        async function scanDirectory(handle) {
           let files = [];
           for await (const entry of handle.values()) {
              if (entry.kind === 'file') {
                 if (entry.name.match(/\\.(png|jpg|jpeg|webp|mp4|webm)$/i)) {
                    files.push(entry);
                 }
              } else if (entry.kind === 'directory') {
                 files = files.concat(await scanDirectory(entry));
              }
           }
           return files;
        }
        
        const handles = await scanDirectory(dirHandle);
        for (const handle of handles) {
           const file = await handle.getFile();
           const type = file.type.startsWith('video') ? 'video' : 'image';
           let thumbnail = null;
           let meta = await extractMediaMeta(file, type);
           
           if (type === 'image') { thumbnail = URL.createObjectURL(file); }
           else if (type === 'video') { thumbnail = await extractVideoThumbnail(file); }

           const filename = await importMediaToProject(handle, currentProjectDirHandle);
           currentTimeline.mediaPool.push({
             id: generateId(),
             type,
             name: handle.name,
             filename,
             fileHandle: handle,
             thumbnail,
             meta
           });
        }
        await saveTimeline(currentTimeline, currentProjectDirHandle);
        renderMediaPool();
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Folder import error:', err);
      }
    });
  }`;

const newImportFolderLogic = `
  const fsaPanelEl = container.querySelector('#tme-fsa-browser-panel');
  let fsaBrowserInstance = null;
  
  if (btnImportFolder) {
    btnImportFolder.innerHTML = '<span class="material-symbols-outlined" style="font-size: 20px;">folder_special</span>';
    btnImportFolder.title = 'Asset Browser';
    
    btnImportFolder.addEventListener('click', () => {
      fsaPanelEl.style.display = 'block';
      if (!fsaBrowserInstance) {
         fsaBrowserInstance = new FsaBrowser(fsaPanelEl, {
            onClose: () => { fsaPanelEl.style.display = 'none'; },
            onImportMedia: async (fileHandle) => {
               try {
                 const file = await fileHandle.getFile();
                 const type = file.type.startsWith('video') ? 'video' : (file.type.startsWith('audio') ? 'audio' : 'image');
                 let thumbnail = null;
                 let meta = await extractMediaMeta(file, type);
                 
                 if (type === 'image') { thumbnail = URL.createObjectURL(file); }
                 else if (type === 'video') { thumbnail = await extractVideoThumbnail(file); }
                 
                 const filename = await importMediaToProject(fileHandle, currentProjectDirHandle);
                 currentTimeline.mediaPool.push({
                   id: generateId(),
                   type,
                   name: fileHandle.name,
                   filename,
                   fileHandle: fileHandle,
                   thumbnail,
                   meta
                 });
                 await saveTimeline(currentTimeline, currentProjectDirHandle);
                 renderMediaPool();
                 window.AuroraToast?.show({ variant: 'success', title: 'Asset Imported', description: fileHandle.name });
               } catch (err) {
                 console.error('Error importing from Asset Browser:', err);
                 alert('Failed to import asset: ' + err.message);
               }
            }
         });
      }
    });
  }`;

tme = tme.replace(oldImportFolderLogic, newImportFolderLogic);
fs.writeFileSync('/Users/amithcabraal/code/personal/pic-machina/app/src/screens/tme.js', tme, 'utf-8');
console.log('FSA integrated into tme.js');
