'use strict';

(() => {
  const hero = document.querySelector('#heroMedia');
  const buttons = [...document.querySelectorAll('[data-media-index]')];
  const dialog = document.querySelector('[data-media-dialog]');
  const lightboxImage = dialog?.querySelector('[data-lightbox-image]');
  const closeButton = dialog?.querySelector('[data-lightbox-close]');
  const previousButton = dialog?.querySelector('[data-lightbox-previous]');
  const nextButton = dialog?.querySelector('[data-lightbox-next]');
  const imageButtons = buttons.filter(button => button.dataset.mediaType === 'image');
  if (!hero || !buttons.length) return;

  let activeButton = buttons.find(button => button.classList.contains('active')) || buttons[0];
  let activeImageIndex = 0;
  let lightboxOpener = null;

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
      hero.innerHTML = `<video controls autoplay preload="none" poster="${poster}"><source src="${escapeAttribute(source)}"></video>`;
    } else {
      hero.innerHTML = `<button class="hero-image-button" type="button" data-open-lightbox data-image-media-index="${escapeAttribute(button.dataset.mediaIndex)}" aria-label="${escapeAttribute(button.getAttribute('aria-label'))}"><img src="${escapeAttribute(source)}" alt="${title}"></button>`;
    }

    activeButton = button;
    buttons.forEach(item => item.classList.toggle('active', item === button));
  }

  buttons.forEach(button => button.addEventListener('click', () => activate(button)));

  function showLightboxImage() {
    const button = imageButtons[activeImageIndex];
    if (!button || !lightboxImage) return;
    lightboxImage.src = button.dataset.mediaFullSrc || button.dataset.mediaSrc;
    lightboxImage.alt = button.dataset.mediaTitle || '';
    const hasMultipleImages = imageButtons.length > 1;
    previousButton.hidden = !hasMultipleImages;
    nextButton.hidden = !hasMultipleImages;
  }

  function openLightbox(button, opener) {
    if (!dialog || !lightboxImage) return;
    const imageIndex = imageButtons.indexOf(button);
    if (imageIndex < 0) return;
    activeImageIndex = imageIndex;
    lightboxOpener = opener;
    showLightboxImage();
    document.body.classList.add('lightbox-open');
    dialog.showModal();
    closeButton.focus();
  }

  function navigateLightbox(offset) {
    if (imageButtons.length < 2) return;
    activeImageIndex = (activeImageIndex + offset + imageButtons.length) % imageButtons.length;
    showLightboxImage();
  }

  hero.addEventListener('click', event => {
    const activation = event.target.closest('[data-activate-media]');
    if (activation) {
      const target = buttons.find(button => button.dataset.mediaIndex === activation.dataset.activateMedia);
      if (target) activate(target);
      return;
    }

    const opener = event.target.closest('[data-open-lightbox]');
    if (!opener) return;
    const target = imageButtons.find(button => button.dataset.mediaIndex === opener.dataset.imageMediaIndex)
      || (activeButton.dataset.mediaType === 'image' ? activeButton : null);
    if (target) openLightbox(target, opener);
  });

  closeButton?.addEventListener('click', () => dialog.close());
  previousButton?.addEventListener('click', () => navigateLightbox(-1));
  nextButton?.addEventListener('click', () => navigateLightbox(1));
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog?.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigateLightbox(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigateLightbox(1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog?.addEventListener('close', () => {
    document.body.classList.remove('lightbox-open');
    lightboxImage?.removeAttribute('src');
    lightboxOpener?.focus();
    lightboxOpener = null;
  });
})();
