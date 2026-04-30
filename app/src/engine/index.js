/**
 * ImageChef — Engine bootstrap
 * Registers all transforms and exports the processor for main-thread preview use.
 */

// Register all transforms
import './transforms/geometry.js';
import './transforms/color.js';
import './transforms/overlays.js';
import './transforms/ai.js';
import './transforms/ai/diarize.js';
import './transforms/ai/translate.js';
import './transforms/audio.js';
import './transforms/metadata.js';
import './transforms/flow.js';
import './transforms/video.js';

export { registry }       from './registry.js';
export { imageProcessor, ImageProcessor } from './processor.js';
export { extractExif }    from './exif-reader.js';
export { createGIF, createVideo, createContactSheet } from './compositor.js';
