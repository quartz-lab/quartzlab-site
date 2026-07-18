'use strict';

const Q = window.QuartzLab;
const lang = Q.languageFromPath();
const ui = lang === 'ru' ? {
  all:'Все', loading:'Загрузка каталога…', failed:'Не удалось загрузить каталог', unavailable:'Каталог временно недоступен. Попробуйте обновить страницу немного позже.', search:'Поиск плагинов', sort:'Сортировка', featured:'Рекомендуемые', popular:'Популярные', newest:'Сначала новые', name:'По названию', category:'Категория', compatibility:'Совместимость', reset:'Сбросить фильтры', empty:'Ничего не найдено', emptyHint:'Попробуй другую категорию или запрос.', pluginForms:['плагин','плагина','плагинов'], free:'Бесплатно', filtered:'по выбранным фильтрам', allFree:'все бесплатные', downloads:'скачиваний'
} : {
  all:'All', loading:'Loading catalog…', failed:'Could not load the catalog', unavailable:'The catalog is temporarily unavailable. Please try refreshing the page later.', search:'Search plugins', sort:'Sort', featured:'Featured', popular:'Popular', newest:'Newest', name:'Name', category:'Category', compatibility:'Compatibility', reset:'Reset filters', empty:'Nothing found', emptyHint:'Try another category or search query.', pluginForms:['plugin','plugins','plugins'], free:'Free', filtered:'with selected filters', allFree:'all free', downloads:'downloads'
};

const state = {plugins:[], downloads:{}, category:'__all', search:'', ltsOnly:false, sort:'featured'};
const $ = selector => document.querySelector(selector);

function populateStaticText() {
  document.documentElement.lang = lang;
  $('[data-catalog-title]').textContent = lang === 'ru' ? 'Все плагины' : 'All plugins';
  $('#catalogCount').textContent = ui.loading;
  $('#searchInput').placeholder = ui.search;
  $('[data-filter-category]').textContent = ui.category;
  $('[data-filter-compatibility]').textContent = ui.compatibility;
  $('#resetFilters').textContent = ui.reset;
  $('[data-sort-label]').textContent = ui.sort;
  $('#sortSelect').innerHTML = `<option value="featured">${ui.featured}</option><option value="popular">${ui.popular}</option><option value="newest">${ui.newest}</option><option value="name">${ui.name}</option>`;
  $('#emptyState strong').textContent = ui.empty;
  $('#emptyState span').textContent = ui.emptyHint;
  $('#emptyReset').textContent = ui.reset;
  Q.bindLanguageSwitchers(lang);
}

function categories() {
  const counts = new Map();
  state.plugins.forEach(plugin => counts.set(plugin.categoryLabel, (counts.get(plugin.categoryLabel) || 0) + 1));
  return [['__all', ui.all, state.plugins.length], ...[...counts.entries()].sort((a,b) => a[0].localeCompare(b[0],lang)).map(([label,count]) => [label,label,count])];
}

function visiblePlugins() {
  const query = state.search.trim().toLocaleLowerCase(lang);
  return state.plugins.filter(plugin => {
    const text = [plugin.name,plugin.subtitle,plugin.description,plugin.categoryLabel,...(plugin.tags||[])].join(' ').toLocaleLowerCase(lang);
    return (state.category === '__all' || plugin.categoryLabel === state.category) && (!query || text.includes(query)) && (!state.ltsOnly || /2022\.3|2023|6000|6\./i.test(plugin.unityVersion));
  }).sort((a,b) => {
    if (state.sort === 'name') return a.name.localeCompare(b.name,lang);
    if (state.sort === 'newest') return String(b.updatedAt).localeCompare(String(a.updatedAt));
    if (state.sort === 'popular') return (state.downloads[b.slug]||0) - (state.downloads[a.slug]||0) || a.name.localeCompare(b.name,lang);
    return Number(b.featured)-Number(a.featured) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
}

function setCategory(value) { state.category = value; render(); }

function renderFilters() {
  const controls = categories();
  $('#categoryFilters').innerHTML = controls.map(([value,label,count]) => `<button class="filter-button ${state.category===value?'active':''}" data-category="${Q.escape(value)}"><span>${Q.escape(label)}</span><b>${count}</b></button>`).join('');
  $('#mobileFilters').innerHTML = controls.map(([value,label]) => `<button class="${state.category===value?'active':''}" data-category="${Q.escape(value)}">${Q.escape(label)}</button>`).join('');
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click',()=>setCategory(button.dataset.category)));
}

function countLabel(count) {
  if (lang === 'en') return `${count} ${count === 1 ? ui.pluginForms[0] : ui.pluginForms[1]}`;
  const mod10=count%10,mod100=count%100,index=mod10===1&&mod100!==11?0:mod10>=2&&mod10<=4&&(mod100<12||mod100>14)?1:2;
  return `${count} ${ui.pluginForms[index]}`;
}

function renderCards() {
  const plugins=visiblePlugins(), grid=$('#pluginGrid'), template=$('#productTemplate');
  grid.innerHTML='';
  plugins.forEach(plugin => {
    const card=template.content.firstElementChild.cloneNode(true), href=Q.pluginUrl(lang,plugin.slug), count=state.downloads[plugin.slug]||0;
    card.querySelectorAll('a').forEach(link=>link.href=href);
    const image=card.querySelector('img'); image.src=plugin.cover||'/assets/covers/placeholder.svg'; image.alt=`${plugin.name} — ${lang==='ru'?'обложка плагина':'plugin cover'}`;
    card.querySelector('.product-title').textContent=plugin.name;
    card.querySelector('.product-description').textContent=plugin.subtitle;
    card.querySelector('.product-category').textContent=plugin.categoryLabel;
    card.querySelector('.product-version').textContent=`v${plugin.version}`;
    card.querySelector('.product-downloads').textContent=`↓ ${Q.formatNumber(count,lang)}`;
    card.querySelector('.free-badge').textContent=ui.free.toUpperCase();
    grid.appendChild(card);
  });
  $('#emptyState').hidden=plugins.length>0;
  $('#catalogCount').textContent=`${countLabel(plugins.length)} — ${(state.search||state.category!=='__all'||state.ltsOnly)?ui.filtered:ui.allFree}`;
  $('#resetFilters').hidden=!state.search&&state.category==='__all'&&!state.ltsOnly;
}

function render(){renderFilters();renderCards();}
function reset(){state.category='__all';state.search='';state.ltsOnly=false;$('#searchInput').value='';$('#ltsOnly').checked=false;render();}

populateStaticText();
$('#searchInput').addEventListener('input',event=>{state.search=event.target.value;renderCards();});
$('#ltsOnly').addEventListener('change',event=>{state.ltsOnly=event.target.checked;renderCards();});
$('#sortSelect').addEventListener('change',event=>{state.sort=event.target.value;renderCards();});
$('#resetFilters').addEventListener('click',reset); $('#emptyReset').addEventListener('click',reset);
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#searchInput').focus();}});

Q.loadData().then(({plugins,downloads})=>{state.plugins=plugins.map(plugin=>Q.localize(plugin,lang));state.downloads=downloads;render();}).catch(error=>{console.error('Catalog data loading failed.',error);$('#catalogCount').textContent=ui.failed;$('#pluginGrid').innerHTML=`<div class="empty-state"><strong>${ui.failed}</strong><span>${ui.unavailable}</span></div>`;});
