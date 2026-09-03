(() => {
  'use strict';
  const ACTIVE_KEY = 'tth-active-document-id';
  let panel = null;
  const editor = () => document.querySelector('.paper-content') || document.getElementById('paper-content');
  const docs = () => window.TTHDocs;
  const activeId = () => { try { return localStorage.getItem(ACTIVE_KEY) || 'default'; } catch (_) { return 'default'; } };
  const setActive = id => { try { localStorage.setItem(ACTIVE_KEY, String(id)); } catch (_) {} };
  const toast = message => {
    let el = document.getElementById('project-manager-toast');
    if (!el) { el = document.createElement('div'); el.id = 'project-manager-toast'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite'); el.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:10100;padding:10px 15px;border-radius:14px;background:#0f172a;color:#fff;font:600 13px system-ui;box-shadow:0 12px 30px #0003'; document.body.appendChild(el); }
    el.textContent = message; el.hidden = false; clearTimeout(el._timer); el._timer = setTimeout(() => { el.hidden = true; }, 2400);
  };
  const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const saveCurrent = async () => {
    const e = editor(), store = docs(); if (!e || !store) return null;
    const id = activeId(); const current = await store.get(id);
    const title = current?.title || ((e.innerText || '').trim().split('\n').find(Boolean)?.slice(0,60) || 'Untitled handwriting');
    return store.save({ id, title, text:e.innerText||'', html:e.innerHTML||'', settings:current?.settings||{} , createdAt:current?.createdAt });
  };
  const loadDocument = async id => {
    const store=docs(), e=editor(); if(!store||!e)return;
    const current=await store.get(id); if(!current)return;
    await saveCurrent(); setActive(id); e.innerHTML=current.html||'';
    e.dispatchEvent(new Event('input',{bubbles:true}));
    window.TTHHandwritingEngine?.refresh?.(); window.TTHPagination?.render?.();
    toast(`Opened: ${current.title}`); render();
  };
  const createProject = async () => {
    await saveCurrent(); const store=docs(); if(!store)return;
    const title=prompt('Project name:', 'Untitled handwriting'); if(title===null)return;
    const id=crypto.randomUUID(); const item=await store.save({id,title:title.trim()||'Untitled handwriting',text:'',html:'',settings:{}});
    setActive(item.id); const e=editor(); if(e){e.innerHTML='';e.dispatchEvent(new Event('input',{bubbles:true}));}
    toast('New project created'); render();
  };
  const rename = async id => { const store=docs(), item=await store.get(id); if(!item)return; const title=prompt('Rename project:',item.title); if(title===null)return; await store.save({...item,title:title.trim()||item.title}); render(); toast('Project renamed'); };
  const duplicate = async id => { const store=docs(), item=await store.get(id); if(!item)return; const copy=await store.save({id:crypto.randomUUID(),title:`${item.title} Copy`,text:item.text,html:item.html,settings:item.settings||{}}); setActive(copy.id); const e=editor(); if(e){e.innerHTML=copy.html||'';e.dispatchEvent(new Event('input',{bubbles:true));} render(); toast('Project duplicated'); };
  const remove = async id => { const store=docs(), list=await store.list(); if(list.length<=1){toast('Keep at least one project.');return;} const item=await store.get(id); if(!item)return; if(!confirm(`Delete “${item.title}”? This cannot be undone.`))return; await store.remove(id); const next=(await store.list())[0]; if(activeId()===String(id)&&next){setActive(next.id);await loadDocument(next.id);} else render(); toast('Project deleted'); };
  const css = `#tth-projects{position:fixed;right:16px;top:82px;z-index:10080;width:min(430px,calc(100vw - 24px));max-height:calc(100vh - 104px);overflow:auto;display:none;padding:15px;background:rgba(255,255,255,.98);border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 24px 70px #0f172a2b;font:13px system-ui;color:#0f172a}#tth-projects.open{display:block}.pm-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.pm-head h3{margin:0;font-size:17px}.pm-head button{border:0;background:#f1f5f9;border-radius:9px;width:32px;height:32px;font-size:20px}.pm-new{width:100%;margin:12px 0;padding:10px 12px;border:0;border-radius:11px;background:#0284c7;color:#fff;font:800 13px system-ui;cursor:pointer}.pm-search{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #cbd5e1;border-radius:11px;outline:none}.pm-list{display:grid;gap:8px;margin-top:10px}.pm-card{padding:11px;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc}.pm-card.active{border-color:#0284c7;background:#eff6ff}.pm-title{font-weight:800;line-height:17px;word-break:break-word}.pm-meta{font-size:10px;color:#64748b;margin-top:3px}.pm-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.pm-actions button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 8px;font:700 11px system-ui;cursor:pointer}.pm-actions .open{background:#0284c7;color:#fff;border-color:#0284c7}.pm-empty{padding:22px 8px;text-align:center;color:#64748b}@media(max-width:639px){#tth-projects{right:8px;top:74px;width:calc(100vw - 16px);max-height:calc(100vh - 88px);border-radius:16px}}`;
  const inject = () => { if(document.getElementById('tth-project-manager-css'))return; const s=document.createElement('style');s.id='tth-project-manager-css';s.textContent=css;document.head.appendChild(s); };
  const render = async () => {
    const store=docs(); if(!store)return;
    if(!panel){ panel=document.createElement('aside'); panel.id='tth-projects'; document.body.appendChild(panel); }
    const list=await store.list();
    panel.innerHTML=`<div class="pm-head"><h3>My Projects <span style="font-size:10px;color:#64748b">${list.length}</span></h3><button id="pm-close" aria-label="Close projects">×</button></div><button class="pm-new" id="pm-new">＋ New Project</button><input class="pm-search" id="pm-search" type="search" placeholder="Search projects…" aria-label="Search projects"><div class="pm-list" id="pm-list"></div>`;
    const listEl=panel.querySelector('#pm-list');
    const draw=filter=>{ const q=(filter||'').trim().toLowerCase(); const items=list.filter(x=>!q||x.title.toLowerCase().includes(q)||x.text.toLowerCase().includes(q)); listEl.innerHTML=items.length?items.map(x=>`<article class="pm-card ${String(x.id)===activeId()?'active':''}"><div class="pm-title">${escape(x.title)}</div><div class="pm-meta">${new Date(x.updatedAt).toLocaleString()} • ${(x.text||'').trim().split(/\s+/).filter(Boolean).length} words</div><div class="pm-actions"><button class="open" data-open="${escape(x.id)}">Open</button><button data-rename="${escape(x.id)}">Rename</button><button data-duplicate="${escape(x.id)}">Duplicate</button><button data-delete="${escape(x.id)}">Delete</button></div></article>`).join(''):'<div class="pm-empty">No projects found.</div>'; };
    draw(''); panel.querySelector('#pm-close').onclick=()=>panel.classList.remove('open'); panel.querySelector('#pm-new').onclick=()=>void createProject(); panel.querySelector('#pm-search').oninput=e=>draw(e.target.value);
    listEl.onclick=e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.open||b.dataset.rename||b.dataset.duplicate||b.dataset.delete;if(!id)return;if(b.dataset.open)void loadDocument(id);else if(b.dataset.rename)void rename(id);else if(b.dataset.duplicate)void duplicate(id);else void remove(id);};
  };
  const boot=()=>{inject();if(document.getElementById('tth-project-toggle'))return;const b=document.createElement('button');b.id='tth-project-toggle';b.type='button';b.textContent='▣ Projects';b.setAttribute('aria-label','Open project manager');b.style.cssText='position:fixed;right:16px;bottom:18px;z-index:10075;border:0;border-radius:14px;padding:11px 14px;background:#0f172a;color:#fff;font:800 13px system-ui;box-shadow:0 10px 30px #0003;cursor:pointer';b.onclick=()=>{const p=document.getElementById('tth-projects');p.classList.toggle('open');if(p.classList.contains('open'))void render();};document.body.appendChild(b);void render();};
  window.TTHProjects={render,saveCurrent,loadDocument,createProject};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();