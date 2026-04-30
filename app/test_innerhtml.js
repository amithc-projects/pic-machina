import { JSDOM } from 'jsdom';
const dom = new JSDOM();
const document = dom.window.document;
const container = document.createElement('div');
container.innerHTML = '<!doctype html><html><head><style>body{background:black;}</style></head><body><div data-composition-id="countdown" style="background:#000;">Test</div></body></html>';
console.log(container.innerHTML);
