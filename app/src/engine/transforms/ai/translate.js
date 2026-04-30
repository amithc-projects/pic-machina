import { registry } from '../../registry.js';

registry.register({
  id: 'ai-translate-text', name: 'Translate Variable', category: 'Flow Control', categoryKey: 'flow',
  icon: 'translate',
  description: 'Translates a text variable using Chrome\'s built-in offline AI Translation API.',
  params: [
    { name: 'inputVar', label: 'Input Variable Name', type: 'text', defaultValue: 'autoCaptions' },
    { name: 'outputVar', label: 'Output Variable Name', type: 'text', defaultValue: 'translatedCaptions' },
    { name: 'sourceLanguage', label: 'Source Language Code (e.g. en)', type: 'text', defaultValue: 'en' },
    { name: 'targetLanguage', label: 'Target Language Code (e.g. fr)', type: 'text', defaultValue: 'fr' },
    { name: 'chunkSeparator', label: 'Chunk By', type: 'select', 
      options: [
        { label: 'Newlines', value: '\\n' },
        { label: 'Double Newlines', value: '\\n\\n' },
        { label: 'Sentences', value: '.' }
      ], defaultValue: '\\n' }
  ],
  async apply(ctx, p, context) {
    // Determine the Translation API object. Chrome uses window.translation or window.ai.translator.
    // The user's snippet referenced Translator.create. We check all potential global namespaces.
    let translationAPI = null;
    if (typeof self !== 'undefined') {
      translationAPI = self.translation || (self.ai && self.ai.translator) || self.Translator;
    }
    
    if (!translationAPI) {
      console.warn('[ai-translate-text] Translation API not available in this browser. Ensure Chrome 131+ with AI flags enabled.');
      context?.log?.('warn', '[ai-translate-text] Translation API not available.');
      return;
    }

    const inputVar = p.inputVar || 'autoCaptions';
    const outputVar = p.outputVar || 'translatedCaptions';
    const sourceLanguage = p.sourceLanguage || 'en';
    const targetLanguage = p.targetLanguage || 'fr';
    let sep = p.chunkSeparator || '\\n';
    
    // Parse escaped newlines since they come through as literal backslash-n from the UI dropdown
    if (sep === '\\n') sep = '\n';
    if (sep === '\\n\\n') sep = '\n\n';

    // Retrieve input text from engine variables or sidecar metadata
    const text = context.variables?.get(inputVar) || context.meta?.[inputVar];
    if (!text || typeof text !== 'string') {
      context?.log?.('warn', `[ai-translate-text] Variable '${inputVar}' not found or is not a string.`);
      return;
    }

    try {
      let translator;
      const options = { sourceLanguage, targetLanguage };

      // Initialize translator
      if (translationAPI.createTranslator) {
        translator = await translationAPI.createTranslator(options);
      } else if (translationAPI.create) {
        translator = await translationAPI.create(options);
      } else {
        throw new Error("Translation API found but 'create' or 'createTranslator' method missing.");
      }

      let translatedText;

      // Smartly detect SRT/VTT format
      const isSRT = text.includes('-->') && /\d{2}:\d{2}:\d{2}/.test(text);
      if (isSRT) {
        context?.log?.('info', `[ai-translate-text] Detected SRT/VTT format, parsing carefully to preserve timestamps...`);
        const { parseSubtitles } = await import('../../../utils/subtitles.js');
        const subs = parseSubtitles(text);
        const results = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < subs.length; i += BATCH_SIZE) {
          const batch = subs.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async (sub) => {
            if (!sub.text.trim()) return sub;
            try {
              const tText = await translator.translate(sub.text);
              return { ...sub, text: tText };
            } catch (err) {
              console.warn(`[ai-translate-text] Chunk failed:`, err);
              return sub;
            }
          });
          results.push(...(await Promise.all(batchPromises)));
        }

        const toSRTTime = (seconds) => {
          const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
          const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
          const s = Math.floor(seconds % 60).toString().padStart(2, '0');
          const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
          return `${h}:${m}:${s},${ms}`;
        };

        translatedText = results.map((sub, idx) => {
          return `${idx + 1}\n${toSRTTime(sub.start)} --> ${toSRTTime(sub.end)}\n${sub.text}`;
        }).join('\n\n');

      } else {
        // Chunk the text to optimize performance and prevent timeout on large texts
        const chunks = text.split(sep);
        const results = [];
        const BATCH_SIZE = 5;

        context?.log?.('info', `[ai-translate-text] Translating ${chunks.length} chunks (${sourceLanguage} -> ${targetLanguage})...`);

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async (chunk) => {
            if (!chunk.trim()) return chunk; // preserve empty chunks (e.g. blank lines)
            return await translator.translate(chunk);
          });
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
        }
        
        translatedText = results.join(sep);
      }
      
      // Store result
      if (context.variables) context.variables.set(outputVar, translatedText);
      if (context.meta) context.meta[outputVar] = translatedText;

      // Some Chrome versions require destroying the translator to free memory
      if (translator.destroy) translator.destroy();
      
      context?.log?.('info', `[ai-translate-text] Translated and saved to ${outputVar}.`);
      
    } catch (err) {
      console.error('[ai-translate-text] failed:', err);
      context?.log?.('warn', `[ai-translate-text] failed: ${err.message || err}`);
    }
  }
});
