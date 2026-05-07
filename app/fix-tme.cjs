const fs = require('fs');
let code = fs.readFileSync('src/screens/tme.js', 'utf-8');

// 1. Add "selectedItems" multi-select to onClipSelect
code = code.replace(/onClipSelect: \(clipId, trackId, event\) => \{[\s\S]*?renderTimelineTracks\(\);\n        \},/, `onClipSelect: (clipId, trackId, event) => {
          if (event.shiftKey || event.metaKey) {
            if (timelineView.selectedClips.has(clipId)) timelineView.selectedClips.delete(clipId);
            else timelineView.selectedClips.add(clipId);
          } else {
            timelineView.selectedClips.clear();
            timelineView.selectedClips.add(clipId);
          }
          selectedItemId = timelineView.selectedClips.size === 1 ? [...timelineView.selectedClips][0] : null;
          selectedItemType = trackId === 'v1' ? 'video' : (trackId.startsWith('audio_') || trackId.startsWith('A') ? 'audio' : 'fx');
          renderPropertiesPanel();
          renderTimelineTracks();
        },`);

// 2. Fix onAddTrack to use a custom dialog instead of prompt (I)
code = code.replace(/onAddTrack: async \(\) => \{[\s\S]*?\},/, `onAddTrack: async () => {
          const dialog = document.createElement('div');
          dialog.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;color:#fff;';
          dialog.innerHTML = \`
            <div style="background:var(--ps-bg-surface);border:1px solid var(--ps-border);border-radius:8px;padding:20px;width:300px;">
              <h3 style="margin-bottom:16px;">Add Track</h3>
              <select id="tme-add-track-type" class="ic-input" style="width:100%;margin-bottom:16px;">
                <option value="audio">Audio Track</option>
                <option value="fx">Effect (FX) Track</option>
              </select>
              <div style="display:flex;justify-content:flex-end;gap:8px;">
                <button id="tme-btn-cancel-add-track" class="btn-ghost">Cancel</button>
                <button id="tme-btn-confirm-add-track" class="btn-primary">Add Track</button>
              </div>
            </div>
          \`;
          document.body.appendChild(dialog);
          
          dialog.querySelector('#tme-btn-cancel-add-track').onclick = () => document.body.removeChild(dialog);
          dialog.querySelector('#tme-btn-confirm-add-track').onclick = async () => {
              const type = dialog.querySelector('#tme-add-track-type').value;
              if (type === 'audio') {
                  const idx = currentTimeline.audioTracks.length + 1;
                  currentTimeline.audioTracks.push({ id: generateId(), name: \`A\${idx}\`, blocks: [] });
              } else if (type === 'fx') {
                  const idx = currentTimeline.effectTracks.length + 1;
                  currentTimeline.effectTracks.push({ id: generateId(), name: \`FX \${idx}\`, blocks: [] });
              }
              await saveTimeline(currentTimeline);
              renderTimelineTracks();
              document.body.removeChild(dialog);
          };
        },`);

