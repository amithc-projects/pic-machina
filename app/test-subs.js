import { parseSubtitles } from './src/utils/subtitles.js';
const srt = `1
00:00:00,000 --> 00:00:13,440
Over the years people have always said to me, "Who do you, you know, whose career would you, what actress do most of my, or who, what actresses career would you like to emulate?"

2
00:00:13,440 --> 00:00:25,380
And I say, and this is honest, I revere these women, I say, Geraldine Page, Colleen Dewhurst, Irene Worth, Vanessa Redgrave,

3
00:00:25,380 --> 00:00:24,140
Le`;

console.log(JSON.stringify(parseSubtitles(srt), null, 2));
