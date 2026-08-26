(() => {
  const APP_SCOPE = '/Text-To-Handwriting/';
  const SW_URL = `${APP_SCOPE}sw.js`;
  const DRAFT_KEY = 'tth-draft-v2';
  let deferredPrompt = null;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  const toast = (message) => {
    let el = document.getElementById('pwa-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pwa-toast';
      el.style.cssText = 'position:fixed;left:16px;right:16px;bottom:18px;z-index:10001;display:none;padding:12px 16px;border:1px solid rgba(2,132,199,.18);border-radius:16px;background:rgba(255,255,255,.94);backdrop-filter:blur(18px);box-shadow:0 14px 40px rgba(15,23,42,.18);font:600 14px system-ui,sans-serif;color:#0f172a;text-align:center;';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 3200);
  };

  const createInstallButton = () => {
    if (document.getElementById('pwa-install-button') || isStandalone()) return;
    const button = document.createElement('button');
    button.id = 'pwa-install-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Install Text to Handwriting app');
    button.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i><span>Install App</span>';
    button.style.cssText = 'position:fixed;right:16px;bottom:18px;z-index:9999;display:flex;align-items:center;gap:8px;padding:12px 16px;border:1px solid rgba(255,255,255,.25);border-radius:16px;background:rgba(2,132,199,.94);color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 12px 34px rgba(2,132,199,.3);cursor:pointer;backdrop-filter:blur(14px);';
    button.addEventListener('click', async () => {
      if (!deferredPrompt) {
        if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
          toast('On iPhone/iPad: tap Share → Add to Home Screen.');
        }
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      button.remove();
    });
    document.body.appendChild(button);
  };

  const showUpdateBanner = registration => {
    if (document.getElementById('pwa-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = '<span><strong>Update ready.</strong> Your handwriting app has a newer version.</span><button id="pwa-update-now" type="button">Update</button>';
    banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:18px;z-index:10000;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid rgba(2,132,199,.18);border-radius:16px;background:rgba(255,255,255,.96);backdrop-filter:blur(18px);box-shadow:0 15px 40px rgba(15,23,42,.18);font:14px system-ui,sans-serif;color:#0f172a;';
    document.body.appendChild(banner);
    const update = document.getElementById('pwa-update-now');
    update.style.cssText = 'border:0;border-radius:10px;padding:8px 13px;background:#0284c7;color:#fff;font-weight:800;cursor:pointer;';
    update.onclick = () => {
      registration.waiting?.postMessage({type:'SKIP_WAITING'});
      setTimeout(() => window.location.reload(), 250);
    };
  };

  const saveDraft = () => {
    const editor = document.getElementById('paper-content');
    if (!editor) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({html: editor.innerHTML, savedAt: Date.now()}));
    } catch (_) {}
  };

  const restoreDraft = () => {
    const editor = document.getElementById('paper-content');
    if (!editor) return;
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (draft?.html && editor.textContent.trim().length < 5) {
        editor.innerHTML = draft.html;
        editor.dispatchEvent(new Event('input', {bubbles:true}));
        toast('Your previous draft was restored.');
      }
    } catch (_) {}
  };

  const register = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {scope: APP_SCOPE, updateViaCache: 'none'});
      registration.update();
      if (registration.waiting) showUpdateBanner(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(registration);
        });
      });
    } catch (error) {
      console.warn('PWA registration failed:', error);
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

  window.addEventListener('DOMContentLoaded', () => {
    restoreDraft();
    const editor = document.getElementById('paper-content');
    editor?.addEventListener('input', saveDraft);
    window.addEventListener('beforeunload', saveDraft);
    setTimeout(createInstallButton, 1200);
  });

  window.addEventListener('load', register);
})();
