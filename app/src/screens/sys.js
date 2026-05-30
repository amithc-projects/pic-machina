import { getSettings, saveSettings } from '../utils/settings.js';
import { showToast } from '../main.js';
import { dbGet, dbPut } from '../data/db.js';
import { t, changeLanguage, getLanguage, SUPPORTED_LANGUAGES } from '../i18n/index.js';

export async function render(container, hash) {
  const current = getSettings();
  const palette = current.palette || [];
  
  // Fetch existing project root handle
  let projectRootHandle = null;
  try {
    const rootRecord = await dbGet('folders', 'project_root');
    if (rootRecord) projectRootHandle = rootRecord.handle;
  } catch (err) {
    console.warn('Failed to fetch project root handle', err);
  }

  container.innerHTML = `
    <style>
      .sys-screen .tab-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 12px;
        border: none;
        background: none;
        border-radius: 6px;
        cursor: pointer;
        color: var(--ps-text-muted);
        text-align: left;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.15s ease-in-out;
      }
      .sys-screen .tab-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--ps-text);
      }
      .sys-screen .tab-btn.active {
        background: rgba(59, 130, 246, 0.15);
        color: var(--ps-blue);
        font-weight: 600;
      }
      .sys-screen .settings-section-group {
        display: flex;
        flex-direction: column;
        gap: 24px;
        animation: sysFadeIn 0.2s ease-out;
      }
      .sys-screen .settings-section-group.hidden {
        display: none !important;
      }
      @keyframes sysFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>

    <div class="screen sys-screen" style="display:flex; flex-direction:column; height:100%; background:var(--ps-surface)">
      <div class="screen-header" style="flex-shrink:0;">
        <div class="flex items-center gap-2">
           <span class="material-symbols-outlined" style="color:var(--ps-blue)">settings</span>
           <div class="screen-title">${t('sys.title')}</div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-primary" id="settings-save">${t('sys.save')}</button>
        </div>
      </div>
      
      <div class="settings-layout" style="display:flex; flex:1; height:calc(100% - 48px); overflow:hidden;">
        <!-- Left Sidebar Navigation -->
        <div class="settings-sidebar" style="width:220px; border-right:1px solid var(--ps-border); background:var(--ps-bg-app); padding:16px 8px; display:flex; flex-direction:column; gap:4px; flex-shrink:0;">
          <button class="tab-btn active" data-tab="general">
            <span class="material-symbols-outlined" style="font-size:18px;">tune</span>
            ${t('sys.tabGeneral')}
          </button>
          <button class="tab-btn" data-tab="ai">
            <span class="material-symbols-outlined" style="font-size:18px;">psychology</span>
            ${t('sys.tabAi')}
          </button>
          <button class="tab-btn" data-tab="stock">
            <span class="material-symbols-outlined" style="font-size:18px;">imagesmode</span>
            ${t('sys.tabStock')}
          </button>
          <button class="tab-btn" data-tab="styling">
            <span class="material-symbols-outlined" style="font-size:18px;">palette</span>
            ${t('sys.tabStyling')}
          </button>
        </div>

        <!-- Right Content Panels -->
        <div class="settings-content" style="flex:1; padding:24px 32px; overflow-y:auto; display:flex; flex-direction:column; gap:28px;">
          
          <!-- TAB: General & Storage -->
          <div id="tab-sec-general" class="settings-section-group">
            <!-- Language -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.language')}</h4>
              <div style="background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <select id="cfg-language" class="ic-input" style="max-width:200px;">
                    ${SUPPORTED_LANGUAGES.map(l => `<option value="${l.code}" ${getLanguage().split('-')[0] === l.code ? 'selected' : ''}>${l.nativeLabel}</option>`).join('')}
                  </select>
                  <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px;">${t('sys.languageDesc')}</span>
                </div>
              </div>
            </section>

            <!-- Project Root Link -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.projectStorage')}</h4>
              <div style="background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                  <div style="display:flex; flex-direction:column;">
                    <span style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.projectRootDir')}</span>
                    <span id="project-root-status" style="font-size:11px; color:var(--ps-text-muted); margin-top:2px;">
                      ${projectRootHandle ? `<span style="color:var(--ps-green); display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> ${t('sys.linkedTo', { name: projectRootHandle.name })}</span>` : t('sys.notLinked')}
                    </span>
                  </div>
                  <button class="btn-secondary" id="btn-link-project" style="font-size:11px; padding:6px 12px;">
                    <span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">folder_shared</span>
                    ${projectRootHandle ? t('sys.changeLink') : t('sys.linkProjectFolder')}
                  </button>
                </div>
                <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.4;">
                  ${t('sys.projectStorageDesc')}
                </p>
              </div>
            </section>

            <!-- License Tier -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.licenseTier')}</h4>
              <div style="background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <select id="cfg-license" class="ic-input" style="max-width:200px;">
                    <option value="Free" ${current.license === 'Free' || !current.license ? 'selected' : ''}>${t('sys.licenseFree')}</option>
                    <option value="Pro" ${current.license === 'Pro' ? 'selected' : ''}>${t('sys.licensePro')}</option>
                    <option value="Enterprise" ${current.license === 'Enterprise' ? 'selected' : ''}>${t('sys.licenseEnterprise')}</option>
                  </select>
                  <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px;">${t('sys.licenseDesc')}</span>
                </div>
              </div>
            </section>

            <!-- Browser Capabilities -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.browserCaps')}</h4>
              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
                <input type="checkbox" id="cfg-html-in-canvas" ${current.capabilities?.htmlInCanvasConfirmed ? 'checked' : ''} style="margin-top:2px;" />
                <div style="display:flex; flex-direction:column;">
                  <span style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.htmlInCanvas')}</span>
                  <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px; line-height:1.4;">
                    ${t('sys.htmlInCanvasDesc')}
                    <a href="#hlp?id=html-in-canvas" style="color:var(--ps-accent); margin-left:4px;">${t('sys.howToEnable')}</a>
                  </span>
                </div>
              </label>
            </section>

            <!-- Smart Thumbnails -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.contentAwareThumbs')}</h4>
              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
                <input type="checkbox" id="cfg-smart-thumbs" ${current.thumbnails?.smart ? 'checked' : ''} style="margin-top:2px;" />
                <div style="display:flex; flex-direction:column;">
                  <span style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.smartThumbsLabel')}</span>
                  <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px; line-height:1.4;">
                    ${t('sys.smartThumbsDesc')}
                  </span>
                </div>
              </label>
              <div style="background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                  <div style="display:flex; flex-direction:column;">
                    <span style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.rebuildThumbsLabel')}</span>
                    <span id="rebuild-thumbs-status" style="font-size:11px; color:var(--ps-text-muted); margin-top:2px;">${t('sys.rebuildThumbsDesc')}</span>
                  </div>
                  <button class="btn-secondary" id="btn-rebuild-thumbs" style="font-size:11px; padding:6px 12px; flex-shrink:0;">
                    <span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">refresh</span>
                    ${t('sys.rebuild')}
                  </button>
                </div>
              </div>
            </section>

            <!-- Batch Core -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.batchEngine')}</h4>
              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; background:var(--ps-bg-app); padding:12px; border-radius:8px; border:1px solid var(--ps-border);">
                <input type="checkbox" id="cfg-batch-sync" ${current.batch?.useInputForOutput ? 'checked' : ''} style="margin-top:2px;" />
                <div style="display:flex; flex-direction:column;">
                  <span style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.batchSyncLabel')}</span>
                  <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px; line-height:1.4;">${t('sys.batchSyncDesc')}</span>
                </div>
              </label>
            </section>

            <!-- Usage Telemetry -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.telemetrySection')}</h4>
              <div style="background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:12px;">
                <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                  <input type="checkbox" id="cfg-telemetry-enabled" ${current.telemetry?.enabled !== false ? 'checked' : ''} style="margin-top:2px;" />
                  <div style="display:flex; flex-direction:column;">
                    <span style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.telemetryEnabledLabel')}</span>
                    <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px; line-height:1.4;">${t('sys.telemetryEnabledDesc')}</span>
                  </div>
                </label>
                <div style="border-top:1px solid var(--ps-border); padding-top:12px; display:flex; flex-direction:column; gap:4px;">
                  <label for="cfg-telemetry-endpoint" style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.telemetryEndpointLabel')}</label>
                  <input type="url" id="cfg-telemetry-endpoint" class="ic-input"
                    value="${current.telemetry?.endpoint || ''}"
                    placeholder="https://telemetry.zumilabs.workers.dev"
                    style="font-size:12px; font-family:var(--font-mono);"
                  />
                  <span style="font-size:11px; color:var(--ps-text-muted); margin-top:4px; line-height:1.4;">${t('sys.telemetryEndpointDesc')}</span>
                </div>
              </div>
            </section>

            <!-- Custom Color Swatches -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                    <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.colorSwatches')}</h4>
                    <button class="btn-ghost" id="btn-add-swatch" style="font-size:11px; padding:2px 6px;"><span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">add</span>${t('sys.addSwatch')}</button>
                </div>
                <span style="font-size:11px; color:var(--ps-text-muted);">${t('sys.colorSwatchesDesc')}</span>
              </div>
              
              <div id="swatch-list" style="display:flex; flex-direction:column; gap:10px; background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border);">
              </div>
            </section>
          </div>

          <!-- TAB: AI & Speech Integrations -->
          <div id="tab-sec-ai" class="settings-section-group hidden">
            <!-- AI Integration -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.aiIntegration')}</h4>
              <div style="background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label for="cfg-ai-endpoint" style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.aiEndpointLabel')}</label>
                  <input type="url" id="cfg-ai-endpoint" class="ic-input"
                    value="${current.ai?.describerEndpoint || ''}"
                    placeholder="https://your-server.example.com/describe"
                    style="font-size:12px; font-family:var(--font-mono);"
                  />
                </div>
                <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.5;">
                  ${t('sys.aiEndpointDesc')}
                </p>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                  <button class="btn-secondary" id="btn-test-ai-endpoint" style="font-size:11px; padding:5px 12px;">
                    <span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">electric_bolt</span>
                    ${t('sys.testConnection')}
                  </button>
                  <span id="ai-endpoint-test-result" style="font-size:11px; color:var(--ps-text-faint);"></span>
                </div>

                <!-- Local TTS Gateway -->
                <div style="border-top:1px solid var(--ps-border); padding-top:12px; display:flex; flex-direction:column; gap:4px;">
                  <label for="cfg-local-tts-url" style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.localTtsLabel')}</label>
                  <input type="url" id="cfg-local-tts-url" class="ic-input"
                    value="${current.localTts?.url || ''}"
                    placeholder="http://localhost:8000"
                    style="font-size:12px; font-family:var(--font-mono);"
                  />
                </div>
                <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.5;">
                  ${t('sys.localTtsDesc')}
                </p>
              </div>
            </section>

            <!-- Cloud Voice Providers -->
            <section id="cfg-cloud-voice-section" style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.cloudVoice')}</h4>
              <div style="background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label for="cfg-elevenlabs-key" style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.elevenLabsKey')}</label>
                  <input type="password" id="cfg-elevenlabs-key" class="ic-input"
                    value="${current.elevenlabs?.apiKey || ''}"
                    placeholder="${t('sys.elevenLabsPlaceholder')}"
                    autocomplete="off" spellcheck="false"
                    style="font-size:12px; font-family:var(--font-mono);"
                  />
                  <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.5;">
                    ${t('sys.elevenLabsDesc')}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <!-- TAB: Stock Media Providers -->
          <div id="tab-sec-stock" class="settings-section-group hidden">
            <!-- Stock Media Providers -->
            <section id="cfg-stock-section" style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.stockProviders')}</h4>
              <div style="background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label for="cfg-pexels-key" style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.pexelsKey')}</label>
                  <input type="password" id="cfg-pexels-key" class="ic-input"
                    value="${current.pexels?.apiKey || ''}"
                    placeholder="${t('sys.pexelsPlaceholder')}"
                    autocomplete="off" spellcheck="false"
                    style="font-size:12px; font-family:var(--font-mono);"
                  />
                  <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.5;">
                    ${t('sys.pexelsDesc')}
                  </p>
                </div>
              </div>
              <div style="background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label for="cfg-unsplash-key" style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.unsplashKey')}</label>
                  <input type="password" id="cfg-unsplash-key" class="ic-input"
                    value="${current.unsplash?.accessKey || ''}"
                    placeholder="${t('sys.unsplashPlaceholder')}"
                    autocomplete="off" spellcheck="false"
                    style="font-size:12px; font-family:var(--font-mono);"
                  />
                  <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.5;">
                    ${t('sys.unsplashDesc')}
                  </p>
                </div>
              </div>
              <div style="background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border); display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label for="cfg-pixabay-key" style="font-size:13px; font-weight:500; color:var(--ps-text);">${t('sys.pixabayKey')}</label>
                  <input type="password" id="cfg-pixabay-key" class="ic-input"
                    value="${current.pixabay?.apiKey || ''}"
                    placeholder="${t('sys.pixabayPlaceholder')}"
                    autocomplete="off" spellcheck="false"
                    style="font-size:12px; font-family:var(--font-mono);"
                  />
                  <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.5;">
                    ${t('sys.pixabayDesc')}
                  </p>
                </div>
              </div>
              <p style="margin:0; font-size:11px; color:var(--ps-text-faint); line-height:1.5;">
                ${t('sys.stockKeysNote')}
              </p>
            </section>
          </div>

          <!-- TAB: Fonts & Styling -->
          <div id="tab-sec-styling" class="settings-section-group hidden">
            <!-- Master Fonts -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                    <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.masterFonts')}</h4>
                    <button class="btn-ghost" id="btn-add-font" style="font-size:11px; padding:2px 6px;"><span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">add</span>${t('sys.addFont')}</button>
                </div>
                <span style="font-size:11px; color:var(--ps-text-muted);">${t('sys.masterFontsDesc')}</span>
              </div>
              
              <div id="font-list" style="display:flex; flex-direction:column; gap:10px; background:var(--ps-bg-app); padding:16px; border-radius:8px; border:1px solid var(--ps-border);">
              </div>
            </section>

            <!-- Text Styles -->
            <section style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                    <h4 style="margin:0; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; color:var(--ps-text-faint);">${t('sys.textStyles')}</h4>
                    <button class="btn-ghost" id="btn-add-text-style" style="font-size:11px; padding:2px 6px;"><span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">add</span>${t('sys.addStyle')}</button>
                </div>
                <span style="font-size:11px; color:var(--ps-text-muted);">${t('sys.textStylesDesc')}</span>
              </div>
              
              <div id="text-style-list" style="display:flex; flex-direction:column; gap:10px;">
              </div>
            </section>
          </div>
          
        </div>
      </div>
    </div>
  `;

  const swatchList = container.querySelector('#swatch-list');
  const textStyleList = container.querySelector('#text-style-list');
  const fontList = container.querySelector('#font-list');
  const textStyles = current.textStyles || [];
  const masterFonts = current.masterFonts || [];

  // Handle tab switching
  const tabs = container.querySelectorAll('.tab-btn');
  const groups = container.querySelectorAll('.settings-section-group');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(tb => tb.classList.remove('active'));
      tab.classList.add('active');
      const targetTab = tab.dataset.tab;
      groups.forEach(group => {
        if (group.id === `tab-sec-${targetTab}`) {
          group.classList.remove('hidden');
        } else {
          group.classList.add('hidden');
        }
      });
    };
  });

  const renderMasterFonts = () => {
    fontList.innerHTML = masterFonts.map((mf, idx) => `
      <div class="mf-row" data-idx="${idx}" style="display:flex; align-items:center; gap:8px;">
        <input type="text" class="ic-input mf-label" value="${mf.label}" placeholder="${t('sys.fontDisplayPlaceholder')}" style="flex:1;" />
        <input type="text" class="ic-input mf-value" value="${(mf.value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" placeholder="${t('sys.fontFamilyPlaceholder')}" style="flex:1;" />
        <button class="btn-icon btn-remove-mf" title="${t('sys.removeFont')}" style="color:var(--ps-red); width:28px; height:28px;">
            <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
        </button>
      </div>
    `).join('');
    
    if (masterFonts.length === 0) {
        fontList.innerHTML = `<span style="font-size:11px; color:var(--ps-text-faint);">${t('sys.noFonts')}</span>`;
    }

    container.querySelectorAll('.btn-remove-mf').forEach(btn => {
      btn.onclick = (e) => {
          const idx = parseInt(e.currentTarget.closest('.mf-row').dataset.idx);
          masterFonts.splice(idx, 1);
          renderMasterFonts();
          renderTextStyles();
      };
    });
    
    container.querySelectorAll('.mf-label').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.mf-row').dataset.idx);
           masterFonts[idx].label = e.target.value;
           renderTextStyles();
       };
    });

    container.querySelectorAll('.mf-value').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.mf-row').dataset.idx);
           masterFonts[idx].value = e.target.value;
       };
    });
  };

  renderMasterFonts();

  container.querySelector('#btn-add-font').onclick = () => {
      masterFonts.push({ id: 'font-' + Math.random().toString(36).substr(2, 9), label: t('sys.newFont'), value: 'sans-serif' });
      renderMasterFonts();
      renderTextStyles();
  };

  const renderTextStyles = () => {
    textStyleList.innerHTML = textStyles.map((ts, idx) => `
      <div class="ts-row" data-idx="${idx}" style="display:flex; flex-direction:column; gap:8px; padding:12px; border:1px solid var(--ps-border); border-radius:8px; background:var(--ps-bg-app);">
         <div style="display:flex; align-items:center; gap:8px;">
            <input type="text" class="ic-input ts-name" value="${ts.name || ''}" placeholder="${t('sys.styleNamePlaceholder')}" style="font-weight:600; flex:1; font-size:13px;" />
            <button class="btn-icon btn-remove-ts" title="${t('sys.removeStyle')}" style="color:var(--ps-red); width:28px; height:28px;"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button>
         </div>
         <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <select class="ic-input ts-font" title="${t('sys.fontFamilyTitle')}" style="width:100%; min-width:0;">
                ${masterFonts.map(mf => `<option value="${(mf.value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" ${ts.fontFamily === mf.value ? 'selected' : ''}>${mf.label}</option>`).join('')}
                ${!masterFonts.find(mf => mf.value === ts.fontFamily) && ts.fontFamily ? `<option value="${(ts.fontFamily || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" selected>${t('sys.fontCustom', { font: ts.fontFamily })}</option>` : ''}
            </select>
            <div style="display:flex; gap:4px;">
               <input type="number" class="ic-input ts-size" value="${ts.size || 32}" placeholder="${t('sys.sizePlaceholder')}" style="flex:1; width:0;" />
               <select class="ic-input ts-size-mode" style="flex:1; width:0;">
                   <option value="px" ${ts.sizeMode==='px'?'selected':''}>${t('sys.unitPx')}</option>
                   <option value="pct-width" ${ts.sizeMode==='pct-width'?'selected':''}>${t('sys.unitPctW')}</option>
                   <option value="pct-height" ${ts.sizeMode==='pct-height'?'selected':''}>${t('sys.unitPctH')}</option>
               </select>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
               <input type="color" class="ts-color" value="${ts.color || '#ffffff'}" style="width:28px; height:28px; padding:0; border:1px solid var(--ps-border); border-radius:4px; cursor:pointer;" title="${t('sys.textColor')}" />
               <select class="ic-input ts-weight" style="flex:1; width:0;">
                   <option value="300" ${ts.weight==='300'?'selected':''}>${t('sys.weightLight')}</option>
                   <option value="400" ${ts.weight==='400'?'selected':''}>${t('sys.weightNormal')}</option>
                   <option value="700" ${ts.weight==='700'?'selected':''}>${t('sys.weightBold')}</option>
               </select>
            </div>
            <div style="display:flex; align-items:center; gap:4px; padding-left:4px;">
                <label style="display:flex; align-items:center; gap:4px; font-size:11px; color:var(--ps-text-muted); cursor:pointer;">
                  <input type="checkbox" class="ts-shadow" ${ts.shadow?'checked':''} style="margin:0;" /> ${t('sys.shadow')}
                </label>
                <input type="text" class="ic-input ts-shadow-color" value="${ts.shadowColor || 'rgba(0,0,0,0.8)'}" style="flex:1; width:0; font-family:monospace; font-size:11px;" title="${t('sys.shadowColorTitle')}"/>
            </div>
            <select class="ic-input ts-bg-box">
                <option value="none" ${ts.bgBox==='none'?'selected':''}>${t('sys.bgNone')}</option>
                <option value="wrap" ${ts.bgBox==='wrap'?'selected':''}>${t('sys.bgWrap')}</option>
                <option value="full-width" ${ts.bgBox==='full-width'?'selected':''}>${t('sys.bgFullWidth')}</option>
            </select>
            <div style="display:flex; align-items:center; gap:4px;">
                <input type="color" class="ts-bg-color" value="${ts.bgColor || '#000000'}" style="width:28px; height:28px; padding:0; border:1px solid var(--ps-border); border-radius:4px; cursor:pointer;" title="${t('sys.bgColorTitle')}"/>
                <input type="number" class="ic-input ts-bg-opacity" value="${ts.bgOpacity ?? 60}" min="0" max="100" placeholder="${t('sys.opacityPlaceholder')}" title="${t('sys.opacityTitle')}" style="flex:1; width:0;" />
                <input type="number" class="ic-input ts-bg-padding" value="${ts.bgPadding ?? 8}" placeholder="${t('sys.padPlaceholder')}" title="${t('sys.padTitle')}" style="flex:1; width:0;" />
            </div>
         </div>
      </div>
    `).join('');
    
    if (textStyles.length === 0) {
        textStyleList.innerHTML = `<span style="font-size:11px; color:var(--ps-text-faint);">${t('sys.noTextStyles')}</span>`;
    }

    container.querySelectorAll('.btn-remove-ts').forEach(btn => {
      btn.onclick = (e) => {
          const idx = parseInt(e.currentTarget.closest('.ts-row').dataset.idx);
          textStyles.splice(idx, 1);
          renderTextStyles();
      };
    });

    const bindUpdate = (selector, key, isCheckbox = false, isNumeric = false) => {
        container.querySelectorAll(selector).forEach(el => {
            el.onchange = (e) => {
                const idx = parseInt(e.currentTarget.closest('.ts-row').dataset.idx);
                let val = isCheckbox ? e.target.checked : e.target.value;
                if (isNumeric) val = parseFloat(val);
                textStyles[idx][key] = val;
            };
        });
    };

    bindUpdate('.ts-name', 'name');
    bindUpdate('.ts-font', 'fontFamily');
    bindUpdate('.ts-size', 'size', false, true);
    bindUpdate('.ts-size-mode', 'sizeMode');
    bindUpdate('.ts-color', 'color');
    bindUpdate('.ts-weight', 'weight');
    bindUpdate('.ts-shadow', 'shadow', true);
    bindUpdate('.ts-shadow-color', 'shadowColor');
    bindUpdate('.ts-bg-box', 'bgBox');
    bindUpdate('.ts-bg-color', 'bgColor');
    bindUpdate('.ts-bg-opacity', 'bgOpacity', false, true);
    bindUpdate('.ts-bg-padding', 'bgPadding', false, true);
  };
  
  renderTextStyles();

  container.querySelector('#btn-add-text-style').onclick = () => {
      textStyles.push({
          id: 'style-' + Math.random().toString(36).substr(2, 9),
          name: t('sys.newStyle'), fontFamily: 'Inter', sizeMode: 'px', size: 32,
          color: '#ffffff', weight: '400', shadow: true, shadowColor: 'rgba(0,0,0,0.8)',
          bgBox: 'none', bgColor: '#000000', bgOpacity: 60, bgPadding: 8
      });
      renderTextStyles();
  };

  const renderSwatches = () => {
    swatchList.innerHTML = palette.map((swatch, idx) => `
      <div class="swatch-row" data-idx="${idx}" style="display:flex; align-items:center; gap:8px;">
        <input type="color" class="swatch-color" value="${swatch.color}" style="width:32px; height:32px; padding:0; border:1px solid var(--ps-border); border-radius:4px; cursor:pointer;" />
        <input type="text" class="ic-input swatch-label" value="${swatch.label}" placeholder="${t('sys.colorNamePlaceholder')}" style="flex:1;" />
        <button class="btn-icon btn-remove-swatch" title="${t('sys.remove')}" style="color:var(--ps-red); width:28px; height:28px;">
            <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
        </button>
      </div>
    `).join('');
    
    if (palette.length === 0) {
        swatchList.innerHTML = `<span style="font-size:11px; color:var(--ps-text-faint);">${t('sys.noSwatches')}</span>`;
    }

    container.querySelectorAll('.btn-remove-swatch').forEach(btn => {
      btn.onclick = (e) => {
          const idx = parseInt(e.currentTarget.closest('.swatch-row').dataset.idx);
          palette.splice(idx, 1);
          renderSwatches();
      };
    });
    
    container.querySelectorAll('.swatch-color').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.swatch-row').dataset.idx);
           palette[idx].color = e.target.value;
       };
    });

    container.querySelectorAll('.swatch-label').forEach(input => {
       input.onchange = (e) => {
           const idx = parseInt(e.currentTarget.closest('.swatch-row').dataset.idx);
           palette[idx].label = e.target.value;
       };
    });
  };

  renderSwatches();

  container.querySelector('#btn-link-project').onclick = async (e) => {
    try {
      const handle = await window.showDirectoryPicker();
      if (handle) {
        await dbPut('folders', { key: 'project_root', handle });
        projectRootHandle = handle;
        container.querySelector('#project-root-status').innerHTML = `<span style="color:var(--ps-green); display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> ${t('sys.linkedTo', { name: handle.name })}</span>`;
        e.target.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">folder_shared</span> ${t('sys.changeLink')}`;
        showToast({ variant: 'success', title: t('sys.toastLinked'), description: t('sys.toastLinkedDesc', { name: handle.name }) });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast({ variant: 'error', title: t('sys.toastLinkFailed'), description: err.message });
      }
    }
  };

  container.querySelector('#btn-rebuild-thumbs').onclick = async (e) => {
    const btn    = e.currentTarget;
    const status = container.querySelector('#rebuild-thumbs-status');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">hourglass_top</span> ${t('sys.working')}`;
    try {
      const { generateSmartThumbnail, dataUrlToBlob } = await import('../utils/thumbnails.js');
      const { isModelReady } = await import('../engine/ai/inspyrenet.js');
      if (!(await isModelReady())) {
        status.textContent = t('sys.modelNotReady');
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">refresh</span> ${t('sys.rebuild')}`;
        return;
      }

      const { getAllRecipes, saveRecipe } = await import('../data/recipes.js');
      const { getAllShowcases, saveShowcase } = await import('../data/showcases.js');

      const recipes = (await getAllRecipes()).filter(r => !!r.thumbnail);
      const showcases = (await getAllShowcases()).filter(s => !!s.thumbnail);
      const total = recipes.length + showcases.length;
      let done = 0, skipped = 0;

      status.textContent = t('sys.rebuildProgress', { done: 0, total });

      for (const recipe of recipes) {
        try {
          const blob = await dataUrlToBlob(recipe.thumbnail);
          const smart = await generateSmartThumbnail(blob, { width: 480, height: 300 });
          if (smart) { recipe.thumbnail = smart.dataUrl; await saveRecipe(recipe); }
          else skipped++;
        } catch (err) { console.warn('rebuild recipe thumb failed', err); skipped++; }
        done++;
        status.textContent = t('sys.rebuildProgress', { done, total });
      }

      for (const entry of showcases) {
        try {
          const blob = await dataUrlToBlob(entry.thumbnail);
          const smart = await generateSmartThumbnail(blob, { width: 640, height: 400 });
          if (smart) { entry.thumbnail = smart.dataUrl; await saveShowcase(entry); }
          else skipped++;
        } catch (err) { console.warn('rebuild showcase thumb failed', err); skipped++; }
        done++;
        status.textContent = t('sys.rebuildProgress', { done, total });
      }

      const success = total - skipped;
      status.textContent = t('sys.rebuildDone', { success, skipped });
      showToast({ variant: 'success', title: t('sys.toastRebuilt'), description: t('sys.toastRebuiltDesc', { success, skipped }) });
    } catch (err) {
      console.error(err);
      status.textContent = t('sys.rebuildFailed', { error: err.message || err });
      showToast({ variant: 'error', title: t('sys.toastRebuildFailed'), description: err.message || String(err) });
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; margin-right:6px;">refresh</span> ${t('sys.rebuild')}`;
    }
  };

  // AI endpoint test
  container.querySelector('#btn-test-ai-endpoint').onclick = async (e) => {
    const btn    = e.currentTarget;
    const result = container.querySelector('#ai-endpoint-test-result');
    const url    = container.querySelector('#cfg-ai-endpoint').value.trim();
    if (!url) { result.textContent = t('sys.noUrl'); result.style.color = 'var(--ps-text-faint)'; return; }
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">hourglass_empty</span>${t('sys.testing')}`;
    result.textContent = '';
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      result.textContent = t('sys.reachable', { status: resp.status });
      result.style.color = 'var(--ps-green, #22c55e)';
    } catch (err) {
      result.textContent = t('sys.unreachable', { error: err.message || t('sys.unreachableDefault') });
      result.style.color = 'var(--ps-red, #f87171)';
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px; margin-right:4px;">electric_bolt</span>${t('sys.testConnection')}`;
    }
  };

  container.querySelector('#btn-add-swatch').onclick = () => {
      palette.push({ label: t('sys.newColor'), color: '#ff0000' });
      renderSwatches();
  };

  container.querySelector('#cfg-language').addEventListener('change', (e) => {
    changeLanguage(e.target.value);
  });

  container.querySelector('#cfg-license').addEventListener('change', (e) => {
    saveSettings({ license: e.target.value });
    window.location.reload();
  });

  container.querySelector('#settings-save').onclick = () => {
    const nextPalette = [];
    swatchList.querySelectorAll('.swatch-row').forEach(row => {
       nextPalette.push({
           color: row.querySelector('.swatch-color').value,
           label: row.querySelector('.swatch-label').value.trim() || t('sys.untitled')
       });
    });

    saveSettings({
      license: container.querySelector('#cfg-license').value,
      capabilities: {
        htmlInCanvasConfirmed: container.querySelector('#cfg-html-in-canvas').checked
      },
      batch: {
        useInputForOutput: container.querySelector('#cfg-batch-sync').checked
      },
      telemetry: {
        enabled: container.querySelector('#cfg-telemetry-enabled').checked,
        endpoint: container.querySelector('#cfg-telemetry-endpoint').value.trim()
      },
      thumbnails: {
        smart: container.querySelector('#cfg-smart-thumbs').checked
      },
      ai: {
        describerEndpoint: container.querySelector('#cfg-ai-endpoint').value.trim()
      },
      pexels: {
        apiKey: container.querySelector('#cfg-pexels-key').value.trim()
      },
      unsplash: {
        accessKey: container.querySelector('#cfg-unsplash-key').value.trim()
      },
      pixabay: {
        apiKey: container.querySelector('#cfg-pixabay-key').value.trim()
      },
      elevenlabs: {
        apiKey: container.querySelector('#cfg-elevenlabs-key').value.trim()
      },
      localTts: {
        url: container.querySelector('#cfg-local-tts-url').value.trim()
      },
      palette: nextPalette,
      textStyles: textStyles,
      masterFonts: masterFonts
    });

    // Invalidate html-in-canvas capability cache so the new setting is picked
    // up immediately without requiring a page reload.
    import('../engine/capabilities.js').then(({ invalidate }) => invalidate('html-in-canvas', 'wicg-drawhtml'));

    showToast({ variant: 'success', title: t('sys.toastSaved'), description: t('sys.toastSavedDesc') });
  };
}