// 3. Fix Context Menu logic and right-click split location (B)
code = code.replace(/onClipContextMenu: \(clip, e\) => \{[\s\S]*?\},(?=\n\s*onClipDrag)/, `onClipContextMenu: (clip, e) => {
            if (!timelineView.selectedClips.has(clip.id)) {
                timelineView.selectedClips.clear();
                timelineView.selectedClips.add(clip.id);
            }
            selectedItemId = timelineView.selectedClips.size === 1 ? [...timelineView.selectedClips][0] : null;
            
            let trackType = 'video';
            if (currentTimeline.effectTracks.some(t => t.blocks.find(b => b.id === clip.id))) trackType = 'fx';
            if (currentTimeline.audioTracks.some(t => t.blocks.find(b => b.id === clip.id))) trackType = 'audio';
            selectedItemType = trackType;
            
            renderPropertiesPanel();
            renderTimelineTracks();

            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const splitOffsetSec = clickX / PIXELS_PER_SECOND;

            const menu = document.createElement('div');
            menu.style.position = 'fixed';
            menu.style.left = \`\${e.clientX}px\`;
            menu.style.top = \`\${e.clientY}px\`;
            menu.style.background = 'var(--ps-bg-surface)';
            menu.style.border = '1px solid var(--ps-border)';
            menu.style.borderRadius = '4px';
            menu.style.padding = '4px 0';
            menu.style.zIndex = '9999';
            menu.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';

            const addMenuItem = (label, icon, onClick) => {
                const item = document.createElement('div');
                item.className = 'flex items-center gap-2 p-2 hover:bg-[var(--ps-bg-hover)] cursor-pointer text-sm text-white';
                item.innerHTML = \`<span class="material-symbols-outlined text-sm text-muted">\${icon}</span> \${label}\`;
                item.onclick = () => { onClick(); document.body.removeChild(menu); };
                menu.appendChild(item);
            };

            if (trackType === 'fx') {
                addMenuItem('Add Keyframe Here', 'add_location_alt', async () => {
                   let fxBlock = null;
                   currentTimeline.effectTracks.forEach(t => {
                     const b = t.blocks.find(blk => blk.id === selectedItemId);
                     if (b) fxBlock = b;
                   });
                   if (!fxBlock) return;
                   
                   const offset = splitOffsetSec;
                   if (offset < 0 || offset > fxBlock.duration) return;

                   if (!Array.isArray(fxBlock.keyframes) || fxBlock.keyframes.length === 0) {
                     fxBlock.keyframes = [{ offset: 0, params: JSON.parse(JSON.stringify(fxBlock.params || {})) }];
                   }
                   
                   const existingIdx = fxBlock.keyframes.findIndex(k => Math.abs(k.offset - offset) < 0.05);
                   if (existingIdx === -1) {
                     const currentParams = getInterpolatedParams(fxBlock, fxBlock.timelineStart + splitOffsetSec);
                     fxBlock.keyframes.push({ offset: offset, params: currentParams });
                     fxBlock.keyframes.sort((a, b) => a.offset - b.offset);
                     await saveTimeline(currentTimeline);
                     renderTimelineTracks();
                     renderPropertiesPanel();
                   }
                });
            }
            
            addMenuItem('Split Clip Here', 'content_cut', async () => {
                let splitHappened = false;
                const splitTime = clip.timelineStart + splitOffsetSec;

                if (trackType === 'video') {
                  const clipIndex = currentTimeline.videoTrack.findIndex(c => c.id === clip.id);
                  if (clipIndex !== -1) {
                    const c = currentTimeline.videoTrack[clipIndex];
                    const splitOffset = splitTime - c.timelineStart;
                    const newDuration2 = c.duration - splitOffset;
                    c.duration = splitOffset;
                    currentTimeline.videoTrack.splice(clipIndex + 1, 0, {
                      ...c, id: generateId(), timelineStart: splitTime, duration: newDuration2, sourceStart: (c.sourceStart || 0) + splitOffset
                    });
                    splitHappened = true;
                  }
                } else if (trackType === 'fx') {
                  currentTimeline.effectTracks.forEach(t => {
                    const fxIndex = t.blocks.findIndex(b => b.id === clip.id);
                    if (fxIndex !== -1) {
                      const fx = t.blocks[fxIndex];
                      const splitOffset = splitTime - fx.timelineStart;
                      const newDuration2 = fx.duration - splitOffset;
                      fx.duration = splitOffset;
                      t.blocks.splice(fxIndex + 1, 0, {
                        ...fx, id: generateId(), timelineStart: splitTime, duration: newDuration2
                      });
                      splitHappened = true;
                    }
                  });
                } else if (trackType === 'audio') {
                  currentTimeline.audioTracks.forEach(t => {
                    const aIndex = t.blocks.findIndex(b => b.id === clip.id);
                    if (aIndex !== -1) {
                      const c = t.blocks[aIndex];
                      const splitOffset = splitTime - c.timelineStart;
                      const newDuration2 = c.duration - splitOffset;
                      c.duration = splitOffset;
                      t.blocks.splice(aIndex + 1, 0, {
                        ...c, id: generateId(), timelineStart: splitTime, duration: newDuration2, sourceStart: (c.sourceStart || 0) + splitOffset
                      });
                      splitHappened = true;
                    }
                  });
                }

                if (splitHappened) {
                  await saveTimeline(currentTimeline);
                  renderTimelineTracks();
                  renderFrame();
                }
            });
            
            addMenuItem('Delete Clip', 'delete', () => timelineView.options.onDeleteSelected());

            document.body.appendChild(menu);
            const closeMenu = (evt) => {
                if (!menu.contains(evt.target)) {
                    document.body.removeChild(menu);
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 10);
        },`);

