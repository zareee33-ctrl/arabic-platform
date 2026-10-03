(()=>{'use strict';
const D=window.TAMAKKUN_DATA;
const session=window.TamakkunAPI?.getSession();
if(!session||!['teacher','admin'].includes(session.user?.role)){location.href='teacher.html';return;}
let remoteStudents=[],currentRemoteProfile=null;
const LS={progress:'tamakkun_teacher_progress_v1',submissions:'tamakkun_teacher_submissions_v1',portfolio:'tamakkun_teacher_portfolio_v1',learning:'tamakkun_teacher_learning_v1'};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let selected=null, originalImage=null, drawing=false, tool='pen';
const titles={dashboard:'لوحة المعلم',lessons:'الدروس والأكواد',students:'الطلاب',profile:'ملف الطالب الشامل',portfolio:'ملفات الإنجاز',learning:'تفضيلات التعلم',papers:'أعمال الطلاب',analytics:'المستوى والتقدم'};
function show(id){$$('.teacher-view').forEach(v=>v.classList.toggle('active',v.id==='t-'+id));$$('[data-tview]').forEach(b=>b.classList.toggle('active',b.dataset.tview===id));$('#teacherPageTitle').textContent=titles[id];if(id==='papers')renderPapers();if(id==='portfolio')renderPortfolio();if(id==='learning')renderLearningProfiles();if(id==='analytics'){renderAnalytics();renderStudentProgress();}window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-tview]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tview)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));$$('[data-open-profile]').forEach(b=>b.addEventListener('click',()=>openStudentProfile(b.dataset.openProfile)));

