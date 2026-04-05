import { initDB } from './data/db.js';
import { pickFolder, listImages } from './data/folders.js';
import { FilesetResolver, ImageClassifier } from '@mediapipe/tasks-vision';
import { pipeline, env } from '@xenova/transformers';

const btnPick = document.getElementById('btn-pick-folder');
const status  = document.getElementById('status-text');
const tbody   = document.getElementById('eval-tbody');

let mpClassifier = null;
let tfClassifier = null;

async function loadModels() {
  status.textContent = "Loading MediaPipe EfficientNet-Lite0...";
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm');
  mpClassifier = await ImageClassifier.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite',
      delegate: 'GPU'
    },
    maxResults: 5,
    runningMode: 'IMAGE'
  });

  status.textContent = "Loading Transformers.js ViT...";
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  
  // Progress callback for downloading weights
  tfClassifier = await pipeline('image-classification', 'Xenova/vit-base-patch16-224', {
    progress_callback: (x) => {
        if (x.status === 'downloading') {
            status.textContent = `Downloading TF Model: ${x.name} - ${Math.round(x.progress || 0)}%`;
        }
    }
  });

  status.textContent = "Models loaded. Waiting for folder...";
}

function renderBadge(label, score) {
  const percent = Math.round(score * 100);
  // Red to green mapping
  const a = Math.max(0.1, score * 0.4);
  return `<span class="label-badge" style="background: rgba(0,255,100,${a})">${label} (${percent}%)</span>`;
}

async function evalImage(file) {
  const tr = document.createElement('tr');
  const url = URL.createObjectURL(file);
  
  // 1. Column Thumbnail
  const tdImg = document.createElement('td');
  tdImg.innerHTML = `<img src="${url}" class="thumb" /><div style="font-size:10px; margin-top:4px; opacity:0.6">${file.name}</div>`;
  tr.appendChild(tdImg);

  // Loading columns
  const tdMP = document.createElement('td');
  tdMP.innerHTML = `<div class="loading">Inference...</div>`;
  tr.appendChild(tdMP);

  const tdTF = document.createElement('td');
  tdTF.innerHTML = `<div class="loading">Inference...</div>`;
  tr.appendChild(tdTF);

  tbody.appendChild(tr);

  // We need an ImageBitmap for MP and URL for TF
  const imgElement = new Image();
  imgElement.src = url;
  await new Promise(res => imgElement.onload = res);

  // A) MediaPipe Inference
  const mpStart = performance.now();
  const mpResult = mpClassifier.classify(imgElement);
  const mpTime = Math.round(performance.now() - mpStart);
  
  if (mpResult.classifications[0]?.categories) {
    const cats = mpResult.classifications[0].categories;
    tdMP.innerHTML = `<div style="margin-bottom:8px; font-size:11px; opacity:0.5">${mpTime}ms</div>` + 
                     cats.map(c => renderBadge(c.categoryName, c.score)).join('');
  } else {
    tdMP.innerHTML = `No results`;
  }

  // B) Transformers.js Inference
  const tfStart = performance.now();
  // Pass the image URL correctly. Transformers.js handles URL or Data URI.
  const tfResult = await tfClassifier(url);
  const tfTime = Math.round(performance.now() - tfStart);
  
  tdTF.innerHTML = `<div style="margin-bottom:8px; font-size:11px; opacity:0.5">${tfTime}ms</div>` + 
                   tfResult.map(c => renderBadge(c.label, c.score)).join('');
}

btnPick.addEventListener('click', async () => {
  if (!mpClassifier || !tfClassifier) {
    alert("Please wait for models to finish loading!");
    return;
  }

  try {
    const handle = await pickFolder('eval');
    status.textContent = `Scanning ${handle.name}...`;
    let files = [];
    try {
        files = await listImages(handle, { includeVideo: false, onlyVideo: false });
    } catch (e) {
        // fallback in case of context issues
    }
    
    if (!files.length) {
      status.textContent = `No images found in ${handle.name}`;
      return;
    }

    tbody.innerHTML = ''; // clear table
    status.textContent = `Evaluating ${files.length} images...`;

    // Eval sequentially
    for (const file of files) {
      await evalImage(file);
    }
    
    status.textContent = `Completed evaluation of ${files.length} images.`;

  } catch (err) {
    console.error(err);
    if (err.name !== 'AbortError') {
      status.textContent = `Error: ${err.message}`;
    } else {
      status.textContent = "Models loaded. Waiting for folder...";
    }
  }
});

// Boot
async function start() {
  await initDB();
  await loadModels();
}

start().catch(err => {
  console.error("Model load error:", err);
  status.textContent = "Failed to load AI models.";
});