// 4. Implement Track Body Drop (A, D)
code = code.replace(/onClipDrop: async \(clipId\) => \{/, `onTrackDrop: async (track, offsetX, event) => {
           try {
             const dataStr = event.dataTransfer.getData('text/plain');
             if (!dataStr) return;
             const poolIds = JSON.parse(dataStr);
             let currentTime = Math.max(0, offsetX / PIXELS_PER_SECOND);
             let dropped = false;
             
             poolIds.forEach(id => {
               const poolItem = currentTimeline.mediaPool.find(p => p.id === id);
               if (poolItem) {
                 if (track.type === 'video' && (poolItem.type === 'video' || poolItem.type === 'image')) {
                   currentTimeline.videoTrack.push({ id: generateId(), poolId: id, timelineStart: currentTime, duration: 4.0, sourceStart: 0, transitionOut: null });
                   currentTime += 4.0;
                   dropped = true;
                 } else if (track.type === 'audio' && poolItem.type === 'audio') {
                   const t = currentTimeline.audioTracks.find(at => at.id === track.id);
                   if (t) {
                       t.blocks.push({ id: generateId(), poolId: id, timelineStart: currentTime, duration: 4.0, sourceStart: 0 });
                       currentTime += 4.0;
                       dropped = true;
                   }
                 }
               } else {
                 // Might be from FX panel
                 const fxDef = registry.get(id);
                 if (fxDef && track.type === 'effect') {
                   const t = currentTimeline.effectTracks.find(et => et.id === track.id);
                   if (t) {
                       t.blocks.push({ id: generateId(), type: fxDef.type || 'effect', transformId: id, timelineStart: currentTime, duration: 2.0 });
                       currentTime += 2.0;
                       dropped = true;
                   }
                 }
               }
             });
             
             if (dropped) {
                 await saveTimeline(currentTimeline);
                 renderTimelineTracks();
                 renderFrame();
             }
           } catch(err) {}
        },
        onClipDrop: async (clipId) => {`);

// 5. Delete Selected multi-select (K)
code = code.replace(/onDeleteSelected: async \(\) => \{[\s\S]*?\},(?=\n\s*onSplitClip)/, `onDeleteSelected: async () => {
           if (timelineView.selectedClips.size === 0) return;
           currentTimeline.videoTrack = currentTimeline.videoTrack.filter(c => !timelineView.selectedClips.has(c.id));
           currentTimeline.effectTracks.forEach(t => {
               t.blocks = t.blocks.filter(b => !timelineView.selectedClips.has(b.id));
           });
           currentTimeline.audioTracks.forEach(t => {
               t.blocks = t.blocks.filter(b => !timelineView.selectedClips.has(b.id));
           });
           timelineView.selectedClips.clear();
           selectedItemId = null;
           await saveTimeline(currentTimeline);
           renderTimelineTracks();
           renderFrame();
        },`);

// 6. Fix onRenderClip Effect Labels (E) & Keyframes (F)
code = code.replace(/onRenderClip: \(clip, element\) => \{[\s\S]*?(const isSelected = selectedItemId === clip\.id;)/, `onRenderClip: (clip, element, track) => {
            const isSelected = timelineView.selectedClips.has(clip.id);`);

code = code.replace(/if \(isSelected\) \{\n\s*element\.style\.border = '2px solid var\(--ps-danger\)';\n\s*\}/, `if (isSelected) {
                element.style.border = '2px solid var(--ps-danger)';
            }
            if (track && track.type === 'effect') {
                const def = registry.get(clip.transformId);
                const labelText = def ? def.name : (clip.transformId || 'Effect');
                const labelDiv = document.createElement('div');
                labelDiv.textContent = labelText;
                labelDiv.style.position = 'absolute';
                labelDiv.style.top = '4px';
                labelDiv.style.left = '4px';
                labelDiv.style.zIndex = '15';
                labelDiv.style.color = '#fff';
                labelDiv.style.background = 'rgba(0,0,0,0.6)';
                labelDiv.style.padding = '2px 4px';
                labelDiv.style.borderRadius = '3px';
                labelDiv.style.pointerEvents = 'none';
                element.appendChild(labelDiv);
                
                if (clip.keyframes && clip.keyframes.length > 0) {
                    clip.keyframes.forEach(kf => {
                        const tick = document.createElement('div');
                        tick.style.position = 'absolute';
                        tick.style.bottom = '0';
                        tick.style.width = '4px';
                        tick.style.height = '6px';
                        tick.style.background = '#22d3ee';
                        tick.style.left = \`\${kf.offset * PIXELS_PER_SECOND}px\`;
                        tick.style.transform = 'translateX(-50%)';
                        tick.style.zIndex = '20';
                        tick.style.borderRadius = '2px 2px 0 0';
                        element.appendChild(tick);
                    });
                }
            }`);

// 7. Base Settings text in Properties Panel (G)
code = code.replace(/<span class="text-xs">Keyframe \$\{activeKeyframeIdx \+ 1\} of \$\{fxBlock\.keyframes\.length\}<\/span>/, `<span class="text-xs" style="color:#22d3ee;">\${activeKeyframeIdx === -1 ? 'Base Settings' : \`Keyframe \${activeKeyframeIdx + 1}\`}</span>`);
// Wait, the activeKeyframeIdx logic has:
// if (activeKeyframeIdx === -1) activeKeyframeIdx = 0;
// We need to remove that so it can stay -1!
code = code.replace(/if \(activeKeyframeIdx === -1\) activeKeyframeIdx = 0;\n\s*activeParams = fxBlock\.keyframes\[activeKeyframeIdx\]\.params;/, `if (activeKeyframeIdx !== -1) {
          activeParams = fxBlock.keyframes[activeKeyframeIdx].params;
        } else {
          activeParams = fxBlock.params || {};
        }`);

// 8. Fix Double Click Audio adding to Video Track (H)
code = code.replace(/container\.querySelector\('#tme-media-pool'\)\.addEventListener\('dblclick', async \(e\) => \{[\s\S]*?\}\);/, `container.querySelector('#tme-media-pool').addEventListener('dblclick', async (e) => {
    const itemEl = e.target.closest('.tme-media-item');
    if (!itemEl) return;
    const id = itemEl.dataset.id;
    const item = currentTimeline.mediaPool.find(p => p.id === id);
    if (!item) return;

    if (item.type === 'video' || item.type === 'image') {
      const maxT = currentTimeline.videoTrack.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
      currentTimeline.videoTrack.push({ id: generateId(), poolId: id, timelineStart: maxT, duration: 4.0, sourceStart: 0, transitionOut: null });
    } else if (item.type === 'audio') {
      if (currentTimeline.audioTracks.length === 0) {
        currentTimeline.audioTracks.push({ id: generateId(), name: 'A1', blocks: [] });
      }
      let targetTrack = currentTimeline.audioTracks.find(t => timelineView && timelineView.selectedTracks.has(t.id));
      if (!targetTrack) targetTrack = currentTimeline.audioTracks[0];
      const maxT = targetTrack.blocks.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
      targetTrack.blocks.push({ id: generateId(), poolId: id, timelineStart: maxT, duration: 4.0, sourceStart: 0 });
    }
    
    await saveTimeline(currentTimeline);
    renderTimelineTracks();
  });`);

fs.writeFileSync('src/screens/tme.js', code);
console.log('Done!');
