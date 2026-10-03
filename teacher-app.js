(()=>{'use strict';
const D=window.TAMAKKUN_DATA;
const LS={progress:'tamakkun_progress_v1',submissions:'tamakkun_submissions_v1'};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let selected=null, originalImage=null, drawing=false, tool='pen';
const titles={dashboard:'لوحة المعلم',lessons:'الدروس والأكواد',students:'الطلاب',papers:'أعمال الطلاب',analytics:'الإتقان والتحليل'};
function show(id){$$('.teacher-view').forEach(v=>v.classList.toggle('active',v.id==='t-'+id));$$('[data-tview]').forEach(b=>b.classList.toggle('active',b.dataset.tview===id));$('#teacherPageTitle').textContent=titles[id];if(id==='papers')renderPapers();if(id==='analytics')renderAnalytics();window.scrollTo({top:0,behavior:'smooth'})}
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
renderLessons();updateKpis();renderAnalytics();
})();