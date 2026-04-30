const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="test">Hello</div></body></html>');
const document = dom.window.document;
const XMLSerializer = dom.window.XMLSerializer;

const W = 1920, H = 1080;
const element = document.getElementById('test');
const serializer = new XMLSerializer();
let safeHtml = serializer.serializeToString(element);
if (!safeHtml.includes('xmlns="http://www.w3.org/1999/xhtml"')) {
    safeHtml = safeHtml.replace(/^<div/, '<div xmlns="http://www.w3.org/1999/xhtml"');
}
const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <foreignObject width="100%" height="100%">
        ${safeHtml}
        </foreignObject>
    </svg>
`;
console.log(svg);
