import { env, AutoProcessor, ChatterboxModel, Tensor } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/chatterbox-ONNX';

let model = null;
let processor = null;
const speakerCache = new Map();

// Isolate cross-origin worker worker initialization error
env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
}

self.addEventListener('message', async (e) => {
    const { type, payload } = e.data;
    try {
        switch (type) {
            case 'load':
                await loadModel(payload);
                break;
            case 'generate':
                await generateAudio(payload);
                break;
            default:
                self.postMessage({ type: 'error', payload: `Unknown type: ${type}` });
        }
    } catch (err) {
        self.postMessage({ type: 'error', payload: err.message, stack: err.stack });
    }
});

async function loadModel(data) {
    const { useWebGPU } = data;
    const useDevice = useWebGPU ? 'webgpu' : 'wasm';
    
    // Request q4f16 for webgpu to leverage hardware optimization. 
    // Request q4 for wasm.
    const useLanguageModel = useDevice === 'webgpu' ? 'q4f16' : 'q4';

    if (!processor) {
        processor = await AutoProcessor.from_pretrained(MODEL_ID);
    }
    
    if (!model) {
        model = await ChatterboxModel.from_pretrained(MODEL_ID, {
            device: useDevice,
            dtype: {
                embed_tokens: 'fp32',
                speech_encoder: 'fp32',
                language_model: useLanguageModel,
                conditional_decoder: 'fp32',
            },
            progress_callback: (progress) => {
                self.postMessage({ type: 'progress', payload: progress });
            }
        });
    }

    self.postMessage({ type: 'load:complete', payload: { device: useDevice } });
}

async function generateAudio(data) {
    const { text, refFloat32Array, speakerId, emotionVal } = data;

    if (!model || !processor) throw new Error('Model not loaded');

    // 1. Encode Speaker (cache it)
    let speakerEmbeddings = speakerCache.get(speakerId);
    if (!speakerEmbeddings) {
        self.postMessage({ type: 'progress', payload: { status: 'encoding_speaker' } });
        // Tensor shape [1, length]
        const audioTensor = new Tensor('float32', refFloat32Array, [1, refFloat32Array.length]);
        speakerEmbeddings = await model.encode_speech(audioTensor);
        speakerCache.set(speakerId, speakerEmbeddings);
    }

    // 2. Generate
    self.postMessage({ type: 'progress', payload: { status: 'generating' } });
    const inputs = await processor._call(text);
    
    const waveform = await model.generate({
        ...inputs,
        ...speakerEmbeddings,
        exaggeration: emotionVal,
        max_new_tokens: 256,
    });

    const waveformData = waveform.data;
    const buffer = waveformData.buffer.slice(
        waveformData.byteOffset,
        waveformData.byteOffset + waveformData.byteLength
    );

    self.postMessage(
        { type: 'generate:complete', payload: { waveform: buffer } },
        [buffer] // Transfer ownership
    );
}
