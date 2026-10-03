(()=>{'use strict';
const D=window.TAMAKKUN_DATA;
const session=window.TamakkunAPI?.requireRole('student','student.html');
if(!session)return;
const cacheSuffix='_'+session.user.id;const LS={progress:'tamakkun_progress_v1'+cacheSuffix,submissions:'tamakkun_submissions_v1'+cacheSuffix,portfolio:'tamakkun_portfolio_v1'+cacheSuffix,learning:'tamakkun_learning_preferences_v1'+cacheSuffix};
const state={lesson:null,answers:{},kwl:{},fileData:null,portfolioFileData:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const load=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback))}catch{return fallback}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const progress=()=>load(LS.progress,{});
const submissions=()=>load(LS.submissions,[]);
$('#studentName').textContent=session.user.full_name||'الطالب';
$('#logoutBtn')?.addEventListener('click',async e=>{e.preventDefault();await TamakkunAPI.logout();location.href='student.html';});
async function hydrateRemote(){
  const snap=await TamakkunAPI.studentSnapshot();
  const p={};
  (snap.progress||[]).forEach(row=>{
    const code=row.lessons?.code||row.lesson_code||'';
    if(!code)return;
    p[code]={
      code,title:row.lessons?.title||code,score:row.score,
      levels:row.knowledge_percent===null?null:{
        knowledge:{score:row.knowledge_percent,label:'معرفة'},
        application:{score:row.application_percent,label:'تطبيق'},
        reasoning:{score:row.reasoning_percent,label:'استدلال'}
      },
      status:row.status,
      startedAt:row.started_at,lastAttemptAt:row.last_attempt_at,
      kwl:{k:row.kwl_k||'',w:row.kwl_w||'',l:row.kwl_l||''}
    };
  });
  save(LS.progress,p);
  const pf=(snap.portfolio||[]).map(x=>({
    id:x.id,studentId:session.user.id,title:x.title,category:x.category,
    reflection:x.reflection||'',image:x.image_url||'',createdAt:x.created_at
  }));
  save(LS.portfolio,pf);
  const ps=(snap.papers||[]).map(x=>({
    id:x.id,studentId:session.user.id,studentName:session.user.full_name,
    lessonCode:x.lessons?.code||'',lessonTitle:x.lessons?.title||'',type:x.work_type,
    image:x.original_url||'',correctedImage:x.corrected_url||null,status:x.status,
    teacherNote:x.teacher_note||'',createdAt:x.created_at,reviewedAt:x.reviewed_at
  }));
  save(LS.submissions,ps);
  const lp=snap.learning;
  save(LS.learning,lp?{
    answers:lp.responses||{},scores:{visual:lp.visual_score,verbal:lp.verbal_score,active:lp.active_score},
    primary:lp.primary_preference,updatedAt:lp.updated_at
  }:{});
  return snap;
}
const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)};
const titles={home:'مرحبًا بك في لغتي',book:'كتابي التفاعلي',journey:'رحلة الدرس',papers:'أعمالي الورقية',portfolio:'ملف إنجازي',learning:'تفضيلات تعلمي',results:'تقدمي ونتائجي'};
window.switchView=id=>{ $$('.view').forEach(v=>v.classList.toggle('active-view',v.id===id)); $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===id)); $('#pageTitle').textContent=titles[id]||'مِنَصَّةُ تَمَكُّن'; window.scrollTo({top:0,behavior:'smooth'}); if(id==='papers')renderSubmissions(); if(id==='portfolio')renderPortfolio(); if(id==='learning')renderLearningPreferences(); if(id==='results'){renderResults();renderProgressSummary();} };
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));

