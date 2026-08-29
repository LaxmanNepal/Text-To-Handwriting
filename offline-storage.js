(() => {
  'use strict';

  const DB_NAME = 'tth-documents';
  const DB_VERSION = 2;
  const STORE = 'documents';
  const LEGACY_KEY = 'tth-draft-v2';
  const DEFAULT_ID = 'default';

  let dbPromise;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE)
          ? request.transaction.objectStore(STORE)
          : db.createObjectStore(STORE, { keyPath: 'id' });
        if (!store.indexNames.contains('updatedAt')) store.createIndex('updatedAt', 'updatedAt');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    }).catch(error => {
      dbPromise = null;
      throw error;
    });
    return dbPromise;
  }

  async function withStore(mode, operation) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try { result = operation(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
  }

  async function put(doc) {
    if (!doc || typeof doc !== 'object') throw new TypeError('Document must be an object');
    const now = Date.now();
    const item = {
      id: String(doc.id || DEFAULT_ID),
      title: String(doc.title || 'Untitled handwriting'),
      text: String(doc.text || ''),
      html: String(doc.html || ''),
      settings: doc.settings && typeof doc.settings === 'object' ? doc.settings : {},
      createdAt: Number(doc.createdAt) || now,
      updatedAt: now
    };
    await withStore('readwrite', store => store.put(item));
    return item;
  }

  async function get(id) {
    return withStore('readonly', store => new Promise((resolve, reject) => {
      const request = store.get(String(id));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }));
  }

  async function all() {
    return withStore('readonly', store => new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.updatedAt - a.updatedAt));
      request.onerror = () => reject(request.error);
    }));
  }

  async function remove(id) {
    await withStore('readwrite', store => store.delete(String(id)));
  }

  async function migrateLegacy() {
    try {
      const existing = await all();
      if (existing.length) return false;
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return false;
      const legacy = JSON.parse(raw);
      if (!legacy || typeof legacy !== 'object') return false;
      await put({ id: DEFAULT_ID, title: 'Untitled handwriting', ...legacy });
      return true;
    } catch (error) {
      console.warn('[TTHStorage] Legacy migration failed:', error);
      return false;
    }
  }

  window.TTHStorage = { put, get, all, remove, migrateLegacy };
  window.dispatchEvent(new CustomEvent('tth-storage-ready'));
  document.addEventListener('DOMContentLoaded', () => { void migrateLegacy(); });
})();
