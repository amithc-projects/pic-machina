/**
 * ImageChef — Getting Started Screen
 *
 * An introductory page that explains the use cases and capabilities
 * of the ZumiLabs Studio platform.
 */

import { navigate } from '../main.js';
import { t } from '../i18n/index.js';

export async function render(container) {
  container.innerHTML = `
    <div class="screen get-screen">
      <!-- Hero Section -->
      <section class="get-hero">
        <div class="get-hero__content">
          <h1 class="get-hero__title">${t('get.heroTitle')}</h1>
          <p class="get-hero__subtitle">
            ${t('get.heroSubtitle')}
          </p>
          <div class="get-hero__actions">
            <button class="btn-primary btn-lg" id="btn-get-start">
               <span class="material-symbols-outlined">add</span> ${t('get.createRecipe')}
            </button>
            <button class="btn-secondary btn-lg" id="btn-get-library">
               <span class="material-symbols-outlined">library_books</span> ${t('get.browseLibrary')}
            </button>
          </div>
        </div>
      </section>

      <!-- Explainer Video -->
      <section class="get-video-section">
        <div class="get-video-wrapper">
          <video class="get-video" controls poster="/branding/brand-pack/social/twitter-card-1200x600.png">
            <!-- Placeholder for actual video source -->
            <source src="#" type="video/mp4">
            ${t('get.videoUnsupported')}
          </video>
        </div>
      </section>

      <!-- Core Capabilities Grid -->
      <section class="get-core-section">
        <h2 class="get-section-title">${t('get.coreTitle')}</h2>
        <div class="pm-feature-grid" id="capabilities-grid">
          
          <div class="pm-feature-card" tabindex="0">
            <div class="pm-feature-watermark">01</div>
            <div class="pm-feature-header">
              <div class="pm-feature-title-group">
                <span class="material-symbols-outlined pm-feature-icon" style="color: #3b82f6;">data_object</span>
                <h3 class="pm-feature-title">${t('get.cap1Title')}</h3>
              </div>
              <div class="pm-feature-toggle"><span class="material-symbols-outlined">add</span></div>
            </div>
            <p class="pm-feature-desc">${t('get.cap1Desc')}</p>
            <div class="pm-feature-details">
              <div class="pm-feature-details-inner">
                <p>${t('get.cap1Detail')}</p>
                <div class="pm-ba-showcase">
                  <div class="pm-ba-side pm-ba-before">
                    <span class="pm-ba-label">${t('get.before')}</span>
                    <div class="pm-ba-content">${t('get.cap1Before')}</div>
                  </div>
                  <div class="pm-ba-divider"><span class="material-symbols-outlined">arrow_right_alt</span></div>
                  <div class="pm-ba-side pm-ba-after" style="--accent: #3b82f6;">
                    <span class="pm-ba-label">${t('get.after')}</span>
                    <div class="pm-ba-content">${t('get.cap1After')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="pm-feature-card" tabindex="0">
            <div class="pm-feature-watermark">02</div>
            <div class="pm-feature-header">
              <div class="pm-feature-title-group">
                <span class="material-symbols-outlined pm-feature-icon" style="color: #8b5cf6;">psychology</span>
                <h3 class="pm-feature-title">${t('get.cap2Title')}</h3>
              </div>
              <div class="pm-feature-toggle"><span class="material-symbols-outlined">add</span></div>
            </div>
            <p class="pm-feature-desc">${t('get.cap2Desc')}</p>
            <div class="pm-feature-details">
              <div class="pm-feature-details-inner">
                <p>${t('get.cap2Detail')}</p>
                <div class="pm-ba-showcase">
                  <div class="pm-ba-side pm-ba-before">
                    <span class="pm-ba-label">${t('get.before')}</span>
                    <div class="pm-ba-content">${t('get.cap2Before')}</div>
                  </div>
                  <div class="pm-ba-divider"><span class="material-symbols-outlined">arrow_right_alt</span></div>
                  <div class="pm-ba-side pm-ba-after" style="--accent: #8b5cf6;">
                    <span class="pm-ba-label">${t('get.after')}</span>
                    <div class="pm-ba-content">${t('get.cap2After')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="pm-feature-card" tabindex="0">
            <div class="pm-feature-watermark">03</div>
            <div class="pm-feature-header">
              <div class="pm-feature-title-group">
                <span class="material-symbols-outlined pm-feature-icon" style="color: #10b981;">tune</span>
                <h3 class="pm-feature-title">${t('get.cap3Title')}</h3>
              </div>
              <div class="pm-feature-toggle"><span class="material-symbols-outlined">add</span></div>
            </div>
            <p class="pm-feature-desc">${t('get.cap3Desc')}</p>
            <div class="pm-feature-details">
              <div class="pm-feature-details-inner">
                <p>${t('get.cap3Detail')}</p>
                <div class="pm-ba-showcase">
                  <div class="pm-ba-side pm-ba-before">
                    <span class="pm-ba-label">${t('get.before')}</span>
                    <div class="pm-ba-content">${t('get.cap3Before')}</div>
                  </div>
                  <div class="pm-ba-divider"><span class="material-symbols-outlined">arrow_right_alt</span></div>
                  <div class="pm-ba-side pm-ba-after" style="--accent: #10b981;">
                    <span class="pm-ba-label">${t('get.after')}</span>
                    <div class="pm-ba-content">${t('get.cap3After')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="pm-feature-card" tabindex="0">
            <div class="pm-feature-watermark">04</div>
            <div class="pm-feature-header">
              <div class="pm-feature-title-group">
                <span class="material-symbols-outlined pm-feature-icon" style="color: #f59e0b;">title</span>
                <h3 class="pm-feature-title">${t('get.cap4Title')}</h3>
              </div>
              <div class="pm-feature-toggle"><span class="material-symbols-outlined">add</span></div>
            </div>
            <p class="pm-feature-desc">${t('get.cap4Desc')}</p>
            <div class="pm-feature-details">
              <div class="pm-feature-details-inner">
                <p>${t('get.cap4Detail')}</p>
                <div class="pm-ba-showcase">
                  <div class="pm-ba-side pm-ba-before">
                    <span class="pm-ba-label">${t('get.before')}</span>
                    <div class="pm-ba-content">${t('get.cap4Before')}</div>
                  </div>
                  <div class="pm-ba-divider"><span class="material-symbols-outlined">arrow_right_alt</span></div>
                  <div class="pm-ba-side pm-ba-after" style="--accent: #f59e0b;">
                    <span class="pm-ba-label">${t('get.after')}</span>
                    <div class="pm-ba-content">${t('get.cap4After')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="pm-feature-card" tabindex="0">
            <div class="pm-feature-watermark">05</div>
            <div class="pm-feature-header">
              <div class="pm-feature-title-group">
                <span class="material-symbols-outlined pm-feature-icon" style="color: #ec4899;">table_rows_narrow</span>
                <h3 class="pm-feature-title">${t('get.cap5Title')}</h3>
              </div>
              <div class="pm-feature-toggle"><span class="material-symbols-outlined">add</span></div>
            </div>
            <p class="pm-feature-desc">${t('get.cap5Desc')}</p>
            <div class="pm-feature-details">
              <div class="pm-feature-details-inner">
                <p>${t('get.cap5Detail')}</p>
                <div class="pm-ba-showcase">
                  <div class="pm-ba-side pm-ba-before">
                    <span class="pm-ba-label">${t('get.before')}</span>
                    <div class="pm-ba-content">${t('get.cap5Before')}</div>
                  </div>
                  <div class="pm-ba-divider"><span class="material-symbols-outlined">arrow_right_alt</span></div>
                  <div class="pm-ba-side pm-ba-after" style="--accent: #ec4899;">
                    <span class="pm-ba-label">${t('get.after')}</span>
                    <div class="pm-ba-content">${t('get.cap5After')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="pm-feature-card" tabindex="0">
            <div class="pm-feature-watermark">06</div>
            <div class="pm-feature-header">
              <div class="pm-feature-title-group">
                <span class="material-symbols-outlined pm-feature-icon" style="color: #f97316;">auto_awesome</span>
                <h3 class="pm-feature-title">${t('get.cap6Title')}</h3>
              </div>
              <div class="pm-feature-toggle"><span class="material-symbols-outlined">add</span></div>
            </div>
            <p class="pm-feature-desc">${t('get.cap6Desc')}</p>
            <div class="pm-feature-details">
              <div class="pm-feature-details-inner">
                <p>${t('get.cap6Detail')}</p>
                <div class="pm-ba-showcase">
                  <div class="pm-ba-side pm-ba-before">
                    <span class="pm-ba-label">${t('get.before')}</span>
                    <div class="pm-ba-content">${t('get.cap6Before')}</div>
                  </div>
                  <div class="pm-ba-divider"><span class="material-symbols-outlined">arrow_right_alt</span></div>
                  <div class="pm-ba-side pm-ba-after" style="--accent: #f97316;">
                    <span class="pm-ba-label">${t('get.after')}</span>
                    <div class="pm-ba-content">${t('get.cap6After')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="pm-feature-card" tabindex="0">
            <div class="pm-feature-watermark">07</div>
            <div class="pm-feature-header">
              <div class="pm-feature-title-group">
                <span class="material-symbols-outlined pm-feature-icon" style="color: #14b8a6;">folder_managed</span>
                <h3 class="pm-feature-title">${t('get.cap7Title')}</h3>
              </div>
              <div class="pm-feature-toggle"><span class="material-symbols-outlined">add</span></div>
            </div>
            <p class="pm-feature-desc">${t('get.cap7Desc')}</p>
            <div class="pm-feature-details">
              <div class="pm-feature-details-inner">
                <p>${t('get.cap7Detail')}</p>
                <div class="pm-ba-showcase">
                  <div class="pm-ba-side pm-ba-before">
                    <span class="pm-ba-label">${t('get.before')}</span>
                    <div class="pm-ba-content">${t('get.cap7Before')}</div>
                  </div>
                  <div class="pm-ba-divider"><span class="material-symbols-outlined">arrow_right_alt</span></div>
                  <div class="pm-ba-side pm-ba-after" style="--accent: #14b8a6;">
                    <span class="pm-ba-label">${t('get.after')}</span>
                    <div class="pm-ba-content">${t('get.cap7After')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- Who uses ZumiLabs Studio Section (Bento Design) -->
      <section class="get-users-section bento-section">
        <h2 class="get-section-title">${t('get.usersTitle')}</h2>
        <div class="gu-bento-grid">
          
          <div class="gu-bento-card gu-span-5 gu-individuals" tabindex="0">
            <div class="gu-bento-inner">
               <div class="gu-bento-head">
                  <div class="gu-bento-icon teal-bg"><span class="material-symbols-outlined">person</span></div>
                  <h3>${t('get.userIndividuals')}</h3>
               </div>
               <p>${t('get.userIndividualsDesc')}</p>
            </div>
          </div>

          <div class="gu-bento-card gu-span-7 gu-photographers" tabindex="0">
            <div class="gu-bento-inner">
               <div class="gu-bento-head">
                  <div class="gu-bento-icon orange-bg"><span class="material-symbols-outlined">camera_alt</span></div>
                  <h3>${t('get.userPhotographers')}</h3>
               </div>
               <p>${t('get.userPhotographersDesc')}</p>
            </div>
          </div>

          <div class="gu-bento-card gu-span-7 gu-creators" tabindex="0">
            <div class="gu-bento-inner">
               <div class="gu-bento-head">
                  <div class="gu-bento-icon pink-bg"><span class="material-symbols-outlined">video_camera_front</span></div>
                  <h3>${t('get.userCreators')}</h3>
               </div>
               <p>${t('get.userCreatorsDesc')}</p>
            </div>
          </div>

          <div class="gu-bento-card gu-span-5 gu-enterprise" tabindex="0">
            <div class="gu-bento-inner">
               <div class="gu-bento-head">
                  <div class="gu-bento-icon blue-bg"><span class="material-symbols-outlined">business</span></div>
                  <h3>${t('get.userEnterprise')}</h3>
               </div>
               <p>${t('get.userEnterpriseDesc')}</p>
            </div>
          </div>

        </div>
      </section>

      <!-- Automation Callout -->
      <section class="get-automation-section">
        <div class="get-automation-card">
          <div class="get-automation-content">
            <h2 class="get-automation-title">${t('get.automationTitle')}</h2>
            <p class="get-automation-desc">
              ${t('get.automationDesc1')}
            </p>
            <p class="get-automation-desc" style="margin-top: 15px;">
              ${t('get.automationDesc2')}
            </p>
          </div>
          <div class="get-automation-icon">
             <span class="material-symbols-outlined" style="font-size: 80px; color: var(--ps-blue); opacity: 0.8;">account_tree</span>
          </div>
        </div>
      </section>
      
    </div>
  `;

  // ─── Inline Styles ─────────────────────────────────────────
  injectStyles();

  // ─── Event Bindings ──────────────────────────────────────
  container.querySelector('#btn-get-start')?.addEventListener('click', () => {
    navigate('#bld');
  });

  container.querySelector('#btn-get-library')?.addEventListener('click', () => {
    navigate('#lib');
  });

  // Accordion Logic for Feature Cards
  const cards = container.querySelectorAll('.pm-feature-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const isExpanded = card.classList.contains('is-expanded');
      // Collapse all
      cards.forEach(c => c.classList.remove('is-expanded'));
      // Expand the clicked one if it wasn't already
      if (!isExpanded) {
        card.classList.add('is-expanded');
        // Scroll slightly into view if needed
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      }
    });

    // Support keyboard navigation
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

