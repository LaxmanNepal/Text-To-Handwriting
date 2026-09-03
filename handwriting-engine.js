(() => {
  'use strict';

  // Phase 2: procedural handwriting variation.
  // This keeps the selected handwriting font but varies each character's
  // transform/opacity/spacing so repeated glyphs do not look mechanically identical.
  const STYLE_ID = 'tth-handwriting-engine-css';
  const ROOT_CLASS = 'tth-handwriting-rendered';
  let enabled = true;
  let observer = null;
  let raf = 0;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  // Stable pseudo-random value: the same text/settings produce the same page
  // until the user changes the variation seed.
  const hash = (text) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const random = (seed) => {
    let x = seed >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${ROOT_CLASS} .tth-glyph {
        display: inline-block;
        transform-origin: 50% 85%;
        will-change: transform, opacity;
        white-space: pre;
      }
      .${ROOT_CLASS} .tth-space { display: inline; }
      .${ROOT_CLASS} .tth-line-break { display:block; height:0; }
    `;
    document.head.appendChild(style);
  };

  const getSettings = () => {
    const content = document.querySelector('.paper-content');
    return {
      realism: clamp(Number(window.TTHHandwritingSettings?.realism ?? 35), 0, 100),
      rotation: clamp(Number(window.TTHHandwritingSettings?.rotation ?? 2), 0, 6),
      opacity: clamp(Number(window.TTHHandwritingSettings?.opacity ?? 92), 50, 100),
      spacing: Number(window.TTHHandwritingSettings?.spacing ?? 0),
      seed: Number(window.TTHHandwritingSettings?.seed ?? 1),
      content
    };
  };

  const shouldSkip = (node) => {
    if (!node) return true;
    if (node.nodeType === Node.TEXT_NODE) return false;
    return node.nodeType !== Node.ELEMENT_NODE ||
      node.closest?.('img,button,input,textarea,select,script,style,.tth-glyph');
  };

  const wrapTextNode = (node, settings, path) => {
    const text = node.nodeValue || '';
    if (!text.trim() && !text.includes('\n')) return;
    const fragment = document.createDocumentFragment();
    let position = 0;
    for (const char of text) {
      if (char === '\n') {
        fragment.appendChild(document.createElement('br'));
        position++;
        continue;
      }
      if (char === ' ' || char === '\t') {
        const span = document.createElement('span');
        span.className = 'tth-space';
        span.textContent = char;
        fragment.appendChild(span);
        position++;
        continue;
      }
      const span = document.createElement('span');
      span.className = 'tth-glyph';
      span.textContent = char;
      const seed = hash(`${settings.seed}|${path}|${position}|${char}`);
      const r1 = random(seed);
      const r2 = random(seed + 101);
      const r3 = random(seed + 202);
      const amount = settings.realism / 100;
      const angle = (r1 - 0.5) * settings.rotation * amount * 2;
      const y = (r2 - 0.5) * 1.8 * amount;
      const scale = 1 + (r3 - 0.5) * 0.035 * amount;
      const alphaJitter = (r1 - 0.5) * 0.10 * amount;
      const opacity = clamp(settings.opacity / 100 + alphaJitter, 0.35, 1);
      const spacing = settings.spacing + (r2 - 0.5) * 0.45 * amount;
      span.style.transform = `translateY(${y.toFixed(2)}px) rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      span.style.opacity = opacity.toFixed(3);
      span.style.marginRight = `${spacing.toFixed(2)}px`;
      fragment.appendChild(span);
      position++;
    }
    node.replaceWith(fragment);
  };

  const render = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const settings = getSettings();
      const content = settings.content;
      if (!enabled || !content) return;
      if (content.dataset.tthRendering === '1') return;
      content.dataset.tthRendering = '1';
      ensureStyle();
      content.classList.add(ROOT_CLASS);
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (!node.parentElement?.closest('.tth-glyph') && !shouldSkip(node.parentElement)) nodes.push(node);
      }
      nodes.forEach((textNode, index) => wrapTextNode(textNode, settings, index));
      delete content.dataset.tthRendering;
    });
  };

  const unwrap = () => {
    const content = document.querySelector('.paper-content');
    if (!content) return;
    content.querySelectorAll('.tth-glyph, .tth-space').forEach(span => {
      span.replaceWith(document.createTextNode(span.textContent || ''));
    });
    content.querySelectorAll('br').forEach(br => {
      // Preserve explicit line breaks while allowing a future render.
      br.dataset.tthBreak = '1';
    });
    content.normalize();
    content.classList.remove(ROOT_CLASS);
  };

  const refresh = () => {
    const content = document.querySelector('.paper-content');
    if (!content) return;
    unwrap();
    render();
  };

  const setSettings = (settings) => {
    window.TTHHandwritingSettings = Object.assign({}, window.TTHHandwritingSettings || {}, settings);
    refresh();
  };

  const setEnabled = (value) => {
    enabled = Boolean(value);
    if (enabled) refresh(); else unwrap();
  };

  const boot = () => {
    window.TTHHandwritingEngine = { refresh, setSettings, setEnabled };
    const content = document.querySelector('.paper-content');
    if (!content) return;
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      if (content.dataset.tthRendering === '1') return;
      if (mutations.some(m => m.type === 'childList' || m.type === 'characterData')) render();
    });
    observer.observe(content, { childList: true, subtree: true, characterData: true });
    render();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
