(()=>{'use strict';
const D=window.TAMAKKUN_DATA;
const LS={progress:'tamakkun_progress_v1',submissions:'tamakkun_submissions_v1'};
const state={lesson:null,answers:{},kwl:{},fileData:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const load=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback))}catch{return fallback}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const progress=()=>load(LS.progress,{});
const submissions=()=>load(LS.submissions,[]);
const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)};
const titles={home:'مرحبًا بك في لغتي',journey:'رحلة الدرس',papers:'أعمالي الورقية',results:'نتائجي'};
window.switchView=id=>{ $$('.view').forEach(v=>v.classList.toggle('active-view',v.id===id)); $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===id)); $('#pageTitle').textContent=titles[id]||'مِنَصَّةُ تَمَكُّن'; window.scrollTo({top:0,behavior:'smooth'}); if(id==='papers')renderSubmissions(); if(id==='results')renderResults(); };
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));

function saveKwl(){
  if(!state.lesson)return;
  const p=progress(), code=state.lesson.code;
  p[code]=p[code]||{code,title:state.lesson.title,startedAt:new Date().toISOString()};
  p[code].kwl={k:$('#kwlK')?.value||'',w:$('#kwlW')?.value||'',l:$('#kwlL')?.value||''};
  save(LS.progress,p);
}
function openLesson(code){
  code=String(code||'').trim().toUpperCase();
  const lesson=D.lessons[code];
  if(!lesson){$('#codeFeedback').textContent='الكود غير موجود. تأكد منه ثم حاول مرة أخرى.';return;}
  state.lesson=lesson;state.answers={};
  const p=progress();p[code]=p[code]||{code,title:lesson.title,startedAt:new Date().toISOString(),status:'in_progress'};save(LS.progress,p);
  renderJourney(lesson,p[code]);updateStats();switchView('journey');
}
window.openLesson=openLesson;

$('#lessonCodeForm').addEventListener('submit',e=>{e.preventDefault();openLesson($('#lessonCodeInput').value)});
$$('[data-demo-code]').forEach(b=>b.addEventListener('click',()=>openLesson(b.dataset.demoCode)));

