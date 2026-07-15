'use strict';

const Q = window.QuartzLab;
const params = new URLSearchParams(location.search);

const lang =
  params.get('lang') ||
  Q.languageFromPath();

const slug =
  params.get('slug') ||
  Q.slugFromPath('plugins');

const t = Q.strings[lang];
const root = document.querySelector('#pluginPage');

function mediaMarkup(plugin) {
  const media = plugin.media?.length ? plugin.media : [{type:'image',src:plugin.cover||'/assets/covers/placeholder.svg',alt:{en:plugin.name,ru:plugin.name}}];
  const first=media[0];
  const renderMain=item=>{
    if(item.type==='youtube'){const id=Q.youtubeId(item.url);return id?`<iframe src="https://www.youtube-nocookie.com/embed/${Q.escape(id)}" title="${Q.escape(item.title?.[lang]||plugin.name)}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe>`:'';}
    if(item.type==='video')return `<video controls preload="metadata" poster="${Q.escape(item.poster||plugin.cover||'')}"><source src="${Q.escape(item.src)}"></video>`;
    return `<img src="${Q.escape(item.src)}" alt="${Q.escape(item.alt?.[lang]||plugin.name)}">`;
  };
  const thumbs=media.map((item,index)=>{const id=item.type==='youtube'?Q.youtubeId(item.url):'';const preview=item.type==='youtube'&&id?`https://i.ytimg.com/vi/${id}/mqdefault.jpg`:(item.poster||item.src||plugin.cover);return `<button class="media-thumb ${index===0?'active':''}" data-media="${index}" aria-label="${item.type==='image'?t.mediaImage:t.mediaVideo} ${index+1}"><img src="${Q.escape(preview)}" alt=""><span>${item.type==='image'?'▧':'▶'}</span></button>`;}).join('');
  return `<div id="heroMedia" class="hero-media">${renderMain(first)}</div><div class="media-thumbs">${thumbs}</div><script type="application/json" id="mediaData">${JSON.stringify(media).replace(/</g,'\\u003c')}</script>`;
}

function button(url,label,className='secondary-button') { return url ? `<a class="${className}" href="${Q.escape(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>` : ''; }

function render(plugin,downloads) {
  document.documentElement.lang=lang; document.title=`${plugin.name} — QuartzLab`; document.querySelector('meta[name="description"]').content=plugin.subtitle;
  const navLink=document.querySelector('.main-nav a'); if(navLink){navLink.textContent=t.plugins;navLink.href=`/${lang}/#plugins`;}
  document.querySelector('.brand').href=`/${lang}/`;
  document.querySelector('.compact-footer a').textContent=t.supportProject; document.querySelector('.compact-footer a').href=`/${lang}/#support`;
  Q.bindLanguageSwitchers(lang,plugin.slug,'plugins');
  const features=plugin.features.map(item=>`<li>${Q.escape(item)}</li>`).join('');
  const actions=[button(plugin.releaseUrl,t.releases,'download-button'),button(Q.docsUrl(lang,plugin.slug),t.documentation),button(plugin.repositoryUrl,t.source),button(plugin.assetStoreUrl,t.assetStore)].join('');
  root.innerHTML=`
    <nav class="breadcrumbs"><a href="/${lang}/">QuartzLab</a><span>/</span><a href="/${lang}/#plugins">${t.plugins}</a><span>/</span><span>${Q.escape(plugin.name)}</span></nav>
    <section class="plugin-hero">
      <div class="plugin-gallery">${mediaMarkup(plugin)}</div>
      <aside class="plugin-summary"><span class="detail-category">${Q.escape(plugin.categoryLabel)}</span><h1>${Q.escape(plugin.name)}</h1><p class="plugin-lead">${Q.escape(plugin.subtitle)}</p>
        <div class="detail-meta"><div class="meta-row"><span>${t.version}</span><strong>${Q.escape(plugin.version)}</strong></div><div class="meta-row"><span>${t.unity}</span><strong>${Q.escape(plugin.unityVersion)}</strong></div><div class="meta-row"><span>${t.license}</span><strong>${Q.escape(plugin.license||'MIT')}</strong></div><div class="meta-row"><span>GitHub</span><strong>↓ ${Q.formatNumber(downloads[plugin.slug]||0,lang)}</strong></div></div>
        <div class="plugin-actions">${actions}</div>
      </aside>
    </section>
    <section class="plugin-content"><div class="content-main"><section><h2>${t.aboutPlugin}</h2><p>${Q.escape(plugin.description)}</p></section><section><h2>${t.features}</h2><ul class="feature-list">${features}</ul></section><section><h2>${t.installation}</h2><p>${Q.escape(t.installText)}</p></section><section class="docs-callout"><h2>${t.documentation}</h2><p>${lang==='ru'?'Полное руководство, примеры и материалы доступны на отдельной странице документации.':'The full guide, examples and media are available on the dedicated documentation page.'}</p><a href="${Q.docsUrl(lang,plugin.slug)}">${t.documentation} →</a></section></div><aside class="detail-side"><div class="detail-side-note"><h3>${t.freeNote}</h3><p>${t.freeNoteText}</p><a href="/${lang}/#support">${t.supportProject} →</a></div></aside></section>`;
  const media=JSON.parse(document.querySelector('#mediaData').textContent);
  document.querySelectorAll('[data-media]').forEach(buttonEl=>buttonEl.addEventListener('click',()=>{const item=media[Number(buttonEl.dataset.media)];let html='';if(item.type==='youtube'){const id=Q.youtubeId(item.url);html=`<iframe src="https://www.youtube-nocookie.com/embed/${Q.escape(id)}?autoplay=1" title="${Q.escape(item.title?.[lang]||plugin.name)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;}else if(item.type==='video'){html=`<video controls autoplay preload="metadata" poster="${Q.escape(item.poster||plugin.cover||'')}"><source src="${Q.escape(item.src)}"></video>`;}else{html=`<img src="${Q.escape(item.src)}" alt="${Q.escape(item.alt?.[lang]||plugin.name)}">`;}document.querySelector('#heroMedia').innerHTML=html;document.querySelectorAll('[data-media]').forEach(node=>node.classList.toggle('active',node===buttonEl));}));
}

function notFound(){document.title=`${t.notFound} — QuartzLab`;Q.bindLanguageSwitchers(lang);root.innerHTML=`<div class="not-found"><h1>${t.notFound}</h1><span>${t.notFoundText}</span><a href="/${lang}/#plugins">${t.backCatalog}</a></div>`;}
Q.loadData().then(({plugins,downloads})=>{const item=plugins.find(plugin=>plugin.slug===slug);item?render(Q.localize(item,lang),downloads):notFound();}).catch(notFound);
