(() => {
  'use strict';
  const DB_NAME = 'tth-documents-v1';
  const STORE = 'documents';
  const open = () => new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'id'});s.createIndex('updatedAt','updatedAt')}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const tx = async (mode, fn) => {const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(STORE,mode);const s=t.objectStore(STORE);let result;try{result=fn(s)}catch(e){reject(e);return}t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error)})};
  window.TTHDocs = {
    async save(doc){const now=Date.now();const item={id:doc.id||crypto.randomUUID(),title:doc.title||'Untitled handwriting',text:doc.text||'',html:doc.html||'',settings:doc.settings||{},createdAt:doc.createdAt||now,updatedAt:now};await tx('readwrite',s=>s.put(item));return item},
    async list(){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).index('updatedAt').getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.updatedAt-a.updatedAt));r.onerror=()=>reject(r.error)})},
    async get(id){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})},
    async remove(id){await tx('readwrite',s=>s.delete(id))}
  };
})();