function saveKwl(){
  if(!state.lesson)return;
  const p=progress(), code=state.lesson.code;
  p[code]=p[code]||{code,title:state.lesson.title,startedAt:new Date().toISOString()};
  p[code].kwl={k:$('#kwlK')?.value||'',w:$('#kwlW')?.value||'',l:$('#kwlL')?.value||''};
  save(LS.progress,p);
  TamakkunAPI.saveProgress({
    lesson_code:code,
    status:p[code].status||'in_progress',
    score:Number.isFinite(p[code].score)?p[code].score:null,
    knowledge_percent:p[code].levels?.knowledge?.score??null,
    application_percent:p[code].levels?.application?.score??null,
    reasoning_percent:p[code].levels?.reasoning?.score??null,
    kwl_k:p[code].kwl.k,kwl_w:p[code].kwl.w,kwl_l:p[code].kwl.l
  }).catch(()=>{});
}
async function openLesson(code){
  code=String(code||'').trim().toUpperCase();
  const feedback=$('#codeFeedback');
  if(feedback)feedback.textContent='جارٍ التحقق من الدرس...';
  try{await TamakkunAPI.request('lesson_access',{lesson_code:code});}
  catch(err){
    if(feedback)feedback.textContent=err?.message==='lesson_closed'?'هذا الدرس مغلق حاليًا من المعلم.':'الكود غير موجود أو غير متاح.';
    return;
  }
  const lesson=D.lessons[code];
  if(!lesson){if(feedback)feedback.textContent='الدرس موجود لكنه لم يجهز بعد في واجهة التعلم.';return;}
  if(feedback)feedback.textContent='';
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
  TamakkunAPI.saveProgress({
    lesson_code:l.code,score,
    knowledge_percent:levels.knowledge.score,
    application_percent:levels.application.score,
    reasoning_percent:levels.reasoning.score,
    status,
    kwl_k:$('#kwlK').value,kwl_w:$('#kwlW').value,kwl_l:$('#kwlL').value
  }).catch(()=>toast('حُفظت النتيجة محليًا وتعذر مزامنتها مؤقتًا'));
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
$('#paperUploadForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!state.fileData){$('#paperFeedback').textContent='اختر صورة العمل أولًا.';return;}
  const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;$('#paperFeedback').textContent='جارٍ رفع العمل...';
  try{
    await TamakkunAPI.submitPaper({lesson_code:$('#paperLesson').value,work_type:$('#paperType').value,image_data_url:state.fileData});
    state.fileData=null;e.currentTarget.reset();$('#paperPreview').innerHTML='';
    await hydrateRemote();renderSubmissions();updateStats();$('#paperFeedback').textContent='تم رفع العمل للمعلم ✓';
  }catch(err){$('#paperFeedback').textContent='تعذر رفع العمل. حاول مرة أخرى.'}
  finally{btn.disabled=false}
});
function renderSubmissions(){
  const arr=submissions(),host=$('#mySubmissions');
  if(!arr.length){host.innerHTML='<div class="empty-mini">لم ترفع أي عمل بعد.</div>';return;}
  const status={pending:'بانتظار التصحيح',needs_revision:'يحتاج تعديل',approved:'معتمد'};
  host.innerHTML=arr.map(s=>`<article class="submission-item"><img src="${s.correctedImage||s.image}" alt=""><div><b>${esc(s.lessonTitle)}</b><small>${esc(s.type)} • ${status[s.status]||s.status}</small>${s.teacherNote?'<p>ملاحظة المعلم: '+esc(s.teacherNote)+'</p>':''}</div></article>`).join('');
}

