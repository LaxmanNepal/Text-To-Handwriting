(() => {
  'use strict';
  const toast = m => window.TTHToast ? window.TTHToast(m) : (() => { const e=document.createElement('div'); e.textContent=m; e.style.cssText='position:fixed;bottom:20px;left:16px;right:16px;z-index:10050;padding:12px 16px;border-radius:14px;background:#0f172a;color:#fff;text-align:center;font:600 14px system-ui';document.body.appendChild(e);setTimeout(()=>e.remove(),2800) })();
  const settings = () => window.TTHPagination?.getSettings?.() || {size:'A4',margin:18,showNumbers:true,preview:true};
  const size = () => (window.TTHPagination?.getSizes?.() || {A4:{width:'210mm',height:'297mm'},Letter:{width:'8.5in',height:'11in'}})[settings().size] || {width:'210mm',height:'297mm'};
  const ensurePreview = () => { window.TTHPagination?.enablePreview?.(); return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); };
  const filename = ext => { const text=(document.querySelector('.paper-content')?.innerText||'').trim().split(/\s+/).slice(0,5).join('-').replace(/[^a-z0-9_-]/gi,'') || 'handwriting'; return `${text}.${ext}`; };
  const exportPDF = async () => {
    if(!window.html2canvas || !window.jspdf?.jsPDF){ toast('PDF export library is not available.'); return; }
    const old=document.getElementById('tth-pagination-preview');
    if(!old){ toast('Pagination is not ready yet.'); return; }
    await ensurePreview();
    const pages=[...document.querySelectorAll('#tth-preview-pages .tth-preview-page')];
    if(!pages.length){toast('No content to export.');return;}
    const z=size(), name=filename('pdf');
    const host=old, previous={position:host.style.position,left:host.style.left,top:host.style.top,width:host.style.width,display:host.style.display};
    host.style.position='fixed';host.style.left='-10000px';host.style.top='0';host.style.width=z.width;host.style.display='block';
    pages.forEach(p=>{p.style.width=z.width;p.style.height=z.height;p.style.maxWidth='none';});
    try{
      const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:'p',unit:'mm',format:settings().size==='Letter'?'letter':'a4',compress:true});
      for(let i=0;i<pages.length;i++){
        const canvas=await window.html2canvas(pages[i],{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});
        if(i)pdf.addPage();
        const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight();
        pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',0,0,w,h,undefined,'FAST');
      }
      pdf.save(name);toast(`PDF exported: ${pages.length} page${pages.length===1?'':'s'}.`);
    }catch(e){console.error('[TTH] PDF export failed',e);toast('PDF export failed. Please try again.');}
    finally{host.style.position=previous.position;host.style.left=previous.left;host.style.top=previous.top;host.style.width=previous.width;host.style.display=previous.display;pages.forEach(p=>{p.style.width='';p.style.height='';p.style.maxWidth='';});}
  };
  const print = async () => { await ensurePreview(); const host=document.getElementById('tth-pagination-preview'); if(!host)return; host.classList.add('is-visible'); setTimeout(()=>window.print(),100); };
  const installUI = () => {
    if(document.getElementById('tth-export-panel'))return;
    const anchor=document.getElementById('output-section') || document.getElementById('customization-section') || document.getElementById('paper-section'); if(!anchor)return;
    const panel=document.createElement('div'); panel.id='tth-export-panel'; panel.style.cssText='margin-top:12px;padding:14px;border:1px solid rgba(148,163,184,.25);border-radius:16px;background:rgba(255,255,255,.9);box-shadow:0 8px 24px rgba(15,23,42,.06)';
    panel.innerHTML='<div style="font:700 13px system-ui;margin-bottom:10px;color:#0f172a"><i class="fa-solid fa-file-export"></i> Multi-page Export</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="tth-export-pdf" type="button" style="padding:9px 12px;border:0;border-radius:10px;background:#0284c7;color:#fff;font:700 12px system-ui;cursor:pointer"><i class="fa-solid fa-file-pdf"></i> Download PDF</button><button id="tth-print-pages" type="button" style="padding:9px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;font:700 12px system-ui;cursor:pointer"><i class="fa-solid fa-print"></i> Print Pages</button></div><div style="margin-top:8px;font:500 11px system-ui;color:#64748b">Exports the paginated A4/Letter preview without modifying your editable document.</div>';
    anchor.appendChild(panel); document.getElementById('tth-export-pdf').onclick=exportPDF; document.getElementById('tth-print-pages').onclick=print;
  };
  const boot=()=>{installUI();window.TTHExport={exportPDF,print};};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
