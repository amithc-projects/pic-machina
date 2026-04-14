import{_ as m}from"./ai-bgremoval-CLcXU_4U.js";const g=new Set(["Make","Model","LensModel","LensMake","LensSpecification","BodySerialNumber","CameraOwnerName","Software"]),u=new Set(["DateTimeOriginal","DateTime","DateTimeDigitized","OffsetTimeOriginal","ExposureTime","FNumber","ISOSpeedRatings","FocalLength","FocalLengthIn35mmFilm","Flash","WhiteBalance","ExposureBiasValue","ExposureProgram","ExposureMode","MeteringMode","SceneCaptureType","SubjectDistance","BrightnessValue","SensitivityType","RecommendedExposureIndex","ShutterSpeedValue","ApertureValue"]),f=new Set(["Artist","Copyright","ImageDescription","UserComment"]),h=new Set(["Latitude","Longitude","Altitude","GPSSpeed","GPSImgDirection","GPSDateStamp","GPSTimeStamp"]);function x(e){return e==null?"—":e<1024?e+" B":e<1048576?(e/1024).toFixed(1)+" KB":(e/1048576).toFixed(2)+" MB"}function p(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}async function b(e){const t={filename:e.name,fileSize:e.size,mimeType:e.type||"",width:null,height:null,camera:{},capture:{},meta:{},gps:null,gpsRaw:{},exifOther:{},xmp:{},iptc:{}};try{const r=await createImageBitmap(e);t.width=r.width,t.height=r.height,r.close?.()}catch{}try{const r=(await m(async()=>{const{default:i}=await import("./exif-reader-CfDIS0tA.js");return{default:i}},[])).default,o=await e.arrayBuffer(),n=r.load(o,{expanded:!0});if(!t.width&&n.file?.["Image Width"]?.value&&(t.width=n.file["Image Width"].value),!t.height&&n.file?.["Image Height"]?.value&&(t.height=n.file["Image Height"].value),!t.mimeType&&n.file?.["MIME Type"]?.description&&(t.mimeType=n.file["MIME Type"].description),n.exif)for(const[i,a]of Object.entries(n.exif)){const s=a?.description??a?.value;if(s==null||s==="")continue;const l=String(s);g.has(i)?t.camera[i]=l:u.has(i)?t.capture[i]=l:f.has(i)?t.meta[i]=l:t.exifOther[i]=l}if(n.gps){const i=n.gps;i.Latitude!=null&&i.Longitude!=null&&(t.gps={lat:i.Latitude,lng:i.Longitude},i.Altitude!=null&&(t.gps.altitude=i.Altitude));for(const[a,s]of Object.entries(i))if(h.has(a)){const l=s?.description??s?.value??s;l!=null&&(t.gpsRaw[a]=String(l))}}if(n.xmp)for(const[i,a]of Object.entries(n.xmp)){const s=a?.description??a?.value;s!=null&&s!==""&&(t.xmp[i]=String(s))}if(n.iptc)for(const[i,a]of Object.entries(n.iptc)){const s=a?.description??a?.value;s!=null&&s!==""&&(t.iptc[i]=String(s))}}catch{}return t}function S(e){const t=document.createElement("div");t.className="img-info-panel";const r=e.filename?e.filename.slice(e.filename.lastIndexOf(".")+1).toUpperCase():"",o=e.mimeType||r||"—",n=[["Filename",e.filename||"—"],["Format",o],["File Size",x(e.fileSize)],["Dimensions",e.width&&e.height?`${e.width} × ${e.height} px`:"—"]];if(t.appendChild(c("File",n)),Object.keys(e.camera).length&&t.appendChild(c("Camera",Object.entries(e.camera))),Object.keys(e.capture).length&&t.appendChild(c("Capture Settings",Object.entries(e.capture))),Object.keys(e.meta).length&&t.appendChild(c("Author / Rights",Object.entries(e.meta))),e.gps){const a=[["Latitude",e.gps.lat.toFixed(6)+"°"],["Longitude",e.gps.lng.toFixed(6)+"°"]];e.gps.altitude!=null&&a.push(["Altitude",e.gps.altitude.toFixed(1)+" m"]),Object.entries(e.gpsRaw).forEach(([s,l])=>{["Latitude","Longitude","Altitude"].includes(s)||a.push([s,l])}),t.appendChild(c("GPS",a))}if(Object.keys(e.exifOther).length&&t.appendChild(c("EXIF (Other)",Object.entries(e.exifOther),!0)),Object.keys(e.xmp).length&&t.appendChild(c("XMP",Object.entries(e.xmp),!0)),Object.keys(e.iptc).length&&t.appendChild(c("IPTC",Object.entries(e.iptc),!0)),!(Object.keys(e.camera).length+Object.keys(e.capture).length+Object.keys(e.meta).length+Object.keys(e.exifOther).length+Object.keys(e.xmp).length+Object.keys(e.iptc).length+(e.gps?1:0))){const a=document.createElement("div");a.className="img-info-empty",a.textContent="No embedded metadata found in this file.",t.appendChild(a)}return t}function c(e,t,r=!1){const o=document.createElement("details");o.className="img-info-section",r||(o.open=!0);const n=document.createElement("summary");n.className="img-info-section-title",n.textContent=e,o.appendChild(n);const i=document.createElement("table");i.className="img-info-table";for(const[a,s]of t){const l=document.createElement("tr");l.innerHTML=`<td class="img-info-key">${p(a)}</td><td class="img-info-val">${p(s)}</td>`,i.appendChild(l)}return o.appendChild(i),o}let d=!1;function v(){if(d)return;d=!0;const e=document.createElement("style");e.textContent=`
    .img-info-panel {
      overflow-y:auto; height:100%; padding:8px 0;
      font-size:12px; color:var(--ps-text);
    }
    .img-info-section {
      border-bottom:1px solid var(--ps-border);
    }
    .img-info-section-title {
      display:flex; align-items:center; gap:6px;
      padding:7px 14px; font-size:11px; font-weight:600;
      text-transform:uppercase; letter-spacing:.06em;
      color:var(--ps-text-faint); cursor:pointer;
      user-select:none; list-style:none;
    }
    .img-info-section-title::-webkit-details-marker { display:none; }
    .img-info-section-title::after {
      content:'expand_more'; font-family:'Material Symbols Outlined';
      font-size:14px; margin-left:auto; color:var(--ps-text-faint);
      transition:transform 200ms;
    }
    details[open] > .img-info-section-title::after { transform:rotate(180deg); }
    details[open] > .img-info-section-title { color:var(--ps-text-muted); }
    .img-info-table { width:100%; border-collapse:collapse; padding:0 14px 8px; display:block; }
    .img-info-table tr:hover td { background:var(--ps-bg-hover); }
    .img-info-key {
      padding:3px 8px 3px 14px; color:var(--ps-text-faint);
      font-family:var(--font-mono); font-size:10.5px; white-space:nowrap;
      width:40%; vertical-align:top;
    }
    .img-info-val {
      padding:3px 14px 3px 4px; color:var(--ps-text);
      font-family:var(--font-mono); font-size:10.5px;
      word-break:break-word; vertical-align:top;
    }
    .img-info-empty {
      padding:16px 14px; color:var(--ps-text-faint); font-size:12px; font-style:italic;
    }
  `,document.head.appendChild(e)}export{b as g,v as i,S as r};
