import { interpolate } from './src/utils/variables.js';
const srt = `1
00:00:00,000 --> 00:00:13,440
Over the years people have always said to me...

2
00:00:13,440 --> 00:00:25,380
And I say...

3
00:00:25,380 --> 00:00:24,140
Le`;

const context = {
  variables: new Map([['autoCaptions', srt]])
};

const result = interpolate('{{autoCaptions}}', context);
console.log("Interpolate output exactly matches:", result === srt);