function mapRemoteProfileToLocal(snap){
  if(!snap)return;
  const progress={};
  (snap.progress||[]).forEach(row=>{
    const code=row.lessons?.code||''; if(!code)return;
    progress[code]={code,title:row.lessons?.title||code,score:row.score,
      levels:row.knowledge_percent===null?null:{
        knowledge:{score:row.knowledge_percent,label:'معرفة'},
        application:{score:row.application_percent,label:'تطبيق'},
        reasoning:{score:row.reasoning_percent,label:'استدلال'}
      },
      status:row.status,startedAt:row.started_at,lastAttemptAt:row.last_attempt_at,
      kwl:{k:row.kwl_k||'',w:row.kwl_w||'',l:row.kwl_l||''}
    };
  });
  save(LS.progress,progress);
  const learning=snap.learning;
  save(LS.learning,learning?{
    answers:learning.responses||{},
    scores:{visual:learning.visual_score,verbal:learning.verbal_score,active:learning.active_score},
    primary:learning.primary_preference,updatedAt:learning.updated_at
  }:{});
  save(LS.portfolio,(snap.portfolio||[]).map(x=>({
    id:x.id,studentId:snap.student?.id,title:x.title,category:x.category,reflection:x.reflection||'',
    image:x.image_url||'',createdAt:x.created_at
  })));
  save(LS.submissions,(snap.papers||[]).map(x=>({
    id:x.id,studentId:snap.student?.id,studentName:snap.student?.full_name||'',
    lessonCode:x.lessons?.code||'',lessonTitle:x.lessons?.title||'',type:x.work_type,
    image:x.original_url||'',correctedImage:x.corrected_url||null,status:x.status,
    teacherNote:x.teacher_note||'',createdAt:x.created_at,reviewedAt:x.reviewed_at
  })));
}
function renderStudentList(){
  const host=$('#teacherStudentList'); if(!host)return;
  $('#studentCount').textContent=remoteStudents.length+' طالب';
  if(!remoteStudents.length){host.innerHTML='<div class="empty-correction">لا يوجد طلاب بعد.</div>';return;}
  host.innerHTML=remoteStudents.map(x=>{
    const s=x.student,sc=(x.progress||[]).filter(r=>Number.isFinite(r.score));
    const avg=sc.length?Math.round(sc.reduce((a,b)=>a+b.score,0)/sc.length):null;
    return '<button class="student-profile-row" data-open-profile="'+s.id+'"><b>'+esc(s.login_code)+'</b><span>'+esc(s.full_name)+'</span><span>'+esc((s.grade||'')+(s.class_name?' / '+s.class_name:''))+'</span><em>'+(avg===null?'فتح الملف ←':avg+'% • فتح الملف ←')+'</em></button>';
  }).join('');
  $$('[data-open-profile]').forEach(b=>b.addEventListener('click',()=>openStudentProfile(b.dataset.openProfile)));
}
async function syncTeacherData(){
  const data=await TamakkunAPI.teacherSnapshot();
  remoteStudents=data.students||[];
  const flatPapers=[];
  for(const x of remoteStudents){
    for(const p of x.papers||[]) flatPapers.push({
      id:p.id,studentId:x.student.id,studentName:x.student.full_name,
      lessonCode:p.lessons?.code||'',lessonTitle:p.lessons?.title||'',type:p.work_type,
      image:p.original_url||'',correctedImage:p.corrected_url||null,status:p.status,
      teacherNote:p.teacher_note||'',createdAt:p.created_at,reviewedAt:p.reviewed_at
    });
  }
  save(LS.submissions,flatPapers);
  renderStudentList();
  updateKpis();
}
function summarizeRemote(rows){
  const scored=(rows||[]).filter(x=>Number.isFinite(x.score));
  if(!scored.length)return null;
  const avg=Math.round(scored.reduce((a,b)=>a+b.score,0)/scored.length);
  const mastered=scored.filter(x=>x.status==='mastered').length;
  const vals={knowledge:[],application:[],reasoning:[]};
  scored.forEach(r=>{
    if(Number.isFinite(r.knowledge_percent))vals.knowledge.push(r.knowledge_percent);
    if(Number.isFinite(r.application_percent))vals.application.push(r.application_percent);
    if(Number.isFinite(r.reasoning_percent))vals.reasoning.push(r.reasoning_percent);
  });
  const a={};
  for(const k of Object.keys(vals))a[k]=vals[k].length?Math.round(vals[k].reduce((x,y)=>x+y,0)/vals[k].length):0;
  const keys=['knowledge','application','reasoning'];
  const strongest=[...keys].sort((x,y)=>a[y]-a[x])[0],weakest=[...keys].sort((x,y)=>a[x]-a[y])[0];
  return {avg,mastered,total:scored.length,a,strongest,weakest,level:avg>=90?'متقدم':avg>=80?'متقن':avg>=65?'نامٍ':'يحتاج دعمًا'};
}
function renderLessons(){
  $('#lessonAdminList').innerHTML=Object.values(D.lessons).map(l=>`<article class="lesson-admin-card"><div><span class="eyebrow">${esc(l.type)} • ${esc(l.unit)}</span><h3>${esc(l.title)}</h3><p>${esc(l.goal)}</p></div><div class="lesson-code-box"><small>كود الدرس</small><strong>${esc(l.code)}</strong><button data-copy="${esc(l.code)}">نسخ الكود</button></div></article>`).join('');
  $$('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='تم النسخ ✓'}catch{b.textContent=b.dataset.copy}}));
}
function updateKpis(){
  const subs=load(LS.submissions,[]);
  const allProgress=remoteStudents.flatMap(x=>x.progress||[]);
  const scored=allProgress.filter(x=>Number.isFinite(x.score));
  $('#kpiPending').textContent=subs.filter(x=>x.status==='pending').length;
  $('#kpiSupport').textContent=remoteStudents.filter(x=>(x.progress||[]).some(r=>r.status==='needs_support')).length;
  $('#kpiAverage').textContent=scored.length?Math.round(scored.reduce((a,b)=>a+b.score,0)/scored.length)+'%':'—';
}
function renderPapers(){
  const arr=load(LS.submissions,[]), host=$('#teacherSubmissionList');
  if(!arr.length){host.innerHTML='<div class="empty-correction">لا توجد أعمال مرفوعة بعد. ارفع صورة من حساب الطالب التجريبي لتجربة التصحيح.</div>';return;}
  const labels={pending:'بانتظار التصحيح',needs_revision:'أعيد للطالب',approved:'معتمد'};
  host.innerHTML=arr.map(s=>`<button class="submission-row" data-id="${s.id}"><img src="${s.image}" alt=""><div><b>${esc(s.studentName)}</b><span>${esc(s.lessonTitle)} • ${esc(s.type)}</span><small>${labels[s.status]||s.status}</small></div></button>`).join('');
  $$('.submission-row').forEach(b=>b.addEventListener('click',()=>openCorrection(b.dataset.id)));
}
function openCorrection(id){
  const arr=load(LS.submissions,[]);selected=arr.find(x=>x.id===id);if(!selected)return;
  $('#correctionEmpty').hidden=true;$('#correctionEditor').hidden=false;$('#corrStudent').textContent=selected.studentName;$('#corrLesson').textContent=selected.lessonTitle+' • '+selected.type;$('#corrStatus').textContent=selected.status;$('#teacherNote').value=selected.teacherNote||'';
  originalImage=selected.image;loadCanvas(selected.correctedImage||selected.image);
}
function loadCanvas(src){
  const c=$('#correctionCanvas'),ctx=c.getContext('2d'),img=new Image();img.onload=()=>{const max=900,scale=Math.min(1,max/img.width);c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height)};img.src=src;
}
function pos(e,c){const r=c.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return{x:(p.clientX-r.left)*(c.width/r.width),y:(p.clientY-r.top)*(c.height/r.height)}}
const canvas=$('#correctionCanvas'),ctx=canvas.getContext('2d');
function start(e){if(tool!=='pen')return;drawing=true;const p=pos(e,canvas);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault()}
function move(e){if(!drawing||tool!=='pen')return;const p=pos(e,canvas);ctx.lineWidth=Math.max(3,canvas.width/250);ctx.lineCap='round';ctx.strokeStyle='#c62828';ctx.lineTo(p.x,p.y);ctx.stroke();e.preventDefault()}
function end(){drawing=false}
canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);window.addEventListener('mouseup',end);canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});canvas.addEventListener('touchend',end);
$$('[data-tool]').forEach(b=>b.addEventListener('click',()=>{tool=b.dataset.tool;if(tool==='clear')loadCanvas(originalImage);if(tool==='check'||tool==='x'){ctx.font='bold '+Math.max(48,canvas.width/10)+'px Tahoma';ctx.fillStyle=tool==='check'?'#138a4b':'#c62828';ctx.fillText(tool==='check'?'✓':'✕',canvas.width*.08,canvas.height*.14);tool='pen'}}));
async function saveCorrection(status){
  if(!selected)return;
  const correctedImage=canvas.toDataURL('image/jpeg',.88);
  const note=$('#teacherNote').value.trim();
  $('#sendRevision').disabled=true;$('#approveSubmission').disabled=true;
  try{
    await TamakkunAPI.reviewSubmission({submission_id:selected.id,status,teacher_note:note,corrected_image_data_url:correctedImage});
    await syncTeacherData();renderPapers();$('#corrStatus').textContent=status==='approved'?'معتمد':'يحتاج تعديل';
  }catch{alert('تعذر حفظ التصحيح. حاول مرة أخرى.')}
  finally{$('#sendRevision').disabled=false;$('#approveSubmission').disabled=false}
}
$('#sendRevision').addEventListener('click',()=>saveCorrection('needs_revision'));$('#approveSubmission').addEventListener('click',()=>saveCorrection('approved'));

