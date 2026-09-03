(() => {
  'use strict';

  const APP_SCOPE = '/Text-To-Handwriting/';
  const SW_URL = `${APP_SCOPE}sw.js`;
  const LEGACY_DRAFT_KEYS = ['tth-draft-v3', 'tth-draft-v2'];
  let deferredPrompt = null;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const editor = () => document.querySelector('.paper-content') || document.getElementById('paper-content');

  const loadScript = src => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

  const toast = message => {
    let el = document.getElementById('pwa-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pwa-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;left:16px;right:16px;bottom:18px;z-index:10001;display:none;padding:12px 16px;border:1px solid rgba(2,132,199,.18);border-radius:16px;background:rgba(255,255,255,.96);backdrop-filter:blur(18px);box-shadow:0 14px 40px rgba(15,23,42,.18);font:600 14px system-ui,sans-serif;color:#0f172a;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 3200);
  };

  const createInstallButton = () => {
    if (document.getElementById('pwa-install-button') || isStandalone()) return;
    const b = document.createElement('button');
    b.id = 'pwa-install-button';
    b.type = 'button';
    b.setAttribute('aria-label', 'Install Text to Handwriting app');
    b.innerHTML = '<i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i><span>Install App</span>';
    b.style.cssText = 'position:fixed;right:16px;bottom:18px;z-index:9999;display:flex;align-items:center;gap:8px;padding:12px 16px;border:1px solid rgba(255,255,255,.25);border-radius:16px;background:rgba(2,132,199,.94);color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 12px 34px rgba(2,132,199,.3);cursor:pointer';
    b.onclick = async () => {
      if (!deferredPrompt) {
        if (/iphone|ipad|ipod/i.test(navigator.userAgent)) toast('On iPhone/iPad: tap Share → Add to Home Screen.');
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      b.remove();
    };
    document.body.appendChild(b);
  };

  const showUpdateBanner = registration => {
    if (document.getElementById('pwa-update-banner')) return;
    const b = document.createElement('div');
    b.id = 'pwa-update-banner';
    b.setAttribute('role', 'alert');
    b.innerHTML = '<span><strong>Update ready.</strong> A newer version is available.</span><button id="pwa-update-now" type="button">Update</button>';
    b.style.cssText = 'position:fixed;left:16px;right:16px;bottom:18px;z-index:10000;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid rgba(2,132,199,.18);border-radius:16px;background:rgba(255,255,255,.96);backdrop-filter:blur(18px);box-shadow:0 15px 40px rgba(15,23,42,.18);font:14px system-ui,sans-serif;color:#0f172a';
    document.body.appendChild(b);
    const button = document.getElementById('pwa-update-now');
    button.style.cssText = 'border:0;border-radius:10px;padding:8px 13px;background:#0284c7;color:#fff;font-weight:800';
    button.onclick = () => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => location.reload(), 350);
    };
  };

  const saveDraft = async () => {
    const e = editor();
    if (!e || !window.TTHDocs) return;
    try {
      const docs = window.TTHDocs;
      const existing = await docs.list();
      const current = existing[0];
      await docs.save({
        id: current?.id || 'default',
        title: current?.title || 'Untitled handwriting',
        text: e.innerText || '',
        html: e.innerHTML || '',
        settings: current?.settings || {}
      });
    } catch (error) {
      console.warn('[TTH] IndexedDB autosave failed:', error);
    }
  };

  const restoreDraft = async () => {
    const e = editor();
    if (!e || !window.TTHDocs) return;
    try {
      const docs = window.TTHDocs;
      const existing = await docs.list();
      const current = existing[0];
      if (current?.html && e.textContent.trim().length < 5) {
        e.innerHTML = current.html;
        e.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      // One-time compatibility migration for old localStorage drafts.
      for (const key of LEGACY_DRAFT_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const legacy = JSON.parse(raw);
        if (legacy?.html && e.textContent.trim().length < 5) {
          await docs.save({
            id: current?.id || 'default',
            title: current?.title || 'Untitled handwriting',
            text: legacy.text || e.textContent || '',
            html: legacy.html,
            settings: current?.settings || {}
          });
          e.innerHTML = legacy.html;
          e.dispatchEvent(new Event('input', { bubbles: true }));
          localStorage.removeItem(key);
          toast('Your previous draft was restored.');
        }
        break;
      }
    } catch (error) {
      console.warn('[TTH] draft restore failed:', error);
    }
  };

  const register = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, { scope: APP_SCOPE, updateViaCache: 'none' });
      await registration.update();
      if (registration.waiting) showUpdateBanner(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(registration);
        });
      });
    } catch (error) {
      console.warn('[TTH] PWA registration failed:', error);
    }
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    createInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('pwa-install-button')?.remove();
    toast('Text to Handwriting is installed.');
  });

  window.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadScript(`${APP_SCOPE}offline-storage.js`);
      await loadScript(`${APP_SCOPE}documents.js`);
      await loadScript(`${APP_SCOPE}studio-v2.js?v=5`);
      await loadScript(`${APP_SCOPE}page-history.js?v=3`);
      await restoreDraft();
    } catch (error) {
      console.error('[TTH] local module bootstrap failed:', error);
      toast('Some app features could not be loaded. Please refresh.');
    }

    const e = editor();
    let saveTimer;
    e?.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { void saveDraft(); }, 500);
    });
    window.addEventListener('pagehide', () => { void saveDraft(); });
    setTimeout(createInstallButton, 1200);
  });

  window.addEventListener('load', register);
})();
