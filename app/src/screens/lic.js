import { getSettings, saveSettings } from '../utils/settings.js';

export async function render(container, hash) {
  const settings = getSettings();
  const currentLicense = settings.license || 'Free';

  const selectPlan = async (plan) => {
    saveSettings({ license: plan });
    window.location.reload();
  };

  // Add the selectPlan function to window so the inline handlers can access it
  window._icSelectPlan = selectPlan;

  container.innerHTML = `
    <div class="h-full bg-[var(--ps-bg)] flex flex-col items-center overflow-y-auto px-4 py-12">
      <div class="text-center" style="margin-bottom: 56px;">
        <h1 class="text-4xl font-bold text-[var(--ps-text)] mb-4">Choose Your Plan</h1>
        <p class="text-[var(--ps-text-muted)] text-lg">Select the right tier for your workflow needs.</p>
      </div>

      <div class="flex flex-wrap justify-center gap-6 max-w-[1000px] w-full">
        <!-- FREE PLAN -->
        <div class="lic-card ${currentLicense === 'Free' ? 'is-active' : ''}">
          <div class="lic-card-header">
            <h2 class="text-xl font-bold mb-2">Free</h2>
            <div class="text-3xl font-bold mb-1">$0 <span class="text-sm font-normal text-[var(--ps-text-muted)]">/ forever</span></div>
            <p class="text-sm text-[var(--ps-text-muted)] h-10">Essential tools for personal projects.</p>
          </div>
          <ul class="lic-features mb-8">
            <li><span class="material-symbols-outlined text-green-500">check_circle</span> Basic image processing</li>
            <li><span class="material-symbols-outlined text-green-500">check_circle</span> Standard export formats</li>
            <li><span class="material-symbols-outlined text-green-500">check_circle</span> Create custom recipes</li>
            <li><span class="material-symbols-outlined text-green-500">check_circle</span> Access to community templates</li>
          </ul>
          <button class="lic-btn w-full mt-auto ${currentLicense === 'Free' ? 'lic-btn-active' : 'lic-btn-free'}" onclick="window._icSelectPlan('Free')">
            ${currentLicense === 'Free' ? 'Current Plan' : 'Downgrade to Free'}
          </button>
        </div>

        <!-- PRO PLAN -->
        <div class="lic-card lic-card-pro ${currentLicense === 'Pro' ? 'is-active' : ''}">
          <div class="lic-badge-popular">Most Popular</div>
          <div class="lic-card-header pt-6">
            <h2 class="text-xl font-bold mb-2 text-blue-400">Pro</h2>
            <div class="text-3xl font-bold mb-1">$29 <span class="text-sm font-normal text-[var(--ps-text-muted)]">/ month</span></div>
            <p class="text-sm text-[var(--ps-text-muted)] h-10">Advanced capabilities for creative professionals.</p>
          </div>
          <ul class="lic-features mb-8">
            <li><span class="material-symbols-outlined text-blue-400">check_circle</span> <b>Everything in Free, plus:</b></li>
            <li><span class="material-symbols-outlined text-blue-400">check_circle</span> Advanced AI integrations</li>
            <li><span class="material-symbols-outlined text-blue-400">check_circle</span> Video & Audio generation workflows</li>
            <li><span class="material-symbols-outlined text-blue-400">check_circle</span> Unlimited batch processing</li>
            <li><span class="material-symbols-outlined text-blue-400">check_circle</span> Graphic Novel and Style transfers</li>
          </ul>
          <button class="lic-btn w-full mt-auto ${currentLicense === 'Pro' ? 'lic-btn-active' : 'lic-btn-pro'}" onclick="window._icSelectPlan('Pro')">
            ${currentLicense === 'Pro' ? 'Current Plan' : 'Select Pro'}
          </button>
        </div>

        <!-- ENTERPRISE PLAN -->
        <div class="lic-card ${currentLicense === 'Enterprise' ? 'is-active' : ''}">
          <div class="lic-card-header">
            <h2 class="text-xl font-bold mb-2 text-purple-400">Enterprise</h2>
            <div class="text-3xl font-bold mb-1">Custom</div>
            <p class="text-sm text-[var(--ps-text-muted)] h-10">For teams needing scale and collaboration.</p>
          </div>
          <ul class="lic-features mb-8">
            <li><span class="material-symbols-outlined text-purple-400">check_circle</span> <b>Everything in Pro, plus:</b></li>
            <li><span class="material-symbols-outlined text-purple-400">check_circle</span> Integrations with Enterprise software</li>
            <li><span class="material-symbols-outlined text-purple-400">check_circle</span> Shared recipe repository</li>
            <li><span class="material-symbols-outlined text-purple-400">check_circle</span> Share with Slack</li>
            <li><span class="material-symbols-outlined text-purple-400">check_circle</span> Priority 24/7 support</li>
          </ul>
          <button class="lic-btn w-full mt-auto ${currentLicense === 'Enterprise' ? 'lic-btn-active' : 'lic-btn-ent'}" onclick="window._icSelectPlan('Enterprise')">
            ${currentLicense === 'Enterprise' ? 'Current Plan' : 'Select Enterprise'}
          </button>
        </div>
      </div>
    </div>
  `;

  injectStyles();

  return () => {
    delete window._icSelectPlan;
  };
}

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .lic-card {
      background: var(--ps-bg-surface);
      border: 1px solid var(--ps-border);
      border-radius: 12px;
      padding: 24px;
      width: 300px;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }
    .lic-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .lic-card.is-active {
      border-color: var(--ps-blue);
      box-shadow: 0 0 0 1px var(--ps-blue);
    }
    .lic-card-pro {
      border-color: rgba(56, 189, 248, 0.4);
      background: linear-gradient(180deg, rgba(56,189,248,0.05) 0%, var(--ps-bg-surface) 150px);
    }
    .lic-card-pro.is-active {
      border-color: var(--ps-blue);
      box-shadow: 0 0 0 1px var(--ps-blue), 0 0 20px rgba(56, 189, 248, 0.2);
    }
    .lic-badge-popular {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ps-blue);
      color: #fff;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 12px;
      border-radius: 9999px;
      box-shadow: 0 4px 6px -1px rgba(0, 119, 255, 0.3);
    }
    .lic-card-header {
      margin-bottom: 24px;
    }
    .lic-btn {
      padding: 12px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 15px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .lic-btn-active {
      background: transparent;
      color: var(--ps-text);
      border: 1px solid var(--ps-border);
      cursor: default;
      pointer-events: none;
      box-shadow: none;
    }
    .lic-btn-free {
      background: var(--ps-bg-raised);
      border: 1px solid var(--ps-border);
      color: var(--ps-text);
    }
    .lic-btn-free:hover {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.5);
      color: #fff;
    }
    .lic-btn-pro {
      background: var(--ps-blue);
      border: 1px solid var(--ps-blue);
      color: #fff;
      box-shadow: 0 4px 14px 0 rgba(0, 119, 255, 0.39);
    }
    .lic-btn-pro:hover {
      background: #0066e6;
      box-shadow: 0 6px 20px rgba(0, 119, 255, 0.4);
      transform: translateY(-1px);
    }
    .lic-btn-ent {
      background: rgba(192, 132, 252, 0.1);
      border: 1px solid rgba(192, 132, 252, 0.5);
      color: rgb(192, 132, 252);
    }
    .lic-btn-ent:hover {
      background: rgba(192, 132, 252, 0.2);
      border-color: rgba(192, 132, 252, 0.8);
      color: #fff;
    }
    .lic-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
    }
    .lic-features li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 13px;
      color: var(--ps-text);
      line-height: 1.4;
    }
    .lic-features .material-symbols-outlined {
      font-size: 18px;
      margin-top: 1px;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(s);
}