function injectStyles() {
  if (document.getElementById('get-screen-styles')) return;

  const style = document.createElement('style');
  style.id = 'get-screen-styles';
  style.textContent = `
    .get-screen {
      flex: 1;
      overflow-y: auto;
      background: var(--ps-bg-app);
      padding-bottom: 60px;
    }

    /* Hero Section */
    .get-hero {
      padding: 80px 20px 60px;
      text-align: center;
      background: radial-gradient(circle at top center, rgba(0, 119, 255, 0.1) 0%, transparent 60%);
      border-bottom: 1px solid var(--ps-border-faint);
    }
    .get-hero__content {
      max-width: 800px;
      margin: 0 auto;
    }
    .get-hero__title {
      font-size: 3.5rem;
      line-height: 1.1;
      font-weight: 700;
      color: var(--ps-text);
      margin-bottom: 20px;
      letter-spacing: -0.02em;
    }
    .get-hero__subtitle {
      font-size: 1.1rem;
      color: var(--ps-text-muted);
      line-height: 1.6;
      margin-bottom: 40px;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
    .get-hero__actions {
      display: flex;
      gap: 16px;
      justify-content: center;
    }
    .btn-lg {
      padding: 12px 24px;
      font-size: 1rem;
      height: auto;
    }

    /* Video Section */
    .get-video-section {
      padding: 0 20px;
      margin-top: -30px;
    }
    .get-video-wrapper {
      max-width: 900px;
      margin: 0 auto;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--ps-border);
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      background: #000;
      aspect-ratio: 16 / 9;
    }
    .get-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Capabilities Section */
    .get-core-section {
      padding: 80px 20px 40px;
      max-width: 1100px;
      margin: 0 auto;
    }
    .get-section-title {
      font-size: 2rem;
      font-weight: 600;
      text-align: center;
      margin-bottom: 40px;
    }
    
    .pm-feature-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
      align-items: start;
    }
    @media (min-width: 768px) {
      .pm-feature-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .pm-feature-card {
      position: relative;
      background: var(--ps-bg-surface);
      border: 1px solid var(--ps-border-faint);
      border-radius: 16px;
      padding: 28px 24px;
      cursor: pointer;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;
    }
    .pm-feature-card:hover {
      border-color: var(--ps-border);
      box-shadow: 0 12px 24px rgba(0,0,0,0.08);
    }
    .pm-feature-card:focus-visible {
      border-color: var(--ps-blue);
      box-shadow: 0 0 0 2px rgba(0,119,255,0.3);
    }

    .pm-feature-card.is-expanded {
      grid-column: 1 / -1;
      background: var(--ps-bg-app);
      border-color: var(--ps-border);
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    }

    .pm-feature-watermark {
      position: absolute;
      top: -15px;
      right: -10px;
      font-size: 140px;
      font-weight: 900;
      color: var(--ps-text);
      opacity: 0.03;
      line-height: 1;
      pointer-events: none;
      transition: opacity 0.3s, transform 0.3s;
      user-select: none;
    }
    .pm-feature-card:hover .pm-feature-watermark {
      opacity: 0.06;
      transform: translate(-5px, 5px);
    }

    .pm-feature-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      position: relative;
      z-index: 1;
    }

    .pm-feature-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .pm-feature-icon {
      font-size: 28px;
    }

    .pm-feature-title {
      font-size: 1.3rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--ps-text);
      margin: 0;
    }

    .pm-feature-toggle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--ps-bg-raised);
      color: var(--ps-text-muted);
      transition: all 0.3s;
    }
    .pm-feature-card:hover .pm-feature-toggle {
      color: var(--ps-text);
      background: var(--ps-border-faint);
    }
    .pm-feature-toggle span {
      font-size: 20px;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .pm-feature-card.is-expanded .pm-feature-toggle span {
      transform: rotate(135deg);
    }

    .pm-feature-desc {
      font-size: 1rem;
      color: var(--ps-text-muted);
      line-height: 1.5;
      margin: 0;
      position: relative;
      z-index: 1;
    }

    .pm-feature-details {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .pm-feature-card.is-expanded .pm-feature-details {
      grid-template-rows: 1fr;
    }
    .pm-feature-details-inner {
      min-height: 0;
      overflow: hidden;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .pm-feature-card.is-expanded .pm-feature-details-inner {
      opacity: 1;
      transition: opacity 0.4s 0.2s;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px dashed var(--ps-border-faint);
    }
    .pm-feature-details-inner > p {
      font-size: 1.05rem;
      color: var(--ps-text);
      line-height: 1.6;
      margin-bottom: 30px;
      max-width: 800px;
    }

    .pm-ba-showcase {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: var(--ps-bg-raised);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--ps-border-faint);
    }
    @media (max-width: 600px) {
      .pm-ba-showcase {
        flex-direction: column;
      }
      .pm-ba-divider span {
        transform: rotate(90deg);
      }
    }

    .pm-ba-side {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    .pm-ba-label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ps-text-muted);
      text-align: center;
    }
    .pm-ba-content {
      background: var(--ps-bg-surface);
      border: 1px solid var(--ps-border);
      border-radius: 8px;
      padding: 24px 16px;
      text-align: center;
      font-family: var(--font-mono);
      font-size: 0.95rem;
      color: var(--ps-text-muted);
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
    }

    .pm-ba-after .pm-ba-content {
      border-color: var(--accent);
      color: var(--accent);
      background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    .pm-ba-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ps-text-faint);
    }
    .pm-ba-divider span {
      font-size: 32px;
    }

    /* Users Bento Section */
    .bento-section {
      padding: 60px 20px 80px;
      max-width: 1100px;
      margin: 0 auto;
    }

    .gu-bento-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }

    @media (min-width: 800px) {
      .gu-bento-grid {
        grid-template-columns: repeat(12, 1fr);
      }
      .gu-span-5 { grid-column: span 5; }
      .gu-span-7 { grid-column: span 7; }
    }

    .gu-bento-card {
      position: relative;
      background: var(--ps-bg-surface);
      border-radius: 20px;
      border: 1px solid var(--ps-border-faint);
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      outline: none;
    }

    .gu-bento-card:hover, .gu-bento-card:focus-visible {
      transform: translateY(-5px) scale(1.01);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      border-color: var(--ps-border-hover);
    }
    
    .gu-bento-card:focus-visible {
      border-color: var(--ps-blue);
    }

    .gu-bento-inner {
      padding: 32px;
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 1;
    }

    .gu-bento-head {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .gu-bento-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 2px 4px rgba(255,255,255,0.1);
    }
    .gu-bento-icon span {
      font-size: 24px;
      color: white;
    }

    .teal-bg { background: linear-gradient(135deg, #14b8a6, #0d9488); }
    .orange-bg { background: linear-gradient(135deg, #f97316, #ea580c); }
    .pink-bg { background: linear-gradient(135deg, #ec4899, #db2777); }
    .blue-bg { background: linear-gradient(135deg, #3b82f6, #2563eb); }

    .gu-bento-card h3 {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--ps-text);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .gu-bento-card p {
      font-size: 1.05rem;
      color: var(--ps-text-muted);
      line-height: 1.6;
      margin: 0;
      flex-grow: 1;
    }

    /* Subtle large background glows for premium feel */
    .gu-bento-card::after {
      content: "";
      position: absolute;
      top: -20px;
      right: -20px;
      width: 150px;
      height: 150px;
      border-radius: 50%;
      filter: blur(50px);
      opacity: 0.08;
      transition: opacity 0.4s ease;
      z-index: 0;
      pointer-events: none;
    }
    .gu-bento-card:hover::after, .gu-bento-card:focus-visible::after {
      opacity: 0.15;
    }
    .gu-individuals::after { background: #14b8a6; }
    .gu-photographers::after { background: #f97316; }
    .gu-creators::after { background: #ec4899; }
    .gu-enterprise::after { background: #3b82f6; }

    /* Automation Callout */
    .get-automation-section {
      padding: 40px 20px 80px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .get-automation-card {
      background: linear-gradient(135deg, rgba(10, 22, 40, 0.8) 0%, rgba(13, 16, 26, 0.9) 100%);
      border: 1px solid var(--ps-blue);
      border-radius: 16px;
      padding: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 40px;
      box-shadow: 0 10px 30px rgba(0, 119, 255, 0.1);
    }
    .get-automation-content {
      flex: 1;
    }
    .get-automation-title {
      font-size: 1.8rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 16px;
    }
    .get-automation-desc {
      font-size: 1.05rem;
      color: var(--ps-text-muted);
      line-height: 1.6;
      margin: 0;
    }
    .get-automation-icon {
      flex-shrink: 0;
      display: none;
    }

    /* Colors */
    .text-blue   { color: #3b82f6; }
    .text-purple { color: #8b5cf6; }
    .text-green  { color: #10b981; }
    .text-yellow { color: #f59e0b; }
    .text-pink   { color: #ec4899; }
    .text-orange { color: #f97316; }
    .text-teal   { color: #14b8a6; }

    /* Responsive */
    @media (min-width: 768px) {
      .get-automation-icon {
        display: block;
      }
    }
  `;
  document.head.appendChild(style);
}
