import { interpolate } from './src/utils/variables.js';
import { parseSubtitles } from './src/utils/subtitles.js';

const srtContent = `1
00:00:00,000 --> 00:00:13,440
Over the years people have always said to me, "Who do you, you know, whose career would you, what actress do most of my, or who, what actresses career would you like to emulate?"

2
00:00:13,440 --> 00:00:25,380
And I say, and this is honest, I revere these women, I say, Geraldine Page, Colleen Dewhurst, Irene Worth, Vanessa Redgrave,

3
00:00:25,380 --> 00:00:24,140
Le

4
00:00:24,140 --> 00:00:27,320
Lievelman, but really

5
00:00:27,320 --> 00:00:30,000
the second time I saw Robert`;

const context = { variables: new Map([['autoCaptions', srtContent]]) };
const rawSubtitleParam = interpolate('{{autoCaptions}}', context);

const subs = parseSubtitles(rawSubtitleParam);

let out = [];
for (let ts = 13.40; ts <= 13.50; ts += 0.033) {
  const activeSubs = subs.filter(sub => ts >= sub.start && ts <= sub.end);
  out.push(`ts: ${ts.toFixed(3)} -> found: ${activeSubs.length}`);
}

console.log(out.join('\n'));