function renderAnalytics(){
  const host=$('#teacherAnalytics');if(!host)return;
  const rows=remoteStudents.flatMap(x=>(x.progress||[]).map(r=>({student:x.student,row:r})));
  if(!rows.length){host.innerHTML='<div class="teacher-card wide-card">لا توجد نتائج حتى الآن.</div>';return;}
  host.innerHTML=rows.map(({student,row:r})=>'<article class="analytics-card"><div><span class="eyebrow">'+esc(student.full_name)+' • '+esc(r.lessons?.code||'')+'</span><h3>'+esc(r.lessons?.title||'درس')+'</h3></div><strong>'+(Number.isFinite(r.score)?r.score+'%':'قيد التعلم')+'</strong><div class="analytics-levels"><span>معرفة <b>'+(r.knowledge_percent??'—')+(r.knowledge_percent===null?'':'%')+'</b></span><span>تطبيق <b>'+(r.application_percent??'—')+(r.application_percent===null?'':'%')+'</b></span><span>استدلال <b>'+(r.reasoning_percent??'—')+(r.reasoning_percent===null?'':'%')+'</b></span></div><p>'+(r.status==='needs_support'?'يحتاج معالجة موجهة':r.status==='mastered'?'متقن':'قيد التعلم')+'</p></article>').join('');
}


