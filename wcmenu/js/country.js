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

const panelIds = {
  starter: 'coursePanelStarter',
  main: 'coursePanelMain',
  dessert: 'coursePanelDessert'
};

function buildCoursePanel(course, panelEl) {
  const embedContainerId = `embed-${panelEl.id}`;

  panelEl.innerHTML = `
    <div class="recipe-card">
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
        <span class="youtube-label">Watch recipe video:</span>
        <a class="yt-btn" href="${course.youtube.url}" target="_blank" rel="noopener noreferrer">
          <span class="yt-icon">▶</span>
          Search on YouTube
        </a>
        <button class="yt-embed-toggle" data-embed="${embedContainerId}" data-search="${course.youtube.search.replace(/"/g, '&quot;')}">
          Show embedded player
        </button>
        <div class="yt-embed-container hidden" id="${embedContainerId}"></div>
      </div>
    </div>
  `;

  // Attach embed toggle after building HTML
  const toggleBtn = panelEl.querySelector('.yt-embed-toggle');
  toggleBtn.addEventListener('click', () => {
    const containerId = toggleBtn.dataset.embed;
    const search = toggleBtn.dataset.search;
    const container = document.getElementById(containerId);

    if (container.classList.contains('hidden')) {
      if (!container.querySelector('iframe')) {
        container.innerHTML = `
          <iframe
            class="yt-embed-frame"
            src="https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(search)}&rel=0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            loading="lazy"
          ></iframe>
        `;
      }
      container.classList.remove('hidden');
      toggleBtn.textContent = 'Hide player';
    } else {
      container.classList.add('hidden');
      toggleBtn.textContent = 'Show embedded player';
    }
  });
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const country = ALL_COUNTRIES.find(c => c.id === id);

  if (!country) {
    document.getElementById('countryMain').innerHTML = `
      <div style="text-align:center;padding:4rem;color:var(--text-muted)">
        <p style="font-size:3rem;margin-bottom:1rem">🤔</p>
        <p style="margin-bottom:1rem">Country not found.</p>
        <a href="index.html" style="color:var(--gold)">← Back to all countries</a>
      </div>`;
    return;
  }

  document.title = `${country.name} Menu — World Cup 2026`;
  document.getElementById('countryFlag').textContent = country.flag;
  document.getElementById('countryName').textContent = country.name;
  document.getElementById('confBadge').textContent = confLabels[country.confederation] || country.confederation;
  document.getElementById('menuIntro').textContent = country.intro;

  buildCoursePanel(country.menu.starter, document.getElementById('coursePanelStarter'));
  buildCoursePanel(country.menu.main, document.getElementById('coursePanelMain'));
  buildCoursePanel(country.menu.dessert, document.getElementById('coursePanelDessert'));

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.course-panel').forEach(p => p.classList.add('hidden'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const panelId = panelIds[btn.dataset.course];
      if (panelId) document.getElementById(panelId).classList.remove('hidden');
    });
  });
}

init();
