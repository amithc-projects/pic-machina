const V=`
precision highp float;
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  // WebGL clip space: -1 to 1
  gl_Position = vec4(a_position, 0.0, 1.0);
  // UV space: 0 to 1
  v_uv = a_position * 0.5 + 0.5;
  // Invert Y because WebGL reads textures bottom-to-top natively,
  // but our UV coordinate logic assumes 0,0 is top-left
  v_uv.y = 1.0 - v_uv.y; 
}`,z=`
precision highp float;
varying vec2 v_uv;

uniform sampler2D fromTex;
uniform sampler2D toTex;
uniform float progress;      // 0.0 to 1.0 over the transition
uniform float ratio;         // canvas aspect ratio (width/height)

// Ken burns transforms for both the incoming and outgoing slides
uniform vec2 fromScale;
uniform vec2 fromOffset;
uniform vec2 toScale;
uniform vec2 toOffset;

vec4 getFromColor(vec2 uv) {
  vec2 transformed = (uv - 0.5) * fromScale + 0.5 + fromOffset;
  if(transformed.x < 0. || transformed.x > 1. || transformed.y < 0. || transformed.y > 1.) return vec4(0.0,0.0,0.0,1.0);
  return texture2D(fromTex, transformed);
}

vec4 getToColor(vec2 uv) {
  vec2 transformed = (uv - 0.5) * toScale + 0.5 + toOffset;
  if(transformed.x < 0. || transformed.x > 1. || transformed.y < 0. || transformed.y > 1.) return vec4(0.0,0.0,0.0,1.0);
  return texture2D(toTex, transformed);
}

// ------ TRANSITION INJECTED HERE ------
___TRANSITION_GLSL___
// --------------------------------------

void main() {
  gl_FragColor = transition(v_uv);
}
`,G={crossfade:`
    vec4 transition(vec2 uv) {
      return mix(getFromColor(uv), getToColor(uv), progress);
    }
  `,wipeRight:`
    vec4 transition(vec2 uv) {
      vec2 p = uv;
      return mix(getFromColor(p), getToColor(p), step(p.x, progress));
    }
  `,circleCrop:`
    vec4 transition(vec2 uv) {
      vec2 center = vec2(0.5, 0.5);
      float sqDist = dot((uv - center) * vec2(ratio, 1.0), (uv - center) * vec2(ratio, 1.0));
      if (sqDist < progress * progress) {
        return getToColor(uv);
      }
      return getFromColor(uv);
    }
  `,pixelize:`
    uniform float squaresMin; /* default 20.0 */
    uniform int steps; /* default 50 */
    
    vec4 transition(vec2 uv) {
      float d = min(progress, 1.0 - progress);
      float dist = steps > 0 ? ceil(d * float(steps)) / float(steps) : d;
      vec2 squareSize = 2.0 * dist / vec2(20.0);
      vec2 p = dist > 0.0 ? (floor(uv / squareSize) + 0.5) * squareSize : uv;
      return mix(getFromColor(p), getToColor(p), progress);
    }
  `};class k{constructor(r,t){this.canvas=new OffscreenCanvas(r,t),this.gl=this.canvas.getContext("webgl"),this.width=r,this.height=t,this.programs={},this.initGeometry();for(const[o,s]of Object.entries(G))this.compileTransition(o,s)}initGeometry(){const r=this.gl,t=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);this.buffer=r.createBuffer(),r.bindBuffer(r.ARRAY_BUFFER,this.buffer),r.bufferData(r.ARRAY_BUFFER,t,r.STATIC_DRAW)}compileShader(r,t){const o=this.gl,s=o.createShader(r);if(o.shaderSource(s,t),o.compileShader(s),!o.getShaderParameter(s,o.COMPILE_STATUS))throw new Error("Shader failed: "+o.getShaderInfoLog(s));return s}compileTransition(r,t){const o=this.gl,s=z.replace("___TRANSITION_GLSL___",t),y=this.compileShader(o.VERTEX_SHADER,V),S=this.compileShader(o.FRAGMENT_SHADER,s),e=o.createProgram();if(o.attachShader(e,y),o.attachShader(e,S),o.linkProgram(e),!o.getProgramParameter(e,o.LINK_STATUS))throw new Error("Program link failed: "+o.getProgramInfoLog(e));this.programs[r]={program:e,locs:{position:o.getAttribLocation(e,"a_position"),fromTex:o.getUniformLocation(e,"fromTex"),toTex:o.getUniformLocation(e,"toTex"),progress:o.getUniformLocation(e,"progress"),ratio:o.getUniformLocation(e,"ratio"),fromScale:o.getUniformLocation(e,"fromScale"),fromOffset:o.getUniformLocation(e,"fromOffset"),toScale:o.getUniformLocation(e,"toScale"),toOffset:o.getUniformLocation(e,"toOffset")}}}createTexture(r){const t=this.gl,o=t.createTexture();return t.bindTexture(t.TEXTURE_2D,o),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),r&&t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,r),o}renderFrame({programName:r,fromTex:t,toTex:o,progress:s,fromMotion:y,toMotion:S}){const e=this.gl,i=this.programs[r]||this.programs.crossfade;e.useProgram(i.program),e.viewport(0,0,this.width,this.height),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),e.uniform1f(i.locs.progress,s),e.uniform1f(i.locs.ratio,this.width/this.height);const A=(v,U,a)=>{v?(e.uniform2f(U,v.scale.x,v.scale.y),e.uniform2f(a,v.offset.x,v.offset.y)):(e.uniform2f(U,1,1),e.uniform2f(a,0,0))};A(y,i.locs.fromScale,i.locs.fromOffset),A(S,i.locs.toScale,i.locs.toOffset),t&&(e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,t),e.uniform1i(i.locs.fromTex,0)),o&&(e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,o),e.uniform1i(i.locs.toTex,1)),e.bindBuffer(e.ARRAY_BUFFER,this.buffer),e.enableVertexAttribArray(i.locs.position),e.vertexAttribPointer(i.locs.position,2,e.FLOAT,!1,0,0),e.drawArrays(e.TRIANGLES,0,6)}}function D(g,r){switch(g){case"zoom-in":{const t=1-r*.15;return{scale:{x:t,y:t},offset:{x:0,y:0}}}case"zoom-out":{const t=.85+r*.15;return{scale:{x:t,y:t},offset:{x:0,y:0}}}case"pan-left":return{scale:{x:.9,y:.9},offset:{x:(r-.5)*.1,y:0}};case"pan-right":return{scale:{x:.9,y:.9},offset:{x:(.5-r)*.1,y:0}};default:return{scale:{x:1,y:1},offset:{x:0,y:0}}}}async function W(g,{width:r,height:t,fps:o=30,durationPerSlide:s=3,transitionDuration:y=1,transitionMode:S="crossfade",motionMode:e="random",onProgress:i,onLog:A}={}){const{Muxer:v,ArrayBufferTarget:U}=await import("./mp4-muxer-CR73arlb.js");let a=r?parseInt(r,10):null,c=t?parseInt(t,10):null;if(!a||!c){const l=await createImageBitmap(g[0]);a=a||l.width,c=c||l.height,l.close?.()}a=a%2===0?a:a-1,c=c%2===0?c:c-1;const T=new k(a,c),w=[],O=["zoom-in","zoom-out","pan-left","pan-right"],L=Object.keys(G);A?.(`Loading and cropping ${g.length} images to GPU memory...`);for(let l=0;l<g.length;l++){console.log("[Stitcher] Decoding frame",l+1,"of",g.length);const u=await createImageBitmap(g[l]),x=document.createElement("canvas");x.width=a,x.height=c;const h=x.getContext("2d"),p=Math.max(a/u.width,c/u.height),_=u.width*p,f=u.height*p;h.drawImage(u,(a-_)/2,(c-f)/2,_,f);const n=await createImageBitmap(x);w.push({tex:T.createTexture(n),motion:e==="random"?O[Math.floor(Math.random()*O.length)]:e,transition:S==="random"?L[Math.floor(Math.random()*L.length)]:S}),u.close(),n.close()}A?.(`Finished loading ${g.length} images to GPU.`);const b=new U,B=new v({target:b,video:{codec:"avc",width:a,height:c},fastStart:"in-memory"});return await new Promise((l,u)=>{let x=0;const h=new VideoEncoder({output:(n,d)=>{B.addVideoChunk(n,d),x++,i?.(x,w.length*Math.round(o*s))},error:n=>u(new Error(`VideoEncoder: ${n.message}`))});h.configure({codec:"avc1.64002a",width:a,height:c,bitrate:6e6,framerate:o});const p=Math.round(o*s),_=Math.round(o*y);let f=0;(async()=>{try{for(let n=0;n<w.length;n++){const d=w[n],C=n<w.length-1?w[n+1]:null,M=p-_;for(let m=0;m<M;m++){const F=m/p,I=D(d.motion,F);T.renderFrame({programName:L[0],fromTex:d.tex,toTex:null,progress:0,fromMotion:I,toMotion:null});const E=await createImageBitmap(T.canvas),R=new VideoFrame(E,{timestamp:f*(1e6/o)});h.encode(R,{keyFrame:f%30===0}),R.close(),E.close(),f++}if(C)for(let m=0;m<_;m++){const F=m/_,I=(M+m)/p,E=m/p,R=D(d.motion,I),X=D(C.motion,E);T.renderFrame({programName:d.transition,fromTex:d.tex,toTex:C.tex,progress:F,fromMotion:R,toMotion:X});const P=await createImageBitmap(T.canvas),N=new VideoFrame(P,{timestamp:f*(1e6/o)});h.encode(N,{keyFrame:f%30===0}),N.close(),P.close(),f++}else for(let m=0;m<_;m++){const F=(M+m)/p,I=D(d.motion,F);T.renderFrame({programName:L[0],fromTex:d.tex,toTex:null,progress:0,fromMotion:I,toMotion:null});const E=await createImageBitmap(T.canvas),R=new VideoFrame(E,{timestamp:f*(1e6/o)});h.encode(R,{keyFrame:f%30===0}),R.close(),E.close(),f++}}await h.flush(),h.close(),l()}catch(n){u(n)}})()}),B.finalize(),new Blob([b.buffer],{type:"video/mp4"})}export{W as createWebGLStitcher};
