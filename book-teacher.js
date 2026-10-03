(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function load(){
  const host=$('#bookInteractionAnalytics');if(!host)return;
  host.innerHTML='<div class="teacher-card wide-card">جارٍ تحميل تحليلات الكتاب التفاعلي...</div>';
  try{
    const data=await TamakkunAPI.request('teacher_learning_analytics');
    const ev=data.events||[];
    if(!ev.length){host.innerHTML='<div class="teacher-card wide-card">لا توجد تفاعلات مسجلة بعد.</div>';return}
    const byLesson={};
    for(const e of ev){
      const code=e.lesson?.code||'—',x=byLesson[code]||(byLesson[code]={title:e.lesson?.title||code,starts:0,activities:0,mastered:0,support:0,scores:[],students:new Set()});
      if(e.student_id)x.students.add(e.student_id);
      if(e.event_type==='lesson_open')x.starts++;
      if(e.event_type==='activity_complete')x.activities++;
      if(e.event_type==='lesson_mastered')x.mastered++;
      if(e.event_type==='lesson_support_needed')x.support++;
      if(Number.isFinite(e.score))x.scores.push(e.score);
    }
    host.innerHTML=Object.entries(byLesson).sort((a,b)=>b[1].starts-a[1].starts).map(([code,x])=>{
      const avg=x.scores.length?Math.round(x.scores.reduce((a,b)=>a+b,0)/x.scores.length):null;
      return '<article class="analytics-card"><div><span class="eyebrow">'+esc(code)+' • '+x.students.size+' طلاب</span><h3>'+esc(x.title)+'</h3></div><strong>'+(avg===null?'—':avg+'%')+'</strong><div class="analytics-levels"><span>بدأ <b>'+x.starts+'</b></span><span>أنشطة <b>'+x.activities+'</b></span><span>إتقان <b>'+x.mastered+'</b></span><span>دعم <b>'+x.support+'</b></span></div><p>'+(x.support>x.mastered?'يحتاج مراجعة الأنشطة العلاجية':'التفاعل مستقر')+'</p></article>';
    }).join('');
  }catch(e){host.innerHTML='<div class="teacher-card wide-card">تعذر تحميل تحليلات التفاعل.</div>'}
}
$('#refreshBookAnalytics')?.addEventListener('click',load);
document.querySelector('[data-tview="analytics"]')?.addEventListener('click',()=>setTimeout(load,0));
window.TamakkunBookAnalytics={load};
})();