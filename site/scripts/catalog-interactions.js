'use strict';

(() => {
  const cards = [...document.querySelectorAll('[data-plugin-card]')];
  const grid = document.querySelector('#pluginGrid');
  const searchInput = document.querySelector('#searchInput');
  const ltsOnly = document.querySelector('#ltsOnly');
  const sortSelect = document.querySelector('#sortSelect');
  const resetButtons = [document.querySelector('#resetFilters'), document.querySelector('#emptyReset')].filter(Boolean);
  const emptyState = document.querySelector('#emptyState');
  const count = document.querySelector('#catalogCount');
  if (!grid || !cards.length || !searchInput || !ltsOnly || !sortSelect) return;

  const language = document.documentElement.lang === 'ru' ? 'ru' : 'en';
  const state = { category: '__all', search: '', ltsOnly: false, sort: 'featured' };

  function pluginCountLabel(value) {
    if (language === 'en') return `${value} ${value === 1 ? 'plugin' : 'plugins'}`;
    const mod10 = value % 10;
    const mod100 = value % 100;
    const word = mod10 === 1 && mod100 !== 11 ? 'плагин' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'плагина' : 'плагинов';
    return `${value} ${word}`;
  }

  function visibleCards() {
    const query = state.search.trim().toLocaleLowerCase(language);
    return cards.filter(card => {
      const categoryMatches = state.category === '__all' || card.dataset.category === state.category;
      const searchMatches = !query || card.dataset.search.includes(query);
      const ltsMatches = !state.ltsOnly || /2022\.3|2023|6000|6\./i.test(card.dataset.unity);
      return categoryMatches && searchMatches && ltsMatches;
    });
  }

  function compare(left, right) {
    if (state.sort === 'name') return left.dataset.name.localeCompare(right.dataset.name, language);
    if (state.sort === 'newest') return right.dataset.updated.localeCompare(left.dataset.updated);
    if (state.sort === 'popular') return Number(right.dataset.downloads) - Number(left.dataset.downloads) || left.dataset.name.localeCompare(right.dataset.name, language);
    return Number(right.dataset.featured) - Number(left.dataset.featured) || right.dataset.updated.localeCompare(left.dataset.updated);
  }

  function render() {
    const visible = visibleCards().sort(compare);
    const visibleSet = new Set(visible);
    cards.forEach(card => { card.hidden = !visibleSet.has(card); });
    visible.forEach(card => grid.append(card));
    document.querySelectorAll('[data-category]').forEach(button => button.classList.toggle('active', button.dataset.category === state.category));
    const filtered = Boolean(state.search || state.category !== '__all' || state.ltsOnly);
    count.textContent = `${pluginCountLabel(visible.length)} — ${filtered ? (language === 'ru' ? 'по выбранным фильтрам' : 'with selected filters') : (language === 'ru' ? 'все бесплатные' : 'all free')}`;
    emptyState.hidden = visible.length !== 0;
    const primaryReset = document.querySelector('#resetFilters');
    if (primaryReset) primaryReset.hidden = !filtered;
  }

  function reset() {
    state.category = '__all'; state.search = ''; state.ltsOnly = false;
    searchInput.value = ''; ltsOnly.checked = false; render();
  }

  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { state.category = button.dataset.category; render(); }));
  searchInput.addEventListener('input', event => { state.search = event.target.value; render(); });
  ltsOnly.addEventListener('change', event => { state.ltsOnly = event.target.checked; render(); });
  sortSelect.addEventListener('change', event => { state.sort = event.target.value; render(); });
  resetButtons.forEach(button => button.addEventListener('click', reset));
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.focus(); }
  });
})();
