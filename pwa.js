(() => {
  const SW_URL = '/Text-To-Handwriting/sw.js';
  let deferredPrompt = null;

  const createInstallButton = () => {
    if (document.getElementById('pwa-install-button')) return;
    const button = document.createElement('button');
    button.id = 'pwa-install-button';
    button.type = 'button';
    button.innerHTML = '<i class="fa-solid fa-download"></i><span>Install App</span>';
    button.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;display:none;align-items:center;gap:8px;padding:12px 16px;border:0;border-radius:14px;background:#0284c7;color:#fff;font:600 14px system-ui,sans-serif;box-shadow:0 10px 30px rgba(2,132,199,.35);cursor:pointer;';
    button.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      button.style.display = 'none';
    });
    document.body.appendChild(button);
  };

  const showUpdateBanner = registration => {
    if (document.getElementById('pwa-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = '<span><strong>New version available.</strong> Refresh to use the latest app.</span><button id="pwa-update-now">Refresh</button>';
    banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:10000;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid rgba(2,132,199,.25);border-radius:16px;background:rgba(255,255,255,.96);backdrop-filter:blur(16px);box-shadow:0 15px 40px rgba(15,23,42,.18);font:14px system-ui,sans-serif;color:#0f172a;';
    document.body.appendChild(banner);
    document.getElementById('pwa-update-now').style.cssText = 'border:0;border-radius:10px;padding:8px 12px;background:#0284c7;color:#fff;font-weight:700;cursor:pointer;';
    document.getElementById('pwa-update-now').onclick = () => {
      registration.waiting?.postMessage('SKIP_WAITING');
      window.location.reload();
    };
  };

  const register = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {scope: '/Text-To-Handwriting/'});
      if (registration.waiting) showUpdateBanner(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(registration);
        });
      });
    } catch (error) {
      console.warn('PWA service worker registration failed:', error);
    }
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    createInstallButton();
    document.getElementById('pwa-install-button').style.display = 'flex';
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('pwa-install-button')?.remove();
  });

  window.addEventListener('load', register);
})();