function renderPortfolio(){
  const host=$('#teacherPortfolio');if(!host)return;
  const all=remoteStudents.flatMap(x=>(x.portfolio||[]).map(p=>({student:x.student,item:p})));
  $('#portfolioCount').textContent=all.length+' أعمال';
  if(!all.length){host.innerHTML='<div class="empty-correction">لا توجد أعمال في ملفات الإنجاز حتى الآن.</div>';return;}
  host.innerHTML=all.map(({student,item:x})=>'<article class="teacher-portfolio-item"><img src="'+(x.image_url||'')+'" alt=""><div><span>'+esc(student.full_name)+' • '+esc(x.category)+'</span><h4>'+esc(x.title)+'</h4><p>'+esc(x.reflection||'لم يكتب الطالب تأملًا بعد.')+'</p><small>'+new Date(x.created_at).toLocaleDateString('ar-SA')+'</small></div></article>').join('');
}
function renderLearningProfiles(){
  const host=$('#teacherLearningProfiles');if(!host)return;
  const labels={visual:'يميل حاليًا إلى العرض البصري',verbal:'يميل حاليًا إلى الشرح اللفظي المنظم',active:'يميل حاليًا إلى التعلم بالممارسة'};
  const suggestions={visual:'استخدم خرائط مفاهيم ومقارنات وتمثيلات بصرية مع تنويع النشاط.',verbal:'استخدم شرحًا متسلسلًا وتلخيصًا لغويًا وأمثلة واضحة.',active:'استخدم بناء الجملة والسحب والترتيب والتجربة والتغذية الراجعة.'};
  const rows=remoteStudents.filter(x=>x.learning?.primary_preference);
  if(!rows.length){host.innerHTML='<div class="teacher-card wide-card">لم يكمل أي طالب استبانة تفضيلات التعلم بعد.</div>';return;}
  host.innerHTML=rows.map(x=>{const d=x.learning,p=d.primary_preference;return '<article class="learning-profile-card"><div><span class="eyebrow">'+esc(x.student.full_name)+'</span><h3>'+labels[p]+'</h3><p>'+suggestions[p]+'</p></div><div class="teacher-preference-bars"><span>بصري <b>'+d.visual_score+'</b></span><span>لفظي <b>'+d.verbal_score+'</b></span><span>عملي <b>'+d.active_score+'</b></span></div><small>تفضيل حالي وليس تصنيفًا ثابتًا.</small></article>'}).join('');
}
function buildProgress(){
  const vals=Object.values(load(LS.progress,{})),scored=vals.filter(x=>Number.isFinite(x.score));
  if(!scored.length)return null;
  const avg=Math.round(scored.reduce((a,b)=>a+b.score,0)/scored.length), mastered=scored.filter(x=>x.status==='mastered').length;
  const keys=['knowledge','application','reasoning'],labels={knowledge:'المعرفة',application:'التطبيق',reasoning:'الاستدلال'},agg={knowledge:[],application:[],reasoning:[]};
  scored.forEach(r=>r.levels&&keys.forEach(k=>agg[k].push(r.levels[k].score)));
  const a={};keys.forEach(k=>a[k]=agg[k].length?Math.round(agg[k].reduce((x,y)=>x+y,0)/agg[k].length):0);
  const strongest=[...keys].sort((x,y)=>a[y]-a[x])[0],weakest=[...keys].sort((x,y)=>a[x]-a[y])[0];
  const level=avg>=90?'متقدم':avg>=80?'متقن':avg>=65?'نامٍ':'يحتاج دعمًا';
  return {avg,mastered,total:scored.length,a,strongest,weakest,labels,level};
}
function renderStudentProgress(){
  const host=$('#studentProgressTable');if(!host)return;
  if(!remoteStudents.length){host.innerHTML='<div class="teacher-card wide-card">لا يوجد طلاب بعد.</div>';return;}
  const labels={knowledge:'المعرفة',application:'التطبيق',reasoning:'الاستدلال'};
  host.innerHTML=remoteStudents.map(x=>{
    const p=summarizeRemote(x.progress||[]);
    if(!p)return '<article class="student-progress-card"><div class="student-progress-main"><div><span class="eyebrow">'+esc(x.student.login_code)+' • '+esc(x.student.full_name)+'</span><h3>لم يحدد بعد</h3><p>لا توجد نتائج كافية لتحديد مستوى الطالب.</p></div><strong>—</strong></div></article>';
    const support=p.avg<65?'علاجي مكثف':p.a[p.weakest]<80?'علاج موجه في '+labels[p.weakest]:'إثراء واستمرار';
    return '<article class="student-progress-card"><div class="student-progress-main"><div><span class="eyebrow">'+esc(x.student.login_code)+' • '+esc(x.student.full_name)+'</span><h3>'+p.level+'</h3><p>أتقن '+p.mastered+' من '+p.total+' دروس مقاسة.</p></div><strong>'+p.avg+'%</strong></div><div class="student-progress-metrics"><div><span>معرفة</span><b>'+p.a.knowledge+'%</b></div><div><span>تطبيق</span><b>'+p.a.application+'%</b></div><div><span>استدلال</span><b>'+p.a.reasoning+'%</b></div><div><span>نقطة القوة</span><b>'+labels[p.strongest]+'</b></div><div><span>أولوية التحسين</span><b>'+labels[p.weakest]+'</b></div><div><span>المسار المقترح</span><b>'+support+'</b></div></div><button class="open-from-progress" data-open-profile="'+x.student.id+'">فتح ملف الطالب</button></article>';
  }).join('');
  $$('[data-open-profile]').forEach(b=>b.addEventListener('click',()=>openStudentProfile(b.dataset.openProfile)));
}



