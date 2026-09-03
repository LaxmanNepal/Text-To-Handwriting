(() => {
  'use strict';

  // Phase 2.2: contextual glyph variation.
  // We keep the user's selected font, but repeated characters receive
  // deterministic alternate letterforms through subtle contextual shaping.
  const STYLE_ID = 'tth-handwriting-engine-css';
  const ROOT_CLASS = 'tth-handwriting-rendered';
  const SETTINGS_KEY = 'tth-studio-v3-settings';
  const PROFILES = {
    neat: { name: 'Neat Student', realism: 28, rotation: 1.2, spacing: 0 },
    fast: { name: 'Fast Writing', realism: 72, rotation: 3.8, spacing: -0.25 },
    exam: { name: 'Exam Writing', realism: 48, rotation: 2, spacing: 0.05 },
    casual: { name: 'Casual Notes', realism: 62, rotation: 3, spacing: 0.15 },
    messy: { name: 'Messy Writing', realism: 92, rotation: 5.2, spacing: -0.45 },
    signature: { name: 'Signature Style', realism: 78, rotation: 4.4, spacing: -0.35 }
  };
  let enabled = true, observer = null, raf = 0;

  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const hash = text => { let h=2166136261; for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; };
  const random = seed => { let x=seed>>>0; x^=x<<13;x^=x>>>17;x^=x<<5; return ((x>>>0)%100000)/100000; };

  const ensureStyle=()=>{
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style'); s.id=STYLE_ID;
    s.textContent=`
      .${ROOT_CLASS} .tth-glyph{display:inline-block;transform-origin:50% 85%;will-change:transform,opacity;white-space:pre;position:relative}
      .${ROOT_CLASS} .tth-space{white-space:pre}
      .${ROOT_CLASS} .tth-glyph.v1{font-variation-settings:"wght" 430}
      .${ROOT_CLASS} .tth-glyph.v2{letter-spacing:-.025em}
      .${ROOT_CLASS} .tth-glyph.v3{letter-spacing:.018em}
      .${ROOT_CLASS} .tth-glyph.v4{font-stretch:96%}
    `;
    document.head.appendChild(s);
  };

  const getSettings=()=>{
    let stored={}; try{stored=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{}}catch(_){}
    const source=Object.assign({},stored,window.TTHHandwritingSettings||{});
    const profileKey = source.profile || 'casual';
    const profile = PROFILES[profileKey] || PROFILES.casual;
    return {profile:profileKey,realism:clamp(Number(source.realism??profile.realism),0,100),rotation:clamp(Number(source.rotation??profile.rotation),0,6),opacity:clamp(Number(source.opacity??92),50,100),spacing:Number(source.spacing??profile.spacing),seed:Number(source.seed??1),content:document.querySelector('.paper-content')};
  };

  const skip=el=>!el||el.closest?.('img,button,input,textarea,select,script,style,.tth-glyph,.tth-space');
  const variantFor=(char,seed,amount)=>{
    if(amount<.2) return 0;
    // Only vary common letters; punctuation and numbers remain stable.
    if(!/[A-Za-z]/.test(char)) return 0;
    return Math.floor(random(seed+701)*4)+1;
  };

  const wrap=(node,settings,path)=>{
    const text=node.nodeValue||''; if(!text) return;
    const frag=document.createDocumentFragment(); let pos=0;
    for(const char of text){
      if(char==='\n'){frag.appendChild(document.createElement('br'));pos++;continue;}
      if(char===' '||char==='\t'){const sp=document.createElement('span');sp.className='tth-space';sp.textContent=char;frag.appendChild(sp);pos++;continue;}
      const sp=document.createElement('span'); sp.className='tth-glyph'; sp.textContent=char;
      const seed=hash(`${settings.seed}|${path}|${pos}|${char}`);
      const r1=random(seed),r2=random(seed+101),r3=random(seed+202),r4=random(seed+303);
      const amount=settings.realism/100, variant=variantFor(char,seed,amount);
      if(variant) sp.classList.add('v'+variant);
      const angle=(r1-.5)*settings.rotation*amount*2;
      const y=(r2-.5)*1.8*amount;
      const x=(r4-.5)*.45*amount;
      const sx=1+(r3-.5)*.028*amount;
      const sy=1+(r2-.5)*.045*amount;
      const ink=(r1-.5)*.10*amount;
      const opacity=clamp(settings.opacity/100+ink,.35,1);
      const spacing=settings.spacing+(r2-.5)*.45*amount;
      sp.style.transform=`translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${angle.toFixed(2)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
      sp.style.opacity=opacity.toFixed(3); sp.style.marginRight=`${spacing.toFixed(2)}px`;
      frag.appendChild(sp);pos++;
    }
    node.replaceWith(frag);
  };

  const render=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const settings=getSettings(),content=settings.content;
      if(!enabled||!content||content.dataset.tthRendering==='1')return;
      content.dataset.tthRendering='1';ensureStyle();content.classList.add(ROOT_CLASS);
      const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT),nodes=[];let n;
      while((n=walker.nextNode()))if(!skip(n.parentElement))nodes.push(n);
      nodes.forEach((n,i)=>wrap(n,settings,i));
      delete content.dataset.tthRendering;
    });
  };

  const unwrap=()=>{
    const content=document.querySelector('.paper-content');if(!content)return;
    content.querySelectorAll('.tth-glyph,.tth-space').forEach(sp=>sp.replaceWith(document.createTextNode(sp.textContent||'')));
    content.normalize();content.classList.remove(ROOT_CLASS);
  };
  const refresh=()=>{const c=document.querySelector('.paper-content');if(!c)return;unwrap();render();};
  const setSettings=settings=>{window.TTHHandwritingSettings=Object.assign({},window.TTHHandwritingSettings||{},settings);refresh();};
  const setEnabled=value=>{enabled=Boolean(value);enabled?refresh():unwrap();};

  const boot=()=>{
    window.TTHHandwritingEngine={refresh,setSettings,setEnabled};
    const content=document.querySelector('.paper-content');if(!content)return;
    observer?.disconnect();
    observer=new MutationObserver(ms=>{if(content.dataset.tthRendering==='1')return;if(ms.some(m=>m.type==='childList'||m.type==='characterData'))render();});
    observer.observe(content,{childList:true,subtree:true,characterData:true});
    document.addEventListener('input',e=>{if(e.target?.matches?.('[data-range]'))refresh();},true);
    render();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();