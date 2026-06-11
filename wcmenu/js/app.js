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

function renderGrid(countries) {
  const grid = document.getElementById('countriesGrid');
  const count = document.getElementById('countDisplay');
  count.textContent = `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`;

  if (!countries.length) {
    grid.innerHTML = '<div class="no-results">No countries found. Try a different search.</div>';
    return;
  }

  grid.innerHTML = countries.map(c => `
    <a class="country-card" href="country.html?id=${c.id}" title="${c.name}">
      <div class="card-flag">${c.flag}</div>
      <div class="card-name">${c.name}</div>
      <div class="card-conf">${confLabels[c.confederation] || c.confederation}</div>
      <div class="card-dishes">
        <span>🥗 ${c.menu.starter.name.split('(')[0].trim()}</span>
        <span>🍽️ ${c.menu.main.name.split('(')[0].split('with')[0].trim()}</span>
        <span>🍮 ${c.menu.dessert.name.split('(')[0].trim()}</span>
      </div>
    </a>
  `).join('');
}

function applyFilters() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;

  let result = ALL_COUNTRIES;

  if (activeFilter !== 'all') {
    result = result.filter(c => c.confederation === activeFilter);
  }

  if (query) {
    result = result.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.menu.starter.name.toLowerCase().includes(query) ||
      c.menu.main.name.toLowerCase().includes(query) ||
      c.menu.dessert.name.toLowerCase().includes(query)
    );
  }

  renderGrid(result);
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  });
});

// Search input
document.getElementById('searchInput').addEventListener('input', applyFilters);

// Initial render
renderGrid(ALL_COUNTRIES);
