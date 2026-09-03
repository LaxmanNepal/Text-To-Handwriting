(() => {
  'use strict';

  // Phase 3 foundation: A4 pagination helpers for screen/print/PDF workflows.
  const KEY = 'tth-pagination-settings';
  const DEFAULTS = { size: 'A4', margin: 18, showNumbers: true };
  const SIZES = {
    A4: { width: '210mm', height: '297mm', label: 'A4' },
    Letter: { width: '8.5in', height: '11in', label: 'Letter' }
  };

  const read = () => {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (_) { return { ...DEFAULTS }; }
  };
  const save = settings => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {} };

  const installStyle = () => {
    if (document.getElementById('tth-pagination-css')) return;
    const style = document.createElement('style');
    style.id = 'tth-pagination-css';
    style.textContent = `
      .tth-page-mode .paper-sheet { min-height: var(--tth-page-height); width: var(--tth-page-width); max-width:100%; margin:0 auto 22px; box-sizing:border-box; overflow:hidden; }
      .tth-page-mode .paper-content { min-height:calc(var(--tth-page-height) - 36mm); box-sizing:border-box; }
      .tth-page-number { position:absolute; bottom:7mm; left:0; right:0; text-align:center; font:600 11px system-ui,sans-serif; color:#64748b; pointer-events:none; }
      @media print {
        .tth-page-mode .paper-sheet { margin:0; box-shadow:none; break-after:page; page-break-after:always; }
        .tth-page-mode .paper-sheet:last-child { break-after:auto; page-break-after:auto; }
      }
    `;
    document.head.appendChild(style);
  };

  const apply = overrides => {
    const settings = Object.assign(read(), overrides || {});
    const size = SIZES[settings.size] || SIZES.A4;
    document.documentElement.style.setProperty('--tth-page-width', size.width);
    document.documentElement.style.setProperty('--tth-page-height', size.height);
    document.body.classList.add('tth-page-mode');
    save(settings);
    document.querySelectorAll('.tth-page-number').forEach(n => n.remove());
    if (settings.showNumbers) {
      const sheet = document.querySelector('.paper-sheet');
      if (sheet) {
        const n = document.createElement('div');
        n.className = 'tth-page-number';
        n.textContent = 'Page 1';
        sheet.appendChild(n);
      }
    }
    return settings;
  };

  const disable = () => {
    document.body.classList.remove('tth-page-mode');
    document.querySelectorAll('.tth-page-number').forEach(n => n.remove());
  };

  const getSettings = () => read();
  const getSizes = () => SIZES;

  const boot = () => {
    installStyle();
    window.TTHPagination = { apply, disable, getSettings, getSizes };
    // Preserve the current editor experience; A4 mode is opt-in until the
    // editor/export layer can safely split content across multiple pages.
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