let currentProfileStudent='S3A001',currentProfileTab='overview';
function getStudentProfileData(){
  const p=buildProgress(),progressRows=Object.values(load(LS.progress,{})),portfolio=load(LS.portfolio,[]),papers=load(LS.submissions,[]),learning=load(LS.learning,{});
  const s=currentRemoteProfile?.student||{};
  return {student:{id:s.login_code||s.id||'',name:s.full_name||'الطالب',className:(s.grade||'')+(s.class_name?' / '+s.class_name:'')},p,progressRows,portfolio,papers,learning};
}
async function openStudentProfile(id){
  currentProfileStudent=id;currentProfileTab='overview';
  try{
    currentRemoteProfile=await TamakkunAPI.studentProfile(id);
    mapRemoteProfileToLocal(currentRemoteProfile);
  }catch{
    alert('تعذر تحميل ملف الطالب. حاول مرة أخرى.');
    return;
  }
  const d=getStudentProfileData();
  $('#profileStudentName').textContent=d.student.name;
  $('#profileStudentMeta').textContent=d.student.id+' • '+d.student.className;
  renderStudentProfileOverview(d);
  renderStudentProfileTab('overview',d);
  const statusBox=$('#profileStatusBadge');
  if(statusBox){
    const avg=d.p?.avg??null, level=d.p?.level||'قيد التشخيص';
    statusBox.innerHTML='<span>المستوى الحالي</span><strong>'+level+'</strong><small>'+(avg===null?'لا توجد بيانات كافية':avg+'% متوسط الإتقان')+'</small>';
  }
  show('profile');
  $('[data-profile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.profileTab==='overview'));
}
function renderStudentProfileOverview(d){
  const host=$('#studentProfileOverview');if(!host)return;
  const avg=d.p?.avg??0,level=d.p?.level||'لم يحدد بعد',mastered=d.p?.mastered||0,total=d.p?.total||0;
  host.innerHTML='<div class="profile-overview-grid">'+
  '<article><span>المستوى الحالي</span><strong>'+level+'</strong><small>يتحدث مع كل نتيجة جديدة</small></article>'+
  '<article><span>متوسط الإتقان</span><strong>'+(d.p?avg+'%':'—')+'</strong><small>في الدروس المقاسة</small></article>'+
  '<article><span>الدروس المتقنة</span><strong>'+mastered+' / '+total+'</strong><small>بحسب حد الإتقان</small></article>'+
  '<article><span>ملف الإنجاز</span><strong>'+d.portfolio.length+'</strong><small>عملًا موثقًا</small></article>'+
  '<article><span>أعمال ورقية</span><strong>'+d.papers.length+'</strong><small>مرفوعة أو مصححة</small></article>'+
  '<article><span>تفضيل التعلم</span><strong>'+({visual:'بصري',verbal:'لفظي',active:'عملي'}[d.learning.primary]||'غير محدد')+'</strong><small>تفضيل حالي غير ثابت</small></article>'+
  '</div>';
}
$$('[data-profile-tab]').forEach(b=>b.addEventListener('click',()=>{currentProfileTab=b.dataset.profileTab;$$('[data-profile-tab]').forEach(x=>x.classList.toggle('active',x===b));renderStudentProfileTab(currentProfileTab,getStudentProfileData())}));
function renderStudentProfileTab(tab,d){
  const host=$('#studentProfileContent');if(!host)return;
  if(tab==='overview'){
    const weak=d.p?d.p.labels[d.p.weakest]:'غير محدد',strong=d.p?d.p.labels[d.p.strongest]:'غير محدد';
    host.innerHTML='<div class="profile-two-col"><article class="teacher-card"><span class="eyebrow">تشخيص مختصر</span><h3>القوة والأولوية</h3><div class="profile-diagnostic-row"><span>نقطة القوة</span><b>'+strong+'</b></div><div class="profile-diagnostic-row"><span>أولوية التحسين</span><b>'+weak+'</b></div></article><article class="teacher-card"><span class="eyebrow">آخر حالة</span><h3>المتابعة المقترحة</h3><p>'+(d.p?(d.p.avg<65?'يحتاج دعماً علاجياً منظماً مع مهام قصيرة ومتدرجة.':d.p.a[d.p.weakest]<80?'يحتاج تدريباً موجهاً في '+weak+'.':'مناسب للإثراء والاستمرار مع مهام أعمق.'):'أكمل الطالب قياس درس واحد على الأقل لتكوين توصية.')+'</p></article></div>';return;
  }
  if(tab==='lessons'){
    if(!d.progressRows.length){host.innerHTML='<div class="teacher-card">لا توجد نتائج دروس حتى الآن.</div>';return;}
    host.innerHTML='<div class="profile-lesson-list">'+d.progressRows.map(r=>'<article><div><span class="eyebrow">'+esc(r.code)+'</span><h4>'+esc(r.title)+'</h4></div><strong>'+(Number.isFinite(r.score)?r.score+'%':'قيد التعلم')+'</strong>'+(r.levels?'<div class="profile-levels"><span>معرفة '+r.levels.knowledge.score+'%</span><span>تطبيق '+r.levels.application.score+'%</span><span>استدلال '+r.levels.reasoning.score+'%</span></div>':'')+'</article>').join('')+'</div>';return;
  }
  if(tab==='portfolio'){
    host.innerHTML=d.portfolio.length?'<div class="teacher-portfolio-grid">'+d.portfolio.map(x=>'<article class="teacher-portfolio-item"><img src="'+x.image+'" alt=""><div><span>'+esc(x.category)+'</span><h4>'+esc(x.title)+'</h4><p>'+esc(x.reflection||'')+'</p></div></article>').join('')+'</div>':'<div class="teacher-card">ملف الإنجاز فارغ حتى الآن.</div>';return;
  }
  if(tab==='papers'){
    const labels={pending:'بانتظار التصحيح',needs_revision:'يحتاج تعديل',approved:'معتمد'};
    host.innerHTML=d.papers.length?'<div class="profile-paper-grid">'+d.papers.map(x=>'<article><img src="'+(x.correctedImage||x.image)+'"><div><h4>'+esc(x.lessonTitle||'عمل ورقي')+'</h4><span>'+esc(x.type||'')+'</span><small>'+labels[x.status]+'</small>'+(x.teacherNote?'<p>'+esc(x.teacherNote)+'</p>':'')+'</div></article>').join('')+'</div>':'<div class="teacher-card">لا توجد أعمال ورقية بعد.</div>';return;
  }
  if(tab==='learning'){
    if(!d.learning.primary){host.innerHTML='<div class="teacher-card">لم يكمل الطالب استبانة تفضيلات التعلم بعد.</div>';return;}
    const labels={visual:'يميل حاليًا إلى العرض البصري',verbal:'يميل حاليًا إلى الشرح اللفظي المنظم',active:'يميل حاليًا إلى التعلم بالممارسة'};
    host.innerHTML='<article class="learning-profile-card"><span class="eyebrow">تفضيل حالي</span><h3>'+labels[d.learning.primary]+'</h3><p>استخدم هذا التفضيل لتنويع طرق التعلم، وليس لحصر الطالب في طريقة واحدة.</p></article>';return;
  }
  if(tab==='plan'){
    const plan=d.p?(d.p.avg<65?'خطة علاجية: شرح مصغر، مثال محلول، تدريب موجه، ثم إعادة قياس قصيرة.':d.p.a[d.p.weakest]<80?'خطة تعزيز: نشاط تطبيقي مركز في '+d.p.labels[d.p.weakest]+'، ثم سؤال استدلالي جديد.':'خطة إثرائية: مهمة إنتاجية جديدة، تفسير السبب، وربط المهارة بسياق مختلف.'):'يحدد المسار بعد توفر بيانات كافية.';
    host.innerHTML='<article class="teacher-card profile-plan"><span class="eyebrow">خطة متابعة ديناميكية</span><h3>المسار المقترح للطالب</h3><p>'+plan+'</p><div class="plan-actions"><button>إسناد تدريب علاجي</button><button>إسناد مهمة إثرائية</button><button>إضافة ملاحظة متابعة</button></div></article>';
  }
}

$('#createStudentForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button[type="submit"]'),msg=$('#createStudentMessage');btn.disabled=true;msg.textContent='جارٍ إنشاء الحساب...';
  try{
    await TamakkunAPI.createStudent({
      code:$('#newStudentCode').value,full_name:$('#newStudentName').value,
      password:$('#newStudentPassword').value,grade:'ثالث متوسط',class_name:$('#newStudentClass').value
    });
    e.currentTarget.reset();msg.textContent='تم إنشاء حساب الطالب ✓';await syncTeacherData();
  }catch(err){msg.textContent='تعذر إنشاء الحساب. تأكد من أن رمز الدخول غير مستخدم.'}
  finally{btn.disabled=false}
});
(async()=>{
  renderLessons();
  try{await syncTeacherData();}catch{alert('تعذر الاتصال بقاعدة البيانات. أعد تحميل الصفحة.');}
  renderPortfolio();renderLearningProfiles();renderAnalytics();renderStudentProgress();
})();
})();