(() => {
  'use strict';
  const DB_NAME = 'tth-documents';
  const DB_VERSION = 1;
  const STORE = 'documents';
  const LEGACY_KEY = 'tth-draft-v2';

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function put(doc) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...doc, updatedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function get(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function all() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a,b) => b.updatedAt - a.updatedAt));
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function migrateLegacy() {
    try {
      const existing = await all();
      if (existing.length) return;
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const legacy = JSON.parse(raw);
      if (legacy && typeof legacy === 'object') {
        await put({ id: 'default', title: 'Untitled handwriting', ...legacy });
      }
    } catch (_) {}
  }

  window.TTHStorage = { put, get, all, remove, migrateLegacy };
  document.addEventListener('DOMContentLoaded', () => migrateLegacy());
})();
