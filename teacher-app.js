(()=>{'use strict';
const D=window.TAMAKKUN_DATA;
const LS={progress:'tamakkun_progress_v1',submissions:'tamakkun_submissions_v1',portfolio:'tamakkun_portfolio_v1',learning:'tamakkun_learning_preferences_v1'};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let selected=null, originalImage=null, drawing=false, tool='pen';
const titles={dashboard:'لوحة المعلم',lessons:'الدروس والأكواد',students:'الطلاب',portfolio:'ملفات الإنجاز',learning:'تفضيلات التعلم',papers:'أعمال الطلاب',analytics:'المستوى والتقدم'};
function show(id){$$('.teacher-view').forEach(v=>v.classList.toggle('active',v.id==='t-'+id));$$('[data-tview]').forEach(b=>b.classList.toggle('active',b.dataset.tview===id));$('#teacherPageTitle').textContent=titles[id];if(id==='papers')renderPapers();if(id==='portfolio')renderPortfolio();if(id==='learning')renderLearningProfiles();if(id==='analytics'){renderAnalytics();renderStudentProgress();}window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-tview]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tview)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));

function renderLessons(){
  $('#lessonAdminList').innerHTML=Object.values(D.lessons).map(l=>`<article class="lesson-admin-card"><div><span class="eyebrow">${esc(l.type)} • ${esc(l.unit)}</span><h3>${esc(l.title)}</h3><p>${esc(l.goal)}</p></div><div class="lesson-code-box"><small>كود الدرس</small><strong>${esc(l.code)}</strong><button data-copy="${esc(l.code)}">نسخ الكود</button></div></article>`).join('');
  $$('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='تم النسخ ✓'}catch{b.textContent=b.dataset.copy}}));
}
function updateKpis(){
  const subs=load(LS.submissions,[]), vals=Object.values(load(LS.progress,{})), scored=vals.filter(x=>Number.isFinite(x.score));
  $('#kpiPending').textContent=subs.filter(x=>x.status==='pending').length;$('#kpiSupport').textContent=vals.filter(x=>x.status==='needs_support').length;$('#kpiAverage').textContent=scored.length?Math.round(scored.reduce((a,b)=>a+b.score,0)/scored.length)+'%':'—';
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
function saveCorrection(status){
  if(!selected)return;const arr=load(LS.submissions,[]),i=arr.findIndex(x=>x.id===selected.id);if(i<0)return;arr[i]={...arr[i],status,teacherNote:$('#teacherNote').value.trim(),correctedImage:canvas.toDataURL('image/jpeg',.88),reviewedAt:new Date().toISOString()};save(LS.submissions,arr);selected=arr[i];renderPapers();updateKpis();$('#corrStatus').textContent=status==='approved'?'معتمد':'يحتاج تعديل';
}
$('#sendRevision').addEventListener('click',()=>saveCorrection('needs_revision'));$('#approveSubmission').addEventListener('click',()=>saveCorrection('approved'));

function renderAnalytics(){
  const vals=Object.values(load(LS.progress,{})),host=$('#teacherAnalytics');
  if(!vals.length){host.innerHTML='<div class="teacher-card wide-card">لا توجد نتائج حتى الآن. أكمل قياس إتقان من مساحة الطالب التجريبية.</div>';return;}
  host.innerHTML=vals.map(r=>`<article class="analytics-card"><div><span class="eyebrow">${esc(r.code)}</span><h3>${esc(r.title)}</h3></div><strong>${Number.isFinite(r.score)?r.score+'%':'قيد التعلم'}</strong>${r.levels?'<div class="analytics-levels"><span>معرفة <b>'+r.levels.knowledge.score+'%</b></span><span>تطبيق <b>'+r.levels.application.score+'%</b></span><span>استدلال <b>'+r.levels.reasoning.score+'%</b></span></div>':''}<p>${r.status==='needs_support'?'يحتاج معالجة موجهة':'متقن أو قيد التعلم'}</p></article>`).join('');
}

function renderPortfolio(){
  const arr=load(LS.portfolio,[]),host=$('#teacherPortfolio');if(!host)return;
  $('#portfolioCount').textContent=arr.length+' أعمال';
  if(!arr.length){host.innerHTML='<div class="empty-correction">لا توجد أعمال في ملف الإنجاز حتى الآن.</div>';return;}
  host.innerHTML=arr.map(x=>'<article class="teacher-portfolio-item"><img src="'+x.image+'" alt=""><div><span>'+esc(x.category)+'</span><h4>'+esc(x.title)+'</h4><p>'+esc(x.reflection||'لم يكتب الطالب تأملًا بعد.')+'</p><small>'+new Date(x.createdAt).toLocaleDateString('ar-SA')+'</small></div></article>').join('');
}
function renderLearningProfiles(){
  const data=load(LS.learning,{}),host=$('#teacherLearningProfiles');if(!host)return;
  if(!data.primary){host.innerHTML='<div class="teacher-card wide-card">لم يكمل الطالب استبانة تفضيلات التعلم بعد.</div>';return;}
  const labels={visual:'يميل حاليًا إلى العرض البصري',verbal:'يميل حاليًا إلى الشرح اللفظي المنظم',active:'يميل حاليًا إلى التعلم بالممارسة'};
  const suggestions={visual:'استخدم خرائط مفاهيم ومقارنات وتمثيلات بصرية، مع إبقاء أنشطة تطبيقية متنوعة.',verbal:'استخدم شرحًا متسلسلًا وتلخيصًا لغويًا وأمثلة واضحة، مع تنويع النشاط.',active:'استخدم بناء الجملة والسحب والترتيب والتجربة والتغذية الراجعة، مع دعم بصري ولفظي.'};
  host.innerHTML='<article class="learning-profile-card"><div><span class="eyebrow">الطالب التجريبي</span><h3>'+labels[data.primary]+'</h3><p>'+suggestions[data.primary]+'</p></div><div class="teacher-preference-bars">'+Object.entries(data.scores||{}).map(([k,v])=>'<span>'+({visual:'بصري',verbal:'لفظي',active:'عملي'}[k])+' <b>'+v+'</b></span>').join('')+'</div><small>هذه تفضيلات حالية وليست تصنيفًا ثابتًا للطالب.</small></article>';
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
  const host=$('#studentProgressTable');if(!host)return;const p=buildProgress();
  if(!p){host.innerHTML='<div class="teacher-card wide-card">لا توجد نتائج كافية لتحديد مستوى الطالب بعد.</div>';return;}
  const support=p.avg<65?'علاجي مكثف':p.a[p.weakest]<80?'علاج موجه في '+p.labels[p.weakest]:'إثراء واستمرار';
  host.innerHTML='<article class="student-progress-card"><div class="student-progress-main"><div><span class="eyebrow">S3A001 • الطالب التجريبي</span><h3>'+p.level+'</h3><p>أتقن '+p.mastered+' من '+p.total+' دروس مقاسة.</p></div><strong>'+p.avg+'%</strong></div><div class="student-progress-metrics"><div><span>معرفة</span><b>'+p.a.knowledge+'%</b></div><div><span>تطبيق</span><b>'+p.a.application+'%</b></div><div><span>استدلال</span><b>'+p.a.reasoning+'%</b></div><div><span>نقطة القوة</span><b>'+p.labels[p.strongest]+'</b></div><div><span>أولوية التحسين</span><b>'+p.labels[p.weakest]+'</b></div><div><span>المسار المقترح</span><b>'+support+'</b></div></div></article>';
}

renderLessons();updateKpis();renderPortfolio();renderLearningProfiles();renderAnalytics();renderStudentProgress();
})();