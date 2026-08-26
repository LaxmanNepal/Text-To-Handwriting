(() => {
  'use strict';
  const show = () => {
    let el = document.getElementById('offline-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'offline-status';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:10040;display:flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid #fed7aa;border-radius:999px;background:rgba(255,247,237,.96);backdrop-filter:blur(12px);box-shadow:0 10px 30px rgba(15,23,42,.14);font:700 12px system-ui;color:#9a3412;pointer-events:none;transition:opacity .2s';
      document.body.appendChild(el);
    }
    el.textContent = navigator.onLine ? '● Online' : '● Offline — your work is saved on this device';
    el.style.opacity = navigator.onLine ? '0' : '1';
  };
  window.addEventListener('online', show);
  window.addEventListener('offline', show);
  window.addEventListener('DOMContentLoaded', show);
})();
