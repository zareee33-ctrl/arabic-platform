
const views = [...document.querySelectorAll('.view')];
const navItems = [...document.querySelectorAll('.nav-item')];
const titles = {
  home:'مرحبًا بك في رحلة العربية',
  units:'الوحدات والدروس',
  progress:'تقدمي',
  review:'مراجعة أخطائي',
  lesson:'اسم الفاعل'
};
function switchView(id){
  views.forEach(v=>v.classList.toggle('active-view',v.id===id));
  navItems.forEach(n=>n.classList.toggle('active',n.dataset.view===id));
  document.getElementById('pageTitle').textContent=titles[id]||'منصة العربية';
  window.scrollTo({top:0,behavior:'smooth'});
}
function openLesson(){ switchView('lesson'); }
window.switchView=switchView; window.openLesson=openLesson;

navItems.forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));

document.querySelectorAll('.choices').forEach(group=>{
  group.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const correct=group.dataset.correct;
      const feedback=group.parentElement.querySelector('.feedback');
      group.querySelectorAll('button').forEach(b=>b.classList.remove('correct','wrong'));
      if(btn.textContent.trim()===correct){
        btn.classList.add('correct');
        feedback.textContent='أحسنت! فهمت هذه النقطة. ✓';
        feedback.style.color='#1f7a5a';
      } else {
        btn.classList.add('wrong');
        feedback.textContent='ليست الإجابة الصحيحة. ارجع للمثال ثم حاول مرة أخرى.';
        feedback.style.color='#b14b4b';
      }
    });
  });
});

document.getElementById('masteryBtn').addEventListener('click',()=>{
  const t=document.getElementById('toast');
  t.textContent='في النسخة الكاملة يفتح اختبار الإتقان بعد إنهاء جميع نقاط الدرس.';
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3300);
});

document.getElementById('menuBtn').addEventListener('click',()=>{
  document.getElementById('sidebar').classList.toggle('open');
});
