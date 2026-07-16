'use strict';

(() => {
  const hero = document.querySelector('#heroMedia');
  const buttons = [...document.querySelectorAll('[data-media-index]')];
  if (!hero || buttons.length < 2) return;

  const escapeAttribute = value => String(value || '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));

  function youtubeId(url) {
    const match = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
    return match ? match[1] : '';
  }

  function activate(button) {
    const type = button.dataset.mediaType;
    const source = button.dataset.mediaSrc;
    const title = escapeAttribute(button.dataset.mediaTitle);
    const poster = escapeAttribute(button.dataset.mediaPoster);

    if (type === 'youtube') {
      const id = youtubeId(source);
      if (!id) return;
      hero.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${escapeAttribute(id)}?autoplay=1" title="${title}" allow="autoplay; accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else if (type === 'video') {
      hero.innerHTML = `<video controls autoplay preload="metadata" poster="${poster}"><source src="${escapeAttribute(source)}"></video>`;
    } else {
      hero.innerHTML = `<img src="${escapeAttribute(source)}" alt="${title}">`;
    }

    buttons.forEach(item => item.classList.toggle('active', item === button));
  }

  buttons.forEach(button => button.addEventListener('click', () => activate(button)));
})();
