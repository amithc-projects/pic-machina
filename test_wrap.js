const { interpolate } = await import('./app/src/utils/variables.js');
const text = interpolate("Hello\\nWorld {{break}} Test");
console.log(JSON.stringify(text));
console.log(text.split('\n'));
