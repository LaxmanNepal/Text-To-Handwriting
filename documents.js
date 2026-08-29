/* Compatibility facade: TTHStorage is the single document store. */
(() => {
  'use strict';
  const waitForStorage = () => new Promise(resolve => {
    if (window.TTHStorage) return resolve(window.TTHStorage);
    window.addEventListener('tth-storage-ready', () => resolve(window.TTHStorage), { once: true });
    setTimeout(() => resolve(window.TTHStorage), 2000);
  });

  window.TTHDocs = {
    async save(doc = {}) {
      const storage = await waitForStorage();
      return storage.put({
        ...doc,
        id: doc.id || crypto.randomUUID(),
        title: doc.title || 'Untitled handwriting',
        text: doc.text || '',
        html: doc.html || '',
        settings: doc.settings || {}
      });
    },
    async list() { return (await waitForStorage()).all(); },
    async get(id) { return (await waitForStorage()).get(id); },
    async remove(id) { return (await waitForStorage()).remove(id); }
  };
})();