const portfolioItems=()=>load(LS.portfolio,[]);
const learningPrefs=()=>load(LS.learning,{});
const learningQuestions=[
  {id:'q1',text:'عندما أتعلم فكرة جديدة أفضل أن...',options:[['visual','أراها في مخطط أو مثال بصري'],['verbal','أسمع أو أقرأ شرحًا واضحًا'],['active','أجربها بنفسي مباشرة']]},
  {id:'q2',text:'عندما يصعب عليّ درس ما يساعدني أكثر...',options:[['visual','جدول أو خريطة مفاهيم'],['verbal','شرح خطوة بخطوة'],['active','تدريب قصير مع تغذية راجعة']]},
  {id:'q3',text:'عند المراجعة أميل إلى...',options:[['visual','الصور والتنظيم البصري'],['verbal','التلخيص والقراءة بصوت داخلي'],['active','حل أسئلة وبناء أمثلة']]},
  {id:'q4',text:'أفهم المهارة أسرع عندما...',options:[['visual','أرى الفرق بين مثالين'],['verbal','أقرأ القاعدة مع مثال'],['active','أحرك وأرتب وأختار وأجرب']]}
];
function renderLearningPreferences(){
  const saved=learningPrefs(), host=$('#learningAssessment');
  if(!host)return;
  host.innerHTML=learningQuestions.map((q,i)=>'<fieldset class="learning-q"><legend>'+(i+1)+'. '+esc(q.text)+'</legend>'+q.options.map(o=>'<label><input type="radio" name="'+q.id+'" value="'+o[0]+'" '+(saved.answers?.[q.id]===o[0]?'checked':'')+'> <span>'+esc(o[1])+'</span></label>').join('')+'</fieldset>').join('');
  renderLearningResult(saved);
}
function renderLearningResult(saved=learningPrefs()){
  const host=$('#learningResult'); if(!host)return;
  if(!saved.primary){host.innerHTML='<div class="empty-state"><strong>لم تسجل تفضيلاتك بعد</strong><p>أجب عن الاستبانة القصيرة؛ ستستخدم النتيجة لتنويع طريقة عرض الدروس، وليس لوضعك في تصنيف ثابت.</p></div>';return;}
  const labels={visual:'تميل حاليًا إلى العرض البصري',verbal:'تميل حاليًا إلى الشرح اللفظي المنظم',active:'تميل حاليًا إلى التعلم بالممارسة'};
  const tips={visual:'سنكثر لك من الخرائط والمقارنات والتنظيم البصري.',verbal:'سنقدم لك شروحًا مختصرة ومتسلسلة مع أمثلة واضحة.',active:'سنكثر لك من السحب والترتيب والتجربة والتغذية الراجعة.'};
  host.innerHTML='<article class="learning-result-card"><span class="eyebrow">تفضيل حالي قابل للتغير</span><h3>'+labels[saved.primary]+'</h3><p>'+tips[saved.primary]+'</p><div class="preference-bars">'+Object.entries(saved.scores||{}).map(([k,v])=>'<div><span>'+({visual:'بصري',verbal:'لفظي',active:'عملي'}[k])+'</span><b>'+v+'</b></div>').join('')+'</div></article>';
}
$('#learningForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const answers={},scores={visual:0,verbal:0,active:0};
  for(const q of learningQuestions){const checked=document.querySelector('input[name="'+q.id+'"]:checked'); if(!checked){toast('أجب عن جميع بنود تفضيلات التعلم');return;} answers[q.id]=checked.value;scores[checked.value]++;}
  const primary=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];
  const data={answers,scores,primary,updatedAt:new Date().toISOString()};
  save(LS.learning,data);renderLearningResult(data);
  try{await TamakkunAPI.saveLearning({responses:answers,visual_score:scores.visual,verbal_score:scores.verbal,active_score:scores.active,primary_preference:primary});toast('تم حفظ تفضيلات تعلمك');}
  catch{toast('حُفظت محليًا وتعذرت المزامنة مؤقتًا');}
});
$('#portfolioFile')?.addEventListener('change',e=>{
  const f=e.target.files[0];state.portfolioFileData=null;$('#portfolioPreview').innerHTML='';if(!f)return;
  if(f.size>1600000){$('#portfolioFeedback').textContent='الصورة كبيرة. اختر صورة أقل من 1.6MB في النسخة التجريبية.';e.target.value='';return;}
  const rd=new FileReader();rd.onload=()=>{state.portfolioFileData=rd.result;$('#portfolioPreview').innerHTML='<img src="'+rd.result+'" alt="معاينة العمل">'};rd.readAsDataURL(f);
});
$('#portfolioForm')?.addEventListener('submit',async e=>{
  e.preventDefault();if(!state.portfolioFileData){$('#portfolioFeedback').textContent='اختر صورة العمل أولًا.';return;}
  const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;$('#portfolioFeedback').textContent='جارٍ الحفظ...';
  try{
    await TamakkunAPI.addPortfolio({title:$('#portfolioTitle').value.trim(),category:$('#portfolioCategory').value,reflection:$('#portfolioReflection').value.trim(),image_data_url:state.portfolioFileData});
    state.portfolioFileData=null;e.currentTarget.reset();$('#portfolioPreview').innerHTML='';
    await hydrateRemote();renderPortfolio();$('#portfolioFeedback').textContent='تمت إضافة العمل إلى ملف إنجازك ✓';
  }catch{ $('#portfolioFeedback').textContent='تعذر حفظ العمل. حاول مرة أخرى.'; }
  finally{btn.disabled=false}
});
function renderPortfolio(){
  const host=$('#myPortfolio');if(!host)return;const arr=portfolioItems();
  if(!arr.length){host.innerHTML='<div class="empty-state"><strong>ملف إنجازك ما زال فارغًا</strong><p>أضف أفضل أعمالك، واذكر ما تعلمته من كل عمل.</p></div>';return;}
  host.innerHTML=arr.map(x=>'<article class="portfolio-item"><img src="'+x.image+'" alt=""><div><span>'+esc(x.category)+'</span><h4>'+esc(x.title)+'</h4><p>'+esc(x.reflection||'لم يضف تأملًا بعد.')+'</p><small>'+new Date(x.createdAt).toLocaleDateString('ar-SA')+'</small></div></article>').join('');
}
function renderProgressSummary(){
  const host=$('#studentProgressSummary');if(!host)return;const vals=Object.values(progress()),scored=vals.filter(x=>Number.isFinite(x.score));
  if(!scored.length){host.innerHTML='<div class="empty-state"><strong>لم يتكون مستوى بعد</strong><p>أكمل قياس إتقان في درس واحد على الأقل.</p></div>';return;}
  const avg=Math.round(scored.reduce((a,b)=>a+b.score,0)/scored.length), mastered=scored.filter(x=>x.status==='mastered').length;
  const level=avg>=90?'متقدم':avg>=80?'متقن':avg>=65?'نامٍ':'يحتاج دعمًا';
  const levelKeys=['knowledge','application','reasoning'], levelLabels={knowledge:'المعرفة',application:'التطبيق',reasoning:'الاستدلال'};
  const agg={knowledge:[],application:[],reasoning:[]};scored.forEach(r=>r.levels&&levelKeys.forEach(k=>agg[k].push(r.levels[k].score)));
  const avgs={};levelKeys.forEach(k=>avgs[k]=agg[k].length?Math.round(agg[k].reduce((a,b)=>a+b,0)/agg[k].length):0);
  const strongest=levelKeys.sort((a,b)=>avgs[b]-avgs[a])[0], weakest=levelKeys.sort((a,b)=>avgs[a]-avgs[b])[0];
  host.innerHTML='<div class="progress-hero-card"><div><span class="eyebrow">مستواك الحالي في المادة</span><h3>'+level+'</h3><p>يبنى هذا المستوى على نتائج الدروس التي أكملتها، ويتحدث مع تقدمك.</p></div><strong>'+avg+'%</strong></div><div class="progress-diagnostics"><div><span>الدروس المتقنة</span><b>'+mastered+' / '+scored.length+'</b></div><div><span>نقطة القوة الحالية</span><b>'+levelLabels[strongest]+' '+avgs[strongest]+'%</b></div><div><span>أولوية التحسين</span><b>'+levelLabels[weakest]+' '+avgs[weakest]+'%</b></div></div>';
}

(async()=>{
  try{await hydrateRemote();}
  catch{toast('تعذر تحميل آخر بياناتك؛ ستظهر النسخة المحفوظة مؤقتًا.');}
  updateStats();renderResults();renderSubmissions();renderPortfolio();renderLearningPreferences();renderProgressSummary();
})();
})();