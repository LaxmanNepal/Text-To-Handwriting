(() => {
  'use strict';

  // Phase 1: document/project data is stored through TTHDocs (IndexedDB).
  // UI preferences remain in localStorage because they are device preferences,
  // not document/project data.
  const SETTINGS_KEY = 'tth-studio-v3-settings';
  const defaults = { paper: 'scanner', pen: 'blue', profile: 'casual', realism: 35, rotation: 2, opacity: 92, spacing: 0, lineHeight: 32 };
  const profiles = { neat: 'Neat Student', fast: 'Fast Writing', exam: 'Exam Writing', casual: 'Casual Notes', messy: 'Messy Writing', signature: 'Signature Style' };
  const papers = {
    scanner: { name: 'Scanner Effect', bg: '#f8f8f5', line: '#cbd5e1' },
    ruled: { name: 'Ruled Notebook', bg: '#fff', line: '#cbd5e1' },
    blank: { name: 'Blank White', bg: '#fff', line: 'transparent' },
    cream: { name: 'Warm Cream', bg: '#fffaf0', line: '#d8d1bf' },
    exam: { name: 'Exam Sheet', bg: '#fff', line: '#d7dee8' },
    vintage: { name: 'Vintage Paper', bg: '#f7efd9', line: '#cbbd9b' }
  };
  const pens = {
    blue: { name: 'Blue Pen', color: '#183b8c' },
    black: { name: 'Black Pen', color: '#171717' },
    darkblue: { name: 'Dark Blue', color: '#102a56' },
    pencil: { name: 'Pencil', color: '#4b5563' }
  };

  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) {}
  const state = Object.assign({}, defaults, stored);
  let panel = null;

  const saveSettings = () => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state)); } catch (_) {}
  };

  const toast = (message, error = false) => {
    let el = document.getElementById('studio-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'studio-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10050;padding:10px 15px;border-radius:14px;background:' + (error ? '#9f1239' : '#0f172a') + ';color:#fff;font:600 13px system-ui;box-shadow:0 12px 30px #0002';
      document.body.appendChild(el);
    }
    el.textContent = message;
    clearTimeout(el._timer);
    el.hidden = false;
    el._timer = setTimeout(() => { el.hidden = true; }, 2200);
  };

  const waitForDocs = async () => {
    if (window.TTHDocs) return window.TTHDocs;
    if (window.TTHStorage) {
      const event = new Promise(resolve => {
        window.addEventListener('tth-storage-ready', () => resolve(window.TTHDocs), { once: true });
      });
      await Promise.race([event, new Promise(resolve => setTimeout(resolve, 1000))]);
    }
    return window.TTHDocs || null;
  };

  const css = `.studio-v2{position:fixed;right:16px;bottom:78px;z-index:10020;width:min(360px,calc(100vw - 32px));max-height:min(78vh,680px);overflow:auto;background:rgba(255,255,255,.97);border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 24px 70px #0f172a2b;padding:16px;font:14px system-ui;color:#0f172a}.studio-v2 h3{margin:0;font-size:17px}.studio-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.studio-grid button,.studio-actions button{border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:9px;cursor:pointer;font-weight:650}.studio-grid button.active{border-color:#0284c7;background:#e0f2fe;color:#0369a1}.studio-row{margin-top:13px}.studio-row label{display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:5px}.studio-row input{width:100%}.studio-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}.studio-actions .primary{background:#0284c7;color:white;border-color:#0284c7}.studio-close{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:20px;cursor:pointer}.studio-install{position:fixed;right:16px;bottom:78px;z-index:10019;border:0;border-radius:15px;padding:11px 14px;background:#0284c7;color:#fff;font:700 13px system-ui;box-shadow:0 10px 30px #02874d;box-shadow:0 10px 30px #02874d33}@media(max-width:639px){.studio-v2{right:8px;bottom:70px;width:calc(100vw - 16px);max-height:72vh;border-radius:18px;padding:14px}.studio-install{right:10px;bottom:70px}.studio-grid{gap:7px}.studio-grid button{min-height:42px}}`;

  const inject = () => {
    if (document.getElementById('studio-v2-css')) return;
    const style = document.createElement('style');
    style.id = 'studio-v2-css';
    style.textContent = css;
    document.head.appendChild(style);
  };

  const apply = () => {
    const sheet = document.querySelector('.paper-sheet');
    if (sheet) {
      const paper = papers[state.paper] || papers.scanner;
      sheet.style.backgroundColor = paper.bg;
      sheet.style.setProperty('--studio-line', paper.line);
      sheet.classList.toggle('paper-scanner-effect', state.paper === 'scanner');
    }
    const content = document.querySelector('.paper-content');
    if (content) {
      const pen = pens[state.pen] || pens.blue;
      content.style.color = pen.color;
      content.style.lineHeight = state.lineHeight + 'px';
      content.style.letterSpacing = state.spacing + 'px';
      content.style.textShadow = `${state.rotation / 10}px ${state.realism / 30}px ${Math.max(0, state.realism / 20)}px rgba(0,0,0,${Math.max(0, (100 - state.opacity) / 1000)})`;
    }
    document.querySelectorAll('.paper-line-row').forEach(row => {
      row.style.borderBottomColor = (papers[state.paper] || papers.scanner).line;
    });
    saveSettings();
  };

  const saveCurrentProject = async () => {
    const docs = await waitForDocs();
    const content = document.querySelector('.paper-content');
    if (!docs || !content) {
      toast('Document storage is not ready. Please refresh.', true);
      return;
    }
    const existing = await docs.list();
    const current = existing[0];
    const title = (content.innerText || '').trim().split('\n').find(Boolean)?.slice(0, 60) || 'Untitled handwriting';
    const item = await docs.save({
      id: current?.id || crypto.randomUUID(),
      title,
      text: content.innerText || '',
      html: content.innerHTML || '',
      settings: { ...state }
    });
    toast(`Project saved: ${item.title}`);
    window.dispatchEvent(new CustomEvent('tth-document-saved', { detail: item }));
  };

  const createNewDraft = async () => {
    const content = document.querySelector('.paper-content');
    if (!content) return;
    const docs = await waitForDocs();
    if (docs) {
      const existing = await docs.list();
      const current = existing[0];
      if (current && ((content.innerText || '').trim() || content.querySelector('img'))) {
        await docs.save({ ...current, text: content.innerText || '', html: content.innerHTML || '', settings: { ...state } });
      }
    }
    content.innerHTML = '';
    content.dispatchEvent(new Event('input', { bubbles: true }));
    toast('New draft created');
  };

  const render = async () => {
    if (panel) panel.remove();
    panel = document.createElement('aside');
    panel.className = 'studio-v2';
    panel.innerHTML = `<button class="studio-close" aria-label="Close Handwriting Studio">×</button><h3>Handwriting Studio</h3><div class="studio-saved">Preferences are saved on this device. Documents use IndexedDB.</div><div class="studio-row"><label>Paper</label><div class="studio-grid">${Object.entries(papers).map(([key, value]) => `<button data-paper="${key}" class="${state.paper === key ? 'active' : ''}">${value.name}</button>`).join('')}</div></div><div class="studio-row"><label>Writing Style</label><div class="studio-grid">${Object.entries(profiles).map(([key,name]) => `<button data-profile="${key}" class="${state.profile === key ? 'active' : ''}">${name}</button>`).join('')}</div></div><div class="studio-row"><label>Pen <span>${(pens[state.pen] || pens.blue).name}</span></label><div class="studio-grid">${Object.entries(pens).map(([key, value]) => `<button data-pen="${key}" class="${state.pen === key ? 'active' : ''}">${value.name}</button>`).join('')}</div></div><div class="studio-row"><label>Realism <output>${state.realism}</output></label><input data-range="realism" type="range" min="0" max="100" value="${state.realism}"></div><div class="studio-row"><label>Character rotation <output>${state.rotation}°</output></label><input data-range="rotation" type="range" min="0" max="6" value="${state.rotation}"></div><div class="studio-row"><label>Ink opacity <output>${state.opacity}%</output></label><input data-range="opacity" type="range" min="50" max="100" value="${state.opacity}"></div><div class="studio-row"><label>Letter spacing <output>${state.spacing}px</output></label><input data-range="spacing" type="range" min="-1" max="4" step=".5" value="${state.spacing}"></div><div class="studio-row"><label>Line height <output>${state.lineHeight}px</output></label><input data-range="lineHeight" type="range" min="24" max="48" value="${state.lineHeight}"></div><div class="studio-actions"><button id="studio-new">New Draft</button><button id="studio-save" class="primary">Save Project</button></div>`;
    document.body.appendChild(panel);

    panel.querySelector('.studio-close').onclick = () => panel.remove();
    panel.querySelectorAll('[data-paper]').forEach(button => button.onclick = () => {
      state.paper = button.dataset.paper;
      apply();
      render();
    });
    panel.querySelectorAll('[data-profile]').forEach(button => button.onclick = () => { state.profile = button.dataset.profile; window.TTHHandwritingEngine?.setProfile?.(state.profile); saveSettings(); render(); });
    panel.querySelectorAll('[data-pen]').forEach(button => button.onclick = () => {
      state.pen = button.dataset.pen;
      apply();
      render();
    });
    panel.querySelectorAll('[data-range]').forEach(input => input.oninput = () => {
      state[input.dataset.range] = Number(input.value);
      apply();
      const suffix = input.dataset.range === 'rotation' ? '°' : input.dataset.range === 'opacity' ? '%' : (input.dataset.range === 'spacing' || input.dataset.range === 'lineHeight') ? 'px' : '';
      input.previousElementSibling.querySelector('output').textContent = input.value + suffix;
    });
    panel.querySelector('#studio-new').onclick = () => { void createNewDraft(); };
    panel.querySelector('#studio-save').onclick = () => { void saveCurrentProject().catch(error => { console.error(error); toast('Could not save project.', true); }); };
  };

  const boot = () => {
    inject();
    if (document.getElementById('studio-install')) return;
    const button = document.createElement('button');
    button.id = 'studio-install';
    button.className = 'studio-install';
    button.type = 'button';
    button.textContent = '✦ Studio';
    button.setAttribute('aria-label', 'Open Handwriting Studio');
    button.onclick = () => { void render(); };
    document.body.appendChild(button);
    apply();
    if (location.search.includes('action=create')) setTimeout(() => { void render(); }, 400);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
