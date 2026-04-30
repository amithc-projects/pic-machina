import { interpolate } from './src/utils/variables.js';
import { parseSubtitles } from './src/utils/subtitles.js';

const srtText = `1
00:00:00,000 --> 00:00:04,960
You know what, the sort of bit of theatre that we had in Parliament yesterday was never going to have an effect.

2
00:00:04,961 --> 00:00:09,520
The Labour Party can't get rid, won't get rid of Keir Starmer, the Tories can't,

3
00:00:09,521 --> 00:00:14,720
but you know what, can? A crushing defeat in Labour's heartlands on May the 7th,`;

const subs = parseSubtitles(srtText);
console.log("Parsed subs:", subs.length);

for (let ts = 0; ts <= 15; ts += 1) {
  const activeSubs = subs.filter(sub => ts >= sub.start && ts <= sub.end);
  if (activeSubs.length > 0) {
    let escapedText = activeSubs.map(s => s.text.replace(/\\n/g, '<br/>').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br/>');
    const svg = `
       <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
         <foreignObject width="100%" height="100%">
           <div xmlns="http://www.w3.org/1999/xhtml" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; box-sizing: border-box; padding-bottom: 60px;">
             <div style="font-family: Inter; font-size: 48px; font-weight: 700; color: #ffffff; text-align: center; max-width: 80%; line-height: 1.3;">
               ${escapedText}
             </div>
           </div>
         </foreignObject>
       </svg>
    `;
    const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.trim())));
    console.log(`ts: ${ts} -> active: ${activeSubs.length}, dataUri length: ${dataUri.length}`);
  }
}
