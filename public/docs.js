'use strict';

const Q=window.QuartzLab,lang=Q.languageFromPath(),slug=Q.slugFromPath('docs'),t=Q.strings[lang],root=document.querySelector('#docsPage');

function mediaBlock(block,plugin){
  if(!block.media?.length)return '';
  return `<div class="docs-media">${block.media.map(item=>item.type==='video'?`<video controls preload="metadata" poster="${Q.escape(item.poster||'')}"><source src="${Q.escape(item.src)}"></video>`:`<img src="${Q.escape(item.src)}" alt="${Q.escape(item.alt?.[lang]||plugin.name)}" loading="lazy">`).join('')}</div>`;
}

function render(plugin){
  document.documentElement.lang=lang;document.title=`${plugin.name} — ${t.documentation} — QuartzLab`;Q.bindLanguageSwitchers(lang,plugin.slug,'docs');document.querySelector('.brand').href=`/${lang}/`;const navLink=document.querySelector('.main-nav a');if(navLink){navLink.textContent=t.plugins;navLink.href=`/${lang}/#plugins`;}
  const sections=(plugin.docs||[]).map(block=>`<section><h2>${Q.escape(block.title)}</h2>${(block.paragraphs||[]).map(p=>`<p>${Q.escape(p)}</p>`).join('')}${mediaBlock(block,plugin)}</section>`).join('');
  root.innerHTML=`<nav class="breadcrumbs"><a href="/${lang}/">QuartzLab</a><span>/</span><a href="${Q.pluginUrl(lang,plugin.slug)}">${Q.escape(plugin.name)}</a><span>/</span><span>${t.documentation}</span></nav><header class="docs-header"><span class="eyebrow">${t.documentation}</span><h1>${Q.escape(plugin.name)}</h1><p>${Q.escape(plugin.subtitle)}</p></header><div class="docs-layout"><aside class="docs-nav"><strong>${lang==='ru'?'На этой странице':'On this page'}</strong>${(plugin.docs||[]).map((block,index)=>`<a href="#section-${index}">${Q.escape(block.title)}</a>`).join('')}<a href="#installation">${t.installation}</a></aside><article class="docs-article">${(plugin.docs||[]).map((block,index)=>`<section id="section-${index}"><h2>${Q.escape(block.title)}</h2>${(block.paragraphs||[]).map(p=>`<p>${Q.escape(p)}</p>`).join('')}${mediaBlock(block,plugin)}</section>`).join('')}<section id="installation"><h2>${t.installation}</h2><p>${Q.escape(t.installText)}</p></section></article></div>`;
}
function notFound(){document.title=`${t.notFound} — QuartzLab`;Q.bindLanguageSwitchers(lang);root.innerHTML=`<div class="not-found"><h1>${t.notFound}</h1><a href="/${lang}/">${t.backCatalog}</a></div>`;}
Q.loadData().then(({plugins})=>{const item=plugins.find(plugin=>plugin.slug===slug);item?render(Q.localize(item,lang)):notFound();}).catch(notFound);
