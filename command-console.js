(()=>{'use strict';
const ENDPOINT='https://txvhzcrtqrbbyqqmkusr.supabase.co/functions/v1/tamakkun-command';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const session=window.TamakkunAPI?.getSession();
async function call(payload){
  if(!session?.token)throw new Error('unauthorized');
  const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.token},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({error:'invalid_response'}));
  if(!res.ok){const e=new Error(data.error||'command_failed');e.data=data;throw e}
  return data;
}
function uid(){
  if(crypto?.randomUUID)return crypto.randomUUID();
  return Date.now()+'-'+Math.random().toString(16).slice(2);
}
const labels={
  'lesson.set_published':'حالة نشر درس',
  'lesson.set_mastery_threshold':'حد الإتقان',
  'student.set_active':'حالة حساب طالب',
  'account.revoke_sessions':'تسجيل خروج الطالب',
  'student.assign_intervention':'إسناد تدخل تعليمي',
  'system.smoke_test':'فحص النظام'
};
const errors={
  unrecognized_command:'الأمر غير معروف. استخدم أحد الأمثلة المقترحة.',
  lesson_not_found:'لم يتم العثور على الدرس.',
  lesson_ambiguous:'اسم الدرس غير محدد بما يكفي.',
  student_not_found:'لم يتم العثور على الطالب.',
  invalid_mastery_threshold:'حد الإتقان يجب أن يكون بين 50 و100.',
  rollback_not_supported:'هذا النوع من الأوامر لا يدعم التراجع.',
  command_not_rollbackable:'لا يمكن التراجع عن هذا الأمر في حالته الحالية.',
  forbidden:'ليست لديك صلاحية لتنفيذ هذا الأمر.',
  unauthorized:'انتهت الجلسة. سجل الدخول من جديد.'
};
function statusText(s){return ({queued:'بالانتظار',running:'قيد التنفيذ',succeeded:'تم',failed:'فشل',rolled_back:'تم التراجع'}[s]||s)}
function renderResult(data){
  const box=$('#commandResult'); if(!box)return;
  const c=data.command||data;
  box.className='ops-result '+(c.status==='failed'?'error':'success');
  box.innerHTML='<div><span>الحالة</span><strong>'+esc(statusText(c.status||'succeeded'))+'</strong></div>'+
    '<div><span>نوع العملية</span><strong>'+esc(labels[c.command_type]||c.command_type||'أمر مباشر')+'</strong></div>'+
    '<div><span>رقم العملية</span><code>'+esc(c.id||c.command_id||'—')+'</code></div>'+
    (c.result?'<pre>'+esc(JSON.stringify(c.result,null,2))+'</pre>':'');
}
async function refresh(){
  const host=$('#commandLog'); if(!host)return;
  host.innerHTML='<div class="ops-loading">جارٍ تحميل سجل التنفيذ...</div>';
  try{
    const data=await call({action:'logs',limit:30});
    const rows=data.commands||[];
    if(!rows.length){host.innerHTML='<div class="ops-empty">لا توجد أوامر منفذة بعد.</div>';return}
    host.innerHTML=rows.map(c=>'<article class="ops-row">'+
      '<div class="ops-main"><span class="ops-status '+esc(c.status)+'">'+esc(statusText(c.status))+'</span><div><b>'+esc(c.raw_command||labels[c.command_type]||c.command_type)+'</b><small>'+new Date(c.created_at).toLocaleString('ar-SA')+'</small></div></div>'+
      '<div class="ops-log-actions"><code>'+esc((c.id||'').slice(0,8))+'</code>'+
      (c.status==='succeeded'&&['lesson.set_published','lesson.set_mastery_threshold','student.set_active','student.assign_intervention'].includes(c.command_type)?'<button data-rollback="'+esc(c.id)+'">تراجع</button>':'')+
      '</div></article>').join('');
    host.querySelectorAll('[data-rollback]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('هل تريد التراجع عن هذه العملية؟'))return;
      b.disabled=true;
      try{const out=await call({action:'rollback',command_id:b.dataset.rollback});renderResult(out);await refresh()}
      catch(e){alert(errors[e.message]||'تعذر التراجع عن العملية.')}
      finally{b.disabled=false}
    }));
  }catch(e){host.innerHTML='<div class="ops-empty error">تعذر تحميل سجل التنفيذ.</div>'}
}
async function submitCommand(raw){
  const input=$('#commandInput'),btn=$('#runCommandBtn'),msg=$('#commandMessage');
  btn.disabled=true;msg.textContent='جارٍ التنفيذ المباشر...';
  try{
    const out=await call({action:'execute',command:raw,idempotency_key:uid()});
    renderResult(out);msg.textContent='تم تنفيذ الأمر وحفظه في سجل العمليات ✓';
    if(input)input.value='';
    await refresh();
    window.dispatchEvent(new CustomEvent('tamakkun:command-complete',{detail:out}));
  }catch(e){
    msg.textContent=errors[e.message]||('تعذر التنفيذ: '+e.message);
    if(e.data?.supported_examples)$('#commandExamples').innerHTML=e.data.supported_examples.map(x=>'<button type="button">'+esc(x)+'</button>').join('');
  }finally{btn.disabled=false}
}
$('#commandForm')?.addEventListener('submit',e=>{e.preventDefault();const raw=$('#commandInput').value.trim();if(raw)submitCommand(raw)});
$('#commandExamples')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$('#commandInput').value=b.textContent;$('#commandInput').focus()});
$('#refreshCommands')?.addEventListener('click',refresh);
document.querySelector('[data-tview="commands"]')?.addEventListener('click',()=>{setTimeout(refresh,0)});
window.addEventListener('tamakkun:command-complete',()=>{if(typeof window.syncTeacherData==='function')window.syncTeacherData()});
window.TamakkunCommandConsole={refresh,call};
})();