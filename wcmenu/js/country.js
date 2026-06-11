const ALL_COUNTRIES = [
  ...COUNTRIES_UEFA,
  ...COUNTRIES_AMERICAS,
  ...COUNTRIES_AFRICA_ASIA
];

const confLabels = {
  UEFA: '🌍 Europe',
  CONMEBOL: '🌎 South America',
  CONCACAF: '🌎 CONCACAF',
  CAF: '🌍 Africa',
  AFC: '🌏 Asia',
  OFC: '🌏 Oceania'
};

const courseEmoji = { starter: '🥗', main: '🍽️', dessert: '🍮' };

async function fetchWikiImage(countryId, courseType) {
  const title = WIKIPEDIA_TITLES[`${countryId}_${courseType}`];
  if (!title) return null;
  try {
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const src = data.thumbnail?.source;
    if (!src) return null;
    // Request a wider image from Wikimedia
    return src.replace(/\/\d+px-/, '/480px-');
  } catch {
    return null;
  }
}

function buildCoursePanel(course, panelEl, countryId, courseType) {
  const imgWrapperId = `imgWrap_${panelEl.id}`;
  const imgId = `img_${panelEl.id}`;

  panelEl.innerHTML = `
    <div class="recipe-card">

      <div class="recipe-image-wrap" id="${imgWrapperId}">
        <div class="recipe-img-placeholder">
          <span class="placeholder-emoji">${courseEmoji[courseType] || '🍴'}</span>
          <span class="placeholder-txt">Loading image…</span>
        </div>
        <img id="${imgId}" class="recipe-img hidden" alt="${course.name}" />
      </div>

      <div class="recipe-header">
        <h3>${course.name}</h3>
        <p>${course.description}</p>
        <div class="recipe-meta">
          <span>👤 Serves ${course.servings}</span>
          <span>⏱️ Prep: ${course.prepTime}</span>
          <span>🔥 Cook: ${course.cookTime}</span>
        </div>
      </div>

      <div class="recipe-body">
        <div class="ingredients-section">
          <h4>Ingredients</h4>
          <ul class="ingredients-list">
            ${course.ingredients.map(ing => `
              <li>
                <span class="ing-amount">${ing.amount}</span>
                <span class="ing-item">${ing.item}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <div class="instructions-section">
          <h4>Method</h4>
          <ol class="instructions-list">
            ${course.instructions.map(step => `<li>${step}</li>`).join('')}
          </ol>
        </div>
      </div>

      <div class="youtube-section">
        <a class="yt-preview-card"
           href="${course.youtube.url}"
           target="_blank"
           rel="noopener noreferrer"
           aria-label="Watch ${course.name} recipe on YouTube">
          <div class="yt-play-ring">
            <svg class="yt-play-svg" viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg">
              <path class="yt-bg" d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.8.5 34 .5 34 .5S12.2.5 7.5 1.7a8.5 8.5 0 0 0-6 6C.3 11.4 0 18 0 24s.3 12.6 1.5 16.3a8.5 8.5 0 0 0 6 6C12.2 47.5 34 47.5 34 47.5s21.8 0 26.5-1.2a8.5 8.5 0 0 0 6-6C67.7 36.6 68 30 68 24s-.3-12.6-1.5-16.3z"/>
              <path class="yt-triangle" d="M45 24 27 14v20z"/>
            </svg>
          </div>
          <div class="yt-preview-text">
            <span class="yt-preview-title">${course.name}</span>
            <span class="yt-preview-cta">Watch recipe video on YouTube →</span>
          </div>
        </a>
      </div>

    </div>
  `;

  // Async: fetch Wikipedia thumbnail and swap in once loaded
  fetchWikiImage(countryId, courseType).then(url => {
    if (!url) return;
    const img = document.getElementById(imgId);
    const wrap = document.getElementById(imgWrapperId);
    if (!img || !wrap) return;
    img.onload = () => {
      img.classList.remove('hidden');
      const placeholder = wrap.querySelector('.recipe-img-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
    };
    img.onerror = () => { /* keep placeholder */ };
    img.src = url;
  });
}

const panelIds = {
  starter: 'coursePanelStarter',
  main:    'coursePanelMain',
  dessert: 'coursePanelDessert'
};

function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const country = ALL_COUNTRIES.find(c => c.id === id);

  if (!country) {
    document.getElementById('countryMain').innerHTML = `
      <div style="text-align:center;padding:4rem;color:var(--text-muted)">
        <p style="font-size:3rem;margin-bottom:1rem">🤔</p>
        <p style="margin-bottom:1rem">Country not found.</p>
        <a href="index.html">← Back to all countries</a>
      </div>`;
    return;
  }

  document.title = `${country.name} Menu — World Cup 2026`;
  document.getElementById('countryFlag').textContent = country.flag;
  document.getElementById('countryName').textContent = country.name;
  document.getElementById('confBadge').textContent = confLabels[country.confederation] || country.confederation;
  document.getElementById('menuIntro').textContent = country.intro;

  buildCoursePanel(country.menu.starter, document.getElementById('coursePanelStarter'), country.id, 'starter');
  buildCoursePanel(country.menu.main,    document.getElementById('coursePanelMain'),    country.id, 'main');
  buildCoursePanel(country.menu.dessert, document.getElementById('coursePanelDessert'), country.id, 'dessert');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.course-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const pid = panelIds[btn.dataset.course];
      if (pid) document.getElementById(pid).classList.remove('hidden');
    });
  });
}

init();
