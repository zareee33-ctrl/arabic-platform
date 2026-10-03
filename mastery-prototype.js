(()=>{'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const skills=[
 {id:'concept',title:'أفهم معنى الحال',short:'المفهوم'},
 {id:'identify',title:'أحدد الحال',short:'التحديد'},
 {id:'owner',title:'أحدد صاحب الحال',short:'صاحب الحال'},
 {id:'transfer',title:'أطبق وأفسر',short:'النقل والاستدلال'}
];
const state={index:0,streak:0,hintLevel:0,skill:{
 concept:{wins:0,errors:0},identify:{wins:0,errors:0},owner:{wins:0,errors:0},transfer:{wins:0,errors:0}
}};
const tasks={
 concept:[
  {visual:'دخلَ خالدٌ الفصلَ <u>مسرعًا</u>.',q:'ماذا تضيف كلمة «مسرعًا» إلى الجملة؟',o:['تحدد مكان الدخول','تصف هيئة خالد وقت الدخول','تحدد زمن الدخول','تذكر اسم شخص آخر'],a:1,why:'الحال يصف هيئة صاحبه وقت وقوع الفعل.'},
  {visual:'عادَ اللاعبُ <u>فرحًا</u>.',q:'أي سؤال يساعدك على اكتشاف «فرحًا»؟',o:['متى عاد؟','أين عاد؟','كيف عاد؟','كم عاد؟'],a:2,why:'سؤال «كيف وقع الفعل؟» مفتاح مناسب لاكتشاف الحال.'}
 ],
 identify:[
  {visual:'وقفَ الحارسُ <u>منتبهًا</u>.',q:'ما الحال في الجملة؟',o:['وقف','الحارس','منتبهًا','لا يوجد'],a:2,why:'منتبهًا تبين هيئة الحارس وقت الوقوف.'},
  {visual:'رجعَ المسافرُ <u>مطمئنًا</u>.',q:'اختر الحال.',o:['رجع','المسافر','مطمئنًا','المسافر مطمئن'],a:2,why:'مطمئنًا تصف هيئة المسافر وقت الرجوع.'}
 ],
 owner:[
  {visual:'دخلَ الطالبُ مسرعًا.',q:'من صاحب الحال «مسرعًا»؟',o:['دخل','الطالب','مسرعًا','الفصل'],a:1,why:'صاحب الحال هو من تصفه الحال، وهنا تصف الطالب.'},
  {visual:'عادَ الجنودُ منتصرين.',q:'من صاحب الحال «منتصرين»؟',o:['عاد','الجنود','منتصرين','لا يوجد'],a:1,why:'الحال «منتصرين» تصف الجنود.'}
 ],
 transfer:[
  {visual:'وصلَ الزائرُ مبتسمًا.',q:'لماذا تعد «مبتسمًا» حالًا؟',o:['لأنها تدل على مكان الوصول','لأنها تبين هيئة الزائر وقت الوصول','لأنها اسم معرفة','لأنها فعل'],a:1,why:'الاستدلال الصحيح يربط الكلمة بوظيفتها في الجملة.'},
  {visual:'اختر الجملة التي استعملت الحال استعمالًا صحيحًا.',q:'أيها صحيح؟',o:['عاد الطالبُ سعيدًا','عاد سعيدٌ الطالب','الطالب سعيد عاد','عاد السعيدُ طالب'],a:0,why:'في الجملة الصحيحة تصف «سعيدًا» هيئة الطالب وقت العودة.'}
 ]
};
const info=id=>state.skill[id];
const mastered=id=>info(id).wins>=2;
const overall=()=>Math.round(skills.filter(s=>mastered(s.id)).length/skills.length*100);
function renderMap(){
 $('#skillMap').innerHTML=skills.map((s,i)=>{
  const m=mastered(s.id),active=i===state.index&&!m,locked=i>state.index&&!m;
  return '<div class="skill-node '+(m?'mastered':active?'active':locked?'locked':'')+'"><div class="n">'+(m?'✓':i+1)+'</div><div><b>'+s.title+'</b><small>'+(m?'أثبتت الإتقان':active?'نعمل عليها الآن':'تُفتح بعد الإتقان')+'</small></div><span class="status">'+(m?'100%':active?info(s.id).wins+'/2':'🔒')+'</span></div>';
 }).join('');
 const v=overall();$('#overallMastery').textContent=v+'%';$('#overallBar').style.width=v+'%';
}
function currentTask(id){return tasks[id][Math.min(info(id).wins,1)]}
function setCoach(text,decision){$('#coachText').textContent=text;$('#decisionText').textContent=decision||'مسار قياسي'}
function render(){
 renderMap();
 const skill=skills[state.index]; if(!skill)return finish();
 const task=currentTask(skill.id);
 $('#stageEyebrow').textContent='المهارة '+(state.index+1)+' من '+skills.length;
 $('#stageTitle').textContent=skill.title;
 $('#whyTitle').textContent=skill.id==='concept'?'اكتشاف قبل تعريف':'إثبات الفهم بموقف جديد';
 $('#whyText').textContent=skill.id==='concept'?'نريدك أن تكتشف وظيفة الحال قبل أن نعرض القاعدة.':'لا يكفي حفظ المثال؛ نغيّر السياق لنتأكد أن الفهم انتقل.';
 $('#streakValue').textContent=state.streak;
 $('#scene').innerHTML='<article class="scene-card '+(state.hintLevel>=2?'support-mode':'')+'"><div class="scene-visual"><div><div class="sentence">'+task.visual+'</div><small>اقرأ الجملة ثم فكّر في الوظيفة</small></div></div><p class="question">'+task.q+'</p><div class="choices">'+task.o.map((x,i)=>'<button data-choice="'+i+'">'+x+'</button>').join('')+'</div><div id="feedback" class="feedback"></div></article>';
 $$('.choices button').forEach(b=>b.onclick=()=>answer(+b.dataset.choice));
}
function answer(i){
 const skill=skills[state.index],task=currentTask(skill.id),data=info(skill.id),fb=$('#feedback');
 $$('.choices button').forEach(x=>x.disabled=true);
 const btn=$('[data-choice="'+i+'"]');
 if(i===task.a){
  btn.classList.add('correct');data.wins++;state.streak++;state.hintLevel=0;
  fb.className='feedback show';fb.innerHTML='<b>فهم صحيح.</b> '+task.why;
  setCoach(data.wins>=2?'أثبتت هذه المهارة في موقفين مختلفين. سنفتح المهارة التالية.':'ممتاز. نحتاج دليلًا ثانيًا في موقف مختلف.','تقدم بناءً على دليلين');
  setTimeout(()=>data.wins>=2?reward(skill):render(),700);
 }else{
  btn.classList.add('wrong');data.errors++;state.streak=0;
  fb.className='feedback show retry';fb.innerHTML='<b>هذه الإجابة تكشف موضع التعثر.</b> لن نعيد السؤال نفسه بالطريقة نفسها.';
  adapt(skill.id,data.errors);
 }
 renderMap();$('#streakValue').textContent=state.streak;
}
function adapt(id,errors){
 if(errors===1){state.hintLevel=1;setCoach('تحتاج تلميحًا لفظيًا فقط: اسأل «كيف وقع الفعل؟».','تلميح خفيف')}
 else if(errors===2){state.hintLevel=2;setCoach('سنحوّل الفكرة إلى مقارنة بصرية أبسط، ثم تعود لموقف جديد.','تغيير طريقة العرض');setTimeout(()=>miniLesson(id,false),450)}
 else{state.hintLevel=3;setCoach('سنقسم المهارة إلى خطوة أصغر، ثم نبنيها من جديد.','مسار علاجي دقيق');setTimeout(()=>miniLesson(id,true),450)}
}
function miniLesson(id,deep){
 const copy={
  concept:['الحال تصف الهيئة','دخل خالد مسرعًا','كيف دخل؟ ← مسرعًا'],
  identify:['ابحث عن الوصف وقت الفعل','عاد الطالب فرحًا','كيف عاد؟ ← فرحًا'],
  owner:['من الذي تصفه الحال؟','عاد الطالب فرحًا','فرحًا تصف الطالب'],
  transfer:['اربط الكلمة بوظيفتها','وصل الزائر مبتسمًا','مبتسمًا = هيئة الزائر وقت الوصول']
 }[id];
 $('#scene').innerHTML='<article class="scene-card support-mode"><span class="eyebrow">'+(deep?'علاج مصغر':'شرح بديل')+'</span><h3>'+copy[0]+'</h3><div class="mini-lesson"><div><b>المثال</b><span>'+copy[1]+'</span></div><b>←</b><div><b>المفتاح</b><span>'+copy[2]+'</span></div></div><p>سنرجع الآن إلى سؤال جديد، وليس إلى السؤال الذي أخطأت فيه.</p><div class="continue-row"><button class="action-btn" id="backToTask">جرب موقفًا جديدًا</button></div></article>';
 $('#backToTask').onclick=render;
}
function reward(skill){
 $('#rewardTitle').textContent='أتقنت: '+skill.short;
 $('#rewardText').textContent='لم تعتمد المنصة على إجابة واحدة؛ أثبتت الفهم في موقفين مختلفين.';
 $('#rewardLayer').classList.add('open');
}
$('#rewardContinue').onclick=()=>{$('#rewardLayer').classList.remove('open');state.index++;render()};
$('#hintBtn').onclick=()=>{state.hintLevel=Math.max(state.hintLevel,1);setCoach('التلميح الحالي: اسأل «كيف وقع الفعل؟» ثم ابحث عن الكلمة التي تجيب.','تلميح عند الطلب')};
$('#simplifyBtn').onclick=()=>miniLesson(skills[state.index]?.id||'concept',false);
$('#explainBtn').onclick=()=>miniLesson(skills[state.index]?.id||'concept',true);
function finish(){
 renderMap();$('#stageEyebrow').textContent='بوابة الإنهاء';$('#stageTitle').textContent='أثبتت جميع المهارات المطلوبة';
 $('#whyTitle').textContent='ماذا تعني 100%؟';$('#whyText').textContent='تعني أن كل مهارة مطلوبة لها دليل إتقان. لا تعني ضمان عدم النسيان مستقبلًا.';
 $('#decisionText').textContent='إغلاق الدرس وفتح تحدي النقل';
 $('#scene').innerHTML='<article class="scene-card"><div class="celebration">🏆</div><h2 style="text-align:center">اكتمل إتقان درس الحال</h2><p style="text-align:center">أثبتت الفهم في المفهوم، تحديد الحال، صاحب الحال، والنقل والاستدلال.</p><div class="mastery-grid">'+skills.map(s=>'<div><b>100%</b><span>'+s.short+'</span></div>').join('')+'</div></article>';
}
render();
})();