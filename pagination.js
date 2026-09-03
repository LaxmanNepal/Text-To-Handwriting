(() => {
  'use strict';

  const KEY = 'tth-pagination-settings';
  const DEFAULTS = { size: 'A4', margin: 18, showNumbers: true, preview: false };
  const SIZES = {
    A4: { width: '210mm', height: '297mm', label: 'A4' },
    Letter: { width: '8.5in', height: '11in', label: 'Letter' }
  };

  const read = () => {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (_) { return { ...DEFAULTS }; }
  };
  const save = settings => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {} };
  const editor = () => document.querySelector('.paper-content') || document.getElementById('paper-content');

  const installStyle = () => {
    if (document.getElementById('tth-pagination-css')) return;
    const style = document.createElement('style');
    style.id = 'tth-pagination-css';
    style.textContent = `
      .tth-page-mode .paper-sheet { min-height:var(--tth-page-height); width:var(--tth-page-width); max-width:100%; margin:0 auto 22px; box-sizing:border-box; overflow:hidden; }
      .tth-page-mode .paper-content { min-height:calc(var(--tth-page-height) - 36mm); box-sizing:border-box; }
      .tth-page-number { position:absolute; bottom:7mm; left:0; right:0; text-align:center; font:600 11px system-ui,sans-serif; color:#64748b; pointer-events:none; }
      #tth-pagination-preview { display:none; width:100%; margin-top:12px; }
      #tth-pagination-preview.is-visible { display:block; }
      .tth-preview-toolbar { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin:0 0 10px; font:600 12px system-ui,sans-serif; color:#64748b; }
      .tth-preview-pages { display:flex; flex-direction:column; align-items:center; gap:18px; }
      .tth-preview-page { position:relative; width:var(--tth-page-width); height:var(--tth-page-height); max-width:100%; box-sizing:border-box; overflow:hidden; background:#fff; box-shadow:0 10px 25px -5px rgba(0,0,0,.12); padding:var(--tth-pagination-margin); }
      .tth-preview-content { width:100%; height:100%; box-sizing:border-box; overflow:hidden; white-space:pre-wrap; word-wrap:break-word; }
      .tth-preview-content .paper-content { min-height:0 !important; padding:0 !important; width:100%; }
      .tth-preview-page .tth-page-number { bottom:5mm; }
      .tth-pagination-control { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:8px; }
      .tth-pagination-control select,.tth-pagination-control button { border:1px solid #cbd5e1; border-radius:10px; padding:7px 10px; background:#fff; color:#334155; font:600 12px system-ui,sans-serif; }
      @media (max-width:639px){ .tth-preview-page{ width:min(var(--tth-page-width),100%); height:auto; aspect-ratio:210/297; } }
      @media print {
        .tth-preview-toolbar,.tth-pagination-control,#paper-wrapper { display:none !important; }
        #tth-pagination-preview.is-visible { display:block !important; }
        .tth-preview-pages { gap:0; }
        .tth-preview-page { max-width:none; box-shadow:none; break-after:page; page-break-after:always; }
        .tth-preview-page:last-child { break-after:auto; page-break-after:auto; }
      }
    `;
    document.head.appendChild(style);
  };

  const ensureUI = () => {
    const paperWrapper = document.getElementById('paper-wrapper');
    if (!paperWrapper || document.getElementById('tth-pagination-preview')) return;
    const host = document.createElement('section');
    host.id = 'tth-pagination-preview';
    host.setAttribute('aria-label', 'Multi-page preview');
    host.innerHTML = `
      <div class="tth-preview-toolbar"><span><i class="fa-solid fa-file-lines"></i> Multi-page preview</span><span id="tth-page-count">1 page</span></div>
      <div class="tth-preview-pages" id="tth-preview-pages"></div>
    `;
    paperWrapper.parentNode.insertBefore(host, paperWrapper.nextSibling);
  };

  const setDimensions = settings => {
    const size = SIZES[settings.size] || SIZES.A4;
    document.documentElement.style.setProperty('--tth-page-width', size.width);
    document.documentElement.style.setProperty('--tth-page-height', size.height);
    document.documentElement.style.setProperty('--tth-pagination-margin', `${Math.max(8, Number(settings.margin) || 18)}mm`);
  };

  const textLength = node => node.nodeType === Node.TEXT_NODE ? node.textContent.length : Array.from(node.childNodes || []).reduce((n, c) => n + textLength(c), 0);

  const hasMeaningfulContent = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.length > 0;
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    return node.tagName === 'BR' || !!node.textContent.trim() || !!node.querySelector('img,canvas,br');
  };

  // Split a DOM subtree at natural text boundaries. The handwriting engine produces
  // character spans, so most splits happen cleanly between glyphs without changing style.
  const appendWithSplit = (source, page, pages, capacity) => {
    if (!hasMeaningfulContent(source)) return page;
    const candidate = source.cloneNode(true);
    page.content.appendChild(candidate);
    if (page.content.scrollHeight <= capacity) return page;
    page.content.removeChild(candidate);

    if (source.nodeType === Node.TEXT_NODE) {
      const value = source.textContent || '';
      if (!value) return page;
      let lo = 1, hi = value.length, best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const part = document.createTextNode(value.slice(0, mid));
        page.content.appendChild(part);
        if (page.content.scrollHeight <= capacity) { best = mid; page.content.removeChild(part); lo = mid + 1; }
        else { page.content.removeChild(part); hi = mid - 1; }
      }
      if (best === 0) {
        const next = createPage(pages.length + 1);
        pages.push(next);
        return appendWithSplit(source, next, pages, capacity);
      }
      page.content.appendChild(document.createTextNode(value.slice(0, best)));
      const rest = document.createTextNode(value.slice(best));
      const next = createPage(pages.length + 1);
      pages.push(next);
      return appendWithSplit(rest, next, pages, capacity);
    }

    if (source.nodeType === Node.ELEMENT_NODE) {
      const wrapper = source.cloneNode(false);
      page.content.appendChild(wrapper);
      if (page.content.scrollHeight > capacity) {
        page.content.removeChild(wrapper);
        const next = createPage(pages.length + 1);
        pages.push(next);
        return appendWithSplit(source, next, pages, capacity);
      }
      for (const child of Array.from(source.childNodes)) {
        const holder = { content: wrapper };
        const before = wrapper.childNodes.length;
        const tempPages = [page];
        appendWithSplit(child, holder, tempPages, capacity);
        if (wrapper.childNodes.length === before && child.textContent) {
          // Fallback for unusual nested content that could not be split.
          wrapper.appendChild(child.cloneNode(true));
        }
      }
      return page;
    }
    return page;
  };

  const createPage = number => {
    const page = document.createElement('div');
    page.className = 'tth-preview-page';
    page.dataset.page = String(number);
    const content = document.createElement('div');
    content.className = 'tth-preview-content';
    page.appendChild(content);
    return { el: page, content };
  };

  const render = () => {
    const settings = read();
    setDimensions(settings);
    ensureUI();
    const preview = document.getElementById('tth-pagination-preview');
    const pagesHost = document.getElementById('tth-preview-pages');
    const source = editor();
    if (!preview || !pagesHost || !source) return [];

    pagesHost.replaceChildren();
    const pages = [createPage(1)];
    const capacity = Math.max(80, Math.floor((source.clientHeight || 700) * (1 - Math.min(.45, Math.max(0, settings.margin - 8) / 100))));

    // Clone computed typography so the preview matches the live handwriting sheet.
    for (const child of Array.from(source.childNodes)) {
      appendWithSplit(child, pages[pages.length - 1], pages, capacity);
    }

    pages.forEach((p, i) => {
      if (settings.showNumbers) {
        const n = document.createElement('div');
        n.className = 'tth-page-number';
        n.textContent = `Page ${i + 1}`;
        p.el.appendChild(n);
      }
      pagesHost.appendChild(p.el);
    });
    const count = document.getElementById('tth-page-count');
    if (count) count.textContent = `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`;
    return pages;
  };

  const apply = overrides => {
    const settings = Object.assign(read(), overrides || {});
    save(settings);
    setDimensions(settings);
    document.body.classList.add('tth-page-mode');
    document.querySelectorAll('.tth-page-number').forEach(n => n.remove());
    if (settings.preview) {
      ensureUI();
      document.getElementById('tth-pagination-preview')?.classList.add('is-visible');
      requestAnimationFrame(render);
    }
    return settings;
  };

  const enablePreview = () => {
    const settings = Object.assign(read(), { preview: true });
    save(settings);
    apply(settings);
  };

  const disablePreview = () => {
    const settings = Object.assign(read(), { preview: false });
    save(settings);
    document.getElementById('tth-pagination-preview')?.classList.remove('is-visible');
  };

  const disable = () => {
    disablePreview();
    document.body.classList.remove('tth-page-mode');
    document.querySelectorAll('.tth-page-number').forEach(n => n.remove());
  };

  const getSettings = () => read();
  const getSizes = () => SIZES;

  const boot = () => {
    installStyle();
    ensureUI();
    window.TTHPagination = { apply, disable, render, enablePreview, disablePreview, getSettings, getSizes };
    const e = editor();
    if (e) {
      let timer;
      e.addEventListener('input', () => {
        if (!read().preview) return;
        clearTimeout(timer);
        timer = setTimeout(render, 120);
      });
    }
    if (read().preview) apply(read());
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
