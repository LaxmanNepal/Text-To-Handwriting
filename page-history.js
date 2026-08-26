(() => {
  'use strict';
  const KEY = 'tth-generated-pages-v1';
  const MAX = 20;
  const load = () => { try { const x = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(x) ? x : []; } catch (_) { return []; } };
  const save = pages => localStorage.setItem(KEY, JSON.stringify(pages.slice(0, MAX)));
  const getPaper = () => document.getElementById('paper-sheet');
  const getContent = () => document.getElementById('paper-content');
  const cleanClone = el => { const c = el.cloneNode(true); c.querySelectorAll('[contenteditable]').forEach(x => x.removeAttribute('contenteditable')); c.querySelectorAll('button,input,textarea,select').forEach(x => x.remove()); return c.outerHTML; };
  const snapshot = () => {
    const paper = getPaper(), content = getContent();
    if (!paper || !content || !content.textContent.trim()) return;
    const pages = load();
    pages.unshift({ id: Date.now(), html: content.innerHTML, paper: cleanClone(paper), text: content.textContent.trim().slice(0, 160), createdAt: new Date().toISOString() });
    save(pages);
    render();
    toast('Page saved — newest page is first');
  };
  const toast = msg => { let t = document.getElementById('page-history-toast'); if (!t) { t=document.createElement('div'); t.id='page-history-toast'; t.style.cssText='position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:10070;padding:9px 13px;border-radius:12px;background:#0f172a;color:#fff;font:700 12px system-ui;box-shadow:0 10px 30px #0003'; document.body.appendChild(t); } t.textContent=msg; t.hidden=false; clearTimeout(t._x); t._x=setTimeout(()=>t.hidden=true,2200); };
  const restore = id => { const page=load().find(x=>x.id===id); const c=getContent(); if(!page||!c)return; c.innerHTML=page.html; c.dispatchEvent(new Event('input',{bubbles:true})); toast('Page restored'); window.scrollTo({top:0,behavior:'smooth'}); };
  const remove = id => { save(load().filter(x=>x.id!==id)); render(); };
  const render = () => {
    let panel=document.getElementById('page-history');
    if (!panel) { panel=document.createElement('section'); panel.id='page-history'; document.body.appendChild(panel); }
    const pages=load();
    panel.innerHTML=`<div class="ph-head"><div><strong>Generated Pages</strong><span>${pages.length}/${MAX}</span></div><button id="ph-close" aria-label="Close">×</button></div>${pages.length?`<div class="ph-list">${pages.map((p,i)=>`<article class="ph-card" data-id="${p.id}"><div class="ph-thumb">${p.paper||''}<div class="ph-label">${i===0?'NEW':'Page '+(pages.length-i)}</div></div><div class="ph-meta"><strong>${p.text.replace(/[<>]/g,'')}</strong><small>${new Date(p.createdAt).toLocaleString()}</small><div><button data-open="${p.id}">Open</button><button data-delete="${p.id}">Delete</button></div></div></article>`).join('')}</div>`:'<div class="ph-empty">Generate a page to see it here. Newest pages appear first.</div>'}`;
    panel.querySelector('#ph-close').onclick=()=>panel.classList.remove('open');
    panel.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>restore(Number(b.dataset.open)));
    panel.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>remove(Number(b.dataset.delete)));
  };
  const inject = () => { if(document.getElementById('page-history-style'))return; const s=document.createElement('style');s.id='page-history-style';s.textContent=`#page-history{position:fixed;right:16px;top:82px;z-index:10060;width:min(430px,calc(100vw - 24px));max-height:calc(100vh - 104px);overflow:auto;padding:14px;background:rgba(255,255,255,.97);border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 24px 70px #0f172a2b;font:13px system-ui;color:#0f172a;display:none}#page-history.open{display:block}.ph-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.ph-head>div{display:flex;gap:8px;align-items:center}.ph-head span{font-size:10px;color:#64748b}.ph-head button{border:0;background:#f1f5f9;border-radius:9px;width:30px;height:30px;font-size:20px}.ph-list{display:grid;gap:9px}.ph-card{display:grid;grid-template-columns:88px 1fr;gap:10px;padding:8px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}.ph-thumb{height:112px;position:relative;overflow:hidden;background:#f8f8f5;border-radius:7px;border:1px solid #dbe1e8;padding:8px;font-size:5px;line-height:8px}.ph-thumb .paper-margin-line{transform:scale(.35);transform-origin:top left}.ph-label{position:absolute;top:4px;right:4px;padding:2px 5px;border-radius:5px;background:#0284c7;color:white;font-size:8px;font-weight:800}.ph-meta{min-width:0;display:flex;flex-direction:column;gap:5px}.ph-meta strong{font-size:12px;line-height:16px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.ph-meta small{font-size:10px;color:#64748b}.ph-meta div{display:flex;gap:6px;margin-top:auto}.ph-meta button{border:1px solid #cbd5e1;background:white;border-radius:8px;padding:6px 9px;font-size:11px;font-weight:700}.ph-empty{text-align:center;color:#64748b;padding:24px 10px}@media(max-width:639px){#page-history{right:8px;top:74px;width:calc(100vw - 16px);max-height:calc(100vh - 88px);border-radius:16px}.ph-card{grid-template-columns:76px 1fr}.ph-thumb{height:100px}}`;
    document.head.appendChild(s);
  };
  const addButton = () => { if(document.getElementById('page-history-toggle'))return; const b=document.createElement('button'); b.id='page-history-toggle';b.type='button';b.innerHTML='▣ <span>Pages</span>';b.style.cssText='position:fixed;right:16px;bottom:18px;z-index:10055;border:0;border-radius:14px;padding:11px 14px;background:#0f172a;color:#fff;font:800 13px system-ui;box-shadow:0 10px 30px #0003';b.onclick=()=>{const p=document.getElementById('page-history');p.classList.toggle('open');render()};document.body.appendChild(b); };
  document.addEventListener('click', e => { const b=e.target.closest('button,a'); if(!b)return; const label=(b.innerText||b.getAttribute('aria-label')||b.title||'').trim().toLowerCase(); if(/generate|create page|new page/.test(label)){setTimeout(snapshot,350);} });
  window.TTHPageHistory={snapshot,load,render};
  const boot=()=>{inject();addButton();render()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