function optionButtons(options,group,correct,hint){
  return '<div class="interactive-options" data-group="'+group+'" data-correct="'+esc(correct)+'" data-hint="'+esc(hint||'')+'">'+options.map(o=>'<button type="button" data-value="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><div class="activity-feedback" id="fb-'+group+'"></div>';
}
function renderJourney(l,record){
  $('#journeyEmpty').hidden=true;$('#lessonJourney').hidden=false;
  const kwl=record.kwl||{};
  $('#lessonJourney').innerHTML=`
    <div class="lesson-topline"><div><span class="eyebrow">${esc(l.unit)} • ${esc(l.type)}</span><h2>${esc(l.title)}</h2><p>${esc(l.goal)}</p></div><div class="lesson-code-badge">${esc(l.code)}</div></div>
    <div class="journey-steps">
      <span class="active">K أعرف</span><span>W أريد</span><span>أكتشف</span><span>أطبّق</span><span>أتقن</span><span>L تعلمت</span>
    </div>
    <article class="card kwl-card"><div class="card-title"><span>K</span><div><small>قبل الشرح</small><h3>ماذا أعرف؟</h3></div></div><p>اكتب فكرة واحدة تعرفها مسبقًا عن الدرس، أو ما تتوقعه.</p><textarea id="kwlK" placeholder="أعرف أن...">${esc(kwl.k||'')}</textarea></article>
    <article class="card kwl-card"><div class="card-title"><span>W</span><div><small>هدفك الشخصي</small><h3>ماذا أريد أن أعرف؟</h3></div></div><div class="want-grid">${l.wants.map(w=>'<button type="button" class="want-btn">'+esc(w)+'</button>').join('')}</div><textarea id="kwlW" placeholder="أريد أن أعرف...">${esc(kwl.w||'')}</textarea></article>
    <article class="card discovery-card"><div class="card-title"><span>◉</span><div><small>اكتشف بنفسك</small><h3>لاحظ الجملة</h3></div></div><div class="scene-box"><strong>${esc(l.discovery.scene)}</strong><p>${esc(l.discovery.prompt)}</p></div>${optionButtons(l.discovery.options,'discovery',l.discovery.correct,l.discovery.hint)}</article>
    <article class="card concept-card"><div class="card-title"><span>≡</span><div><small>بعد الاكتشاف</small><h3>الخلاصة</h3></div></div><div class="rule-box"><strong>${esc(l.concept.rule)}</strong></div><div class="examples">${l.concept.examples.map(x=>'<span>'+esc(x)+'</span>').join('')}</div></article>
    <article class="card"><div class="card-title"><span>✦</span><div><small>تطبيق موجّه</small><h3>جرّب الآن</h3></div></div><p>${esc(l.application.prompt)}</p>${optionButtons(l.application.options,'application',l.application.correct,l.application.hint)}</article>
    <article class="card mastery-block"><div class="card-title"><span>✓</span><div><small>قياس الإتقان</small><h3>معرفة • تطبيق • استدلال</h3></div></div><p>أجب عن الأسئلة، ثم تحصل على تشخيص منفصل لكل مستوى.</p><button type="button" class="primary" id="startMastery">ابدأ القياس</button><div id="masteryArea"></div></article>
    <article class="card kwl-card"><div class="card-title"><span>L</span><div><small>بعد التعلم</small><h3>ماذا تعلمت؟</h3></div></div><textarea id="kwlL" placeholder="تعلمت أن...">${esc(kwl.l||'')}</textarea><button type="button" class="secondary" id="saveKwlBtn">حفظ انعكاسي</button></article>
    <article class="card transfer-card"><div><span class="eyebrow">مهمة نقل التعلم</span><h3>استخدم المهارة في موقف جديد</h3><p>اكتب جملة من إنشائك توظف فيها ما تعلمته. يمكن أن تكتبها ورقيًا ثم ترفعها من قسم «أعمالي الورقية».</p></div><button type="button" class="primary" id="goPapers">رفع عمل ورقي</button></article>`;
  $$('.want-btn').forEach(b=>b.addEventListener('click',()=>{$$('#kwlW')[0].value=b.textContent;saveKwl();$$('.want-btn').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')}));
  ['#kwlK','#kwlW','#kwlL'].forEach(s=>$(s)?.addEventListener('change',saveKwl));
  $('#saveKwlBtn').addEventListener('click',()=>{saveKwl();toast('تم حفظ KWL')});
  bindActivities();
  $('#startMastery').addEventListener('click',renderMastery);
  $('#goPapers').addEventListener('click',()=>{switchView('papers');$('#paperLesson').value=l.code});
}
function bindActivities(){
  $$('.interactive-options').forEach(group=>group.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
    const correct=group.dataset.correct, fb=$('#fb-'+group.dataset.group);
    group.querySelectorAll('button').forEach(x=>x.classList.remove('correct','wrong'));
    if(btn.dataset.value===correct){btn.classList.add('correct');fb.innerHTML='<b>أحسنت ✓</b> اكتشفت الفكرة بنفسك.'}
    else{btn.classList.add('wrong');fb.innerHTML='<b>حاول مرة أخرى.</b> تلميح: '+esc(group.dataset.hint)}
  })));
}
function renderMastery(){
  const l=state.lesson, host=$('#masteryArea');state.answers={};
  host.innerHTML='<div class="mastery-questions">'+l.mastery.map((q,i)=>`<div class="mq" data-i="${i}"><span class="level-tag ${q.level}">${q.label}</span><p><b>${i+1}.</b> ${esc(q.q)}</p><div class="mq-options">${q.options.map(o=>'<button type="button" data-value="'+esc(o)+'">'+esc(o)+'</button>').join('')}</div></div>`).join('')+'</div><button type="button" class="primary" id="finishMastery">عرض التشخيص</button><div id="masteryDiagnosis"></div>';
  $$('.mq-options button').forEach(btn=>btn.addEventListener('click',()=>{const qEl=btn.closest('.mq'),i=Number(qEl.dataset.i);qEl.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');state.answers[i]=btn.dataset.value}));
  $('#finishMastery').addEventListener('click',finishMastery);
}
function finishMastery(){
  const l=state.lesson;
  if(Object.keys(state.answers).length<l.mastery.length){toast('أجب عن جميع أسئلة القياس أولًا');return;}
  const levels={knowledge:{ok:0,total:0,label:'معرفة'},application:{ok:0,total:0,label:'تطبيق'},reasoning:{ok:0,total:0,label:'استدلال'}};
  let total=0;
  l.mastery.forEach((q,i)=>{levels[q.level].total++;if(state.answers[i]===q.answer){levels[q.level].ok++;total++}});
  const score=Math.round(total/l.mastery.length*100);
  Object.values(levels).forEach(v=>v.score=Math.round(v.ok/v.total*100));
  const weak=Object.values(levels).filter(v=>v.score<80);
  const status=score>=l.masteryThreshold&&weak.length===0?'mastered':'needs_support';
  const p=progress();p[l.code]={...(p[l.code]||{}),code:l.code,title:l.title,score,levels,status,lastAttemptAt:new Date().toISOString(),kwl:{k:$('#kwlK').value,w:$('#kwlW').value,l:$('#kwlL').value}};save(LS.progress,p);
  $('#masteryDiagnosis').innerHTML=`<div class="diagnosis ${status}"><h3>${status==='mastered'?'أحسنت، أتقنت الدرس':'تشخيصك جاهز'}</h3><div class="level-results">${Object.values(levels).map(v=>'<div><span>'+v.label+'</span><b>'+v.score+'%</b></div>').join('')}</div><p>${status==='mastered'?'انتقل إلى تحدٍ إثرائي: أنشئ مثالًا جديدًا واشرح سبب صحة استخدام المهارة فيه.':'تحتاج إلى تدريب إضافي في: '+weak.map(x=>x.label).join('، ')+'. ستعود للجزئية المرتبطة بها بدل إعادة الدرس كاملًا.'}</p></div>`;
  updateStats();renderResults();toast('تم حفظ نتيجة الإتقان');
}
function updateStats(){
  const p=progress(), vals=Object.values(p), subs=submissions();
  const scored=vals.filter(x=>Number.isFinite(x.score));
  const avg=scored.length?Math.round(scored.reduce((a,b)=>a+b.score,0)/scored.length):0;
  $('#overallScore').textContent=avg?avg+'%':'—';$('#homeRingText').textContent=avg+'%';
  $('#statStarted').textContent=vals.length;$('#statMastered').textContent=vals.filter(x=>x.status==='mastered').length;$('#statReview').textContent=vals.filter(x=>x.status==='needs_support').length;$('#statPapers').textContent=subs.length;
}
function renderResults(){
  const vals=Object.values(progress()), host=$('#resultsList');
  if(!vals.length){host.innerHTML='<div class="empty-state"><strong>لا توجد نتائج بعد</strong><p>افتح درسًا وأكمل قياس الإتقان.</p></div>';return;}
  host.innerHTML=vals.map(r=>`<article class="result-card"><div><span class="eyebrow">${esc(r.code)}</span><h3>${esc(r.title)}</h3></div><strong class="big-score">${Number.isFinite(r.score)?r.score+'%':'قيد التعلم'}</strong>${r.levels?'<div class="result-levels"><span>معرفة <b>'+r.levels.knowledge.score+'%</b></span><span>تطبيق <b>'+r.levels.application.score+'%</b></span><span>استدلال <b>'+r.levels.reasoning.score+'%</b></span></div>':''}<p>${r.status==='mastered'?'متقن — انتقل إلى الإثراء.':r.status==='needs_support'?'يحتاج تدريبًا علاجيًا موجهًا.':'أكمل رحلة الدرس.'}</p></article>`).join('');
}
$('#paperFile').addEventListener('change',e=>{const f=e.target.files[0];state.fileData=null;$('#paperPreview').innerHTML='';if(!f)return;if(f.size>1600000){$('#paperFeedback').textContent='الصورة كبيرة. اختر صورة أقل من 1.6MB للتجربة الحالية.';e.target.value='';return;}const rd=new FileReader();rd.onload=()=>{state.fileData=rd.result;$('#paperPreview').innerHTML='<img src="'+rd.result+'" alt="معاينة العمل">'};rd.readAsDataURL(f)});
$('#paperUploadForm').addEventListener('submit',e=>{e.preventDefault();if(!state.fileData){$('#paperFeedback').textContent='اختر صورة العمل أولًا.';return;}const arr=submissions();arr.unshift({id:'SUB-'+Date.now(),studentId:D.demoStudent.id,studentName:D.demoStudent.name,lessonCode:$('#paperLesson').value,lessonTitle:D.lessons[$('#paperLesson').value]?.title||'',type:$('#paperType').value,image:state.fileData,status:'pending',createdAt:new Date().toISOString(),teacherNote:'',correctedImage:null});save(LS.submissions,arr);state.fileData=null;e.target.reset();$('#paperPreview').innerHTML='';$('#paperFeedback').textContent='تم رفع العمل للمعلم ✓';renderSubmissions();updateStats()});
function renderSubmissions(){
  const arr=submissions(),host=$('#mySubmissions');
  if(!arr.length){host.innerHTML='<div class="empty-mini">لم ترفع أي عمل بعد.</div>';return;}
  const status={pending:'بانتظار التصحيح',needs_revision:'يحتاج تعديل',approved:'معتمد'};
  host.innerHTML=arr.map(s=>`<article class="submission-item"><img src="${s.correctedImage||s.image}" alt=""><div><b>${esc(s.lessonTitle)}</b><small>${esc(s.type)} • ${status[s.status]||s.status}</small>${s.teacherNote?'<p>ملاحظة المعلم: '+esc(s.teacherNote)+'</p>':''}</div></article>`).join('');
}
updateStats();renderResults();renderSubmissions();
})();