/* Presentation-only controls. Authentication and data remain in the existing API. */
(()=>{'use strict';
  document.querySelectorAll('.tk-password-toggle').forEach(button=>{
    button.addEventListener('click',()=>{
      const input=document.getElementById(button.getAttribute('aria-controls'));
      if(!input)return;
      const visible=input.type==='password';
      input.type=visible?'text':'password';
      button.textContent=visible?'إخفاء':'إظهار';
      button.setAttribute('aria-pressed',String(visible));
    });
  });
  document.querySelectorAll('[data-tk-view]').forEach(button=>{
    button.addEventListener('click',()=>{
      if(typeof window.switchView==='function')window.switchView(button.dataset.tkView);
    });
  });
  const ring=document.getElementById('homeRing'),ringText=document.getElementById('homeRingText');
  if(ring&&ringText){
    const updateRing=()=>{
      const value=Math.max(0,Math.min(100,parseFloat(ringText.textContent)||0));
      ring.style.background='conic-gradient(#fff '+value+'%,rgba(255,255,255,.18) 0)';
      ring.setAttribute('role','progressbar');
      ring.setAttribute('aria-label','متوسط الإتقان');
      ring.setAttribute('aria-valuemin','0');ring.setAttribute('aria-valuemax','100');
      ring.setAttribute('aria-valuenow',String(value));
    };
    new MutationObserver(updateRing).observe(ringText,{childList:true,characterData:true,subtree:true});
    updateRing();
  }
  const sidebar=document.getElementById('sidebar'),menu=document.getElementById('menuBtn');
  if(!sidebar||!menu)return;
  const backdrop=document.createElement('button');
  backdrop.type='button';backdrop.className='tk-menu-backdrop';
  backdrop.setAttribute('aria-label','إغلاق قائمة الطالب');
  backdrop.tabIndex=-1;document.body.append(backdrop);
  const close=document.createElement('button');
  close.type='button';close.className='tk-side-close';close.textContent='×';
  close.setAttribute('aria-label','إغلاق القائمة');sidebar.prepend(close);
  const compact=window.matchMedia('(max-width:1050px)');
  const sync=()=>{
    const opened=compact.matches&&sidebar.classList.contains('open');
    backdrop.classList.toggle('is-open',opened);
    menu.setAttribute('aria-expanded',String(opened));
    sidebar.inert=compact.matches&&!opened;
  };
  const dismiss=(restoreFocus=false)=>{
    sidebar.classList.remove('open');sync();
    if(restoreFocus)menu.focus();
  };
  new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});
  menu.addEventListener('click',()=>{sync();if(sidebar.classList.contains('open'))close.focus();});
  close.addEventListener('click',()=>dismiss(true));
  backdrop.addEventListener('click',()=>dismiss(true));
  sidebar.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>dismiss(true)));
  document.addEventListener('keydown',event=>{
    if(!compact.matches||!sidebar.classList.contains('open'))return;
    if(event.key==='Escape'){dismiss(true);return;}
    if(event.key==='Tab'){
      const focusable=[...sidebar.querySelectorAll('button,a[href],input')].filter(el=>!el.disabled);
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  compact.addEventListener('change',()=>dismiss());sync();
})();
