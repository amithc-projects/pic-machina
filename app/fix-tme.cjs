const fs = require('fs');
const path = "/Users/amithcabraal/code/personal/pic-machina/app/src/screens/tme.js";
let content = fs.readFileSync(path, 'utf8');

const regexVideoPush = /currentTimeline\.videoTrack\.push\(\{ id: generateId\(\), poolId: id, timelineStart: currentTime, duration: 4\.0, sourceStart: 0, transitionOut: null \}\);/g;
const replaceVideoPush = `const duration = poolItem.meta?.duration || 4.0;
                            let dropTime = currentTime;
                            if (typeof timelineView !== 'undefined' && timelineView.isMagnetic) {
                               dropTime = currentTimeline.videoTrack.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
                            }
                            currentTimeline.videoTrack.push({ id: generateId(), poolId: id, timelineStart: dropTime, duration: duration, sourceStart: 0, transitionOut: null });
                            currentTime = dropTime;`;

const regexAudioPush = /t\.blocks\.push\(\{ id: generateId\(\), poolId: id, timelineStart: currentTime, duration: 4\.0, sourceStart: 0 \}\);/g;
const replaceAudioPush = `const duration = poolItem.meta?.duration || 4.0;
                                let dropTime = currentTime;
                                if (typeof timelineView !== 'undefined' && timelineView.isMagnetic) {
                                   dropTime = t.blocks.reduce((max, c) => Math.max(max, c.timelineStart + c.duration), 0);
                                }
                                t.blocks.push({ id: generateId(), poolId: id, timelineStart: dropTime, duration: duration, sourceStart: 0 });
                                currentTime = dropTime;`;

content = content.replace(regexVideoPush, replaceVideoPush);
content = content.replace(regexAudioPush, replaceAudioPush);

content = content.replace(/currentTime \+= 4\.0;/g, "currentTime += (typeof duration !== 'undefined' ? duration : 4.0);");

fs.writeFileSync(path, content);
console.log("Fixed!");
