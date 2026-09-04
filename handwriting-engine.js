(() => {
  'use strict';

  // Phase 2.3: editor-safe rendering.
  // The handwriting layer must never steal the user's caret or break native
  // contenteditable undo/redo while glyph spans are being regenerated.
  const STYLE_ID = 'tth-handwriting-engine-css';
  const ROOT_CLASS = 'tth-handwriting-rendered';
  const SETTINGS_KEY = 'tth-studio-v3-settings';
  const PROFILES = {
    neat: { name: 'Neat Student', realism: 28, rotation: 1.2, spacing: 0 },
    fast: { name: 'Fast Writing', realism: 72, rotation: 3.8, spacing: -0.25 },
    exam: { name: 'Exam Writing', realism: 48, rotation: 2, spacing: 0.05 },
    casual: { name: 'Casual Notes', realism: 62, rotation: 3, spacing: 0.15 },
    messy: { name: 'Messy Writing', realism: 92, rotation: 5.2, spacing: -0.45 },
    signature: { name: 'Signature Style', realism: 78, rotation: 4.4, spacing: -0.35 }
  };

  let enabled = true;
  let observer = null;
  let raf = 0;
  let rendering = false;
  let queued = false;

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const hash = text => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const random = seed => {
    let x = seed >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .${ROOT_CLASS} .tth-glyph{display:inline-block;transform-origin:50% 85%;will-change:transform,opacity;white-space:pre;position:relative}
      .${ROOT_CLASS} .tth-space{white-space:pre}
      .${ROOT_CLASS} .tth-glyph.v1{font-variation-settings:"wght" 430}
      .${ROOT_CLASS} .tth-glyph.v2{letter-spacing:-.025em}
      .${ROOT_CLASS} .tth-glyph.v3{letter-spacing:.018em}
      .${ROOT_CLASS} .tth-glyph.v4{font-stretch:96%}
    `;
    document.head.appendChild(s);
  };

  const getSettings = () => {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) {}
    const source = Object.assign({}, stored, window.TTHHandwritingSettings || {});
    const profileKey = source.profile || 'casual';
    const profile = PROFILES[profileKey] || PROFILES.casual;
    return {
      profile: profileKey,
      realism: clamp(Number(source.realism ?? profile.realism), 0, 100),
      rotation: clamp(Number(source.rotation ?? profile.rotation), 0, 6),
      opacity: clamp(Number(source.opacity ?? 92), 50, 100),
      spacing: Number(source.spacing ?? profile.spacing),
      seed: Number(source.seed ?? 1),
      content: document.querySelector('.paper-content')
    };
  };

  const skip = el => !el || el.closest?.('img,button,input,textarea,select,script,style,.tth-glyph,.tth-space');
  const variantFor = (char, seed, amount) => {
    if (amount < .2 || !/[A-Za-z]/.test(char)) return 0;
    return Math.floor(random(seed + 701) * 4) + 1;
  };

  // Convert the current selection into plain-text offsets. This survives
  // replacing text nodes with glyph spans and is independent of DOM wrappers.
  const getPointOffset = (root, node, offset) => {
    const range = document.createRange();
    range.selectNodeContents(root);
    try {
      range.setEnd(node, Math.min(offset, node.nodeType === Node.TEXT_NODE ? node.nodeValue.length : node.childNodes.length));
      return range.toString().length;
    } catch (_) { return null; }
  };

  const captureSelection = root => {
    const sel = window.getSelection?.();
    if (!sel || !sel.rangeCount || !root.contains(sel.anchorNode)) return null;
    const range = sel.getRangeAt(0);
    return {
      start: getPointOffset(root, range.startContainer, range.startOffset),
      end: getPointOffset(root, range.endContainer, range.endOffset),
      collapsed: range.collapsed,
      focused: document.activeElement === root || root.contains(document.activeElement)
    };
  };

  const locateTextOffset = (root, target) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    let remaining = Math.max(0, Number(target) || 0);
    while ((node = walker.nextNode())) {
      const len = node.nodeValue?.length || 0;
      if (remaining <= len) return { node, offset: remaining };
      remaining -= len;
    }
    return { node: root, offset: root.childNodes.length };
  };

  const restoreSelection = (root, saved) => {
    if (!saved || saved.start == null) return;
    const sel = window.getSelection?.();
    if (!sel) return;
    try {
      const a = locateTextOffset(root, saved.start);
      const b = locateTextOffset(root, saved.end ?? saved.start);
      const range = document.createRange();
      range.setStart(a.node, Math.min(a.offset, a.node.nodeType === Node.TEXT_NODE ? a.node.nodeValue.length : a.node.childNodes.length));
      range.setEnd(b.node, Math.min(b.offset, b.node.nodeType === Node.TEXT_NODE ? b.node.nodeValue.length : b.node.childNodes.length));
      sel.removeAllRanges();
      sel.addRange(range);
      if (saved.focused) root.focus({ preventScroll: true });
    } catch (_) {}
  };

  const wrap = (node, settings, path) => {
    const text = node.nodeValue || '';
    if (!text) return;
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const char of text) {
      if (char === '\n') {
        frag.appendChild(document.createElement('br'));
        pos++;
        continue;
      }
      if (char === ' ' || char === '\t') {
        const sp = document.createElement('span');
        sp.className = 'tth-space';
        sp.textContent = char;
        frag.appendChild(sp);
        pos++;
        continue;
      }
      const sp = document.createElement('span');
      sp.className = 'tth-glyph';
      sp.textContent = char;
      const seed = hash(`${settings.seed}|${path}|${pos}|${char}`);
      const r1 = random(seed), r2 = random(seed + 101), r3 = random(seed + 202), r4 = random(seed + 303);
      const amount = settings.realism / 100;
      const variant = variantFor(char, seed, amount);
      if (variant) sp.classList.add('v' + variant);
      const angle = (r1 - .5) * settings.rotation * amount * 2;
      const y = (r2 - .5) * 1.8 * amount;
      const x = (r4 - .5) * .45 * amount;
      const sx = 1 + (r3 - .5) * .028 * amount;
      const sy = 1 + (r2 - .5) * .045 * amount;
      const ink = (r1 - .5) * .10 * amount;
      const opacity = clamp(settings.opacity / 100 + ink, .35, 1);
      const spacing = settings.spacing + (r2 - .5) * .45 * amount;
      sp.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${angle.toFixed(2)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
      sp.style.opacity = opacity.toFixed(3);
      sp.style.marginRight = `${spacing.toFixed(2)}px`;
      frag.appendChild(sp);
      pos++;
    }
    node.replaceWith(frag);
  };

  const unwrap = root => {
    root.querySelectorAll('.tth-glyph,.tth-space').forEach(sp => sp.replaceWith(document.createTextNode(sp.textContent || '')));
    root.normalize();
    root.classList.remove(ROOT_CLASS);
  };

  const performRender = () => {
    if (rendering) { queued = true; return; }
    const settings = getSettings();
    const content = settings.content;
    if (!enabled || !content) return;

    const savedSelection = captureSelection(content);
    rendering = true;
    observer?.disconnect();
    try {
      unwrap(content);
      ensureStyle();
      content.classList.add(ROOT_CLASS);
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) {
        if (!skip(n.parentElement)) nodes.push(n);
      }
      nodes.forEach((node, i) => wrap(node, settings, i));
      restoreSelection(content, savedSelection);
    } finally {
      rendering = false;
      if (observer) observer.observe(content, { childList: true, subtree: true, characterData: true });
    }
    if (queued) {
      queued = false;
      scheduleRender();
    }
  };

  const scheduleRender = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      performRender();
    });
  };

  const refresh = () => scheduleRender();
  const setSettings = settings => {
    window.TTHHandwritingSettings = Object.assign({}, window.TTHHandwritingSettings || {}, settings);
    refresh();
  };
  const setEnabled = value => {
    enabled = Boolean(value);
    const content = document.querySelector('.paper-content');
    if (!enabled && content) {
      observer?.disconnect();
      unwrap(content);
      if (observer) observer.observe(content, { childList: true, subtree: true, characterData: true });
    } else refresh();
  };

  const boot = () => {
    window.TTHHandwritingEngine = { refresh, setSettings, setEnabled, getProfiles: () => ({ ...PROFILES }) };
    const content = document.querySelector('.paper-content');
    if (!content) return;

    observer?.disconnect();
    observer = new MutationObserver(mutations => {
      if (rendering) return;
      if (mutations.some(m => m.type === 'childList' || m.type === 'characterData')) scheduleRender();
    });
    observer.observe(content, { childList: true, subtree: true, characterData: true });

    // Native contenteditable handles undo/redo. These shortcuts only force a
    // safe visual refresh after the browser applies its history operation.
    content.addEventListener('keyup', event => {
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
        setTimeout(scheduleRender, 0);
      }
    });

    render();
  };

  const render = () => scheduleRender();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();