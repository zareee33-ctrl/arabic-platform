(()=>{'use strict';
const qs=(s)=>document.querySelector(s),qsa=(s)=>[...document.querySelectorAll(s)];
const state={answers:{},score:0,path:null,practiceAttempts:0,masteryPassed:false};
const diagnostic=[
 {q:'في الجملة «دخل الطالبُ مسرعًا»، أي كلمة تصف هيئة الطالب؟',options:['دخل','الطالب','مسرعًا','لا يوجد'],answer:'مسرعًا'},
 {q:'صاحب الحال في «عاد اللاعبُ فرحًا» هو:',options:['عاد','اللاعب','فرحًا','هو'],answer:'اللاعب'},
 {q:'أي جملة توظف الحال بصورة صحيحة؟',options:['وصل المسافرُ متعبًا','وصل المتعبُ المسافر','المسافر متعب وصل','وصل متعبٌ المسافر'],answer:'وصل المسافرُ متعبًا'}
];
const progress={diagnostic:10,path:30,practice:60,mastery:85,next:100};
function setStep(id){
 qsa('.step-panel').forEach(x=>x.classList.toggle('active',x.id==='step-'+id));
 qsa('[data-step]').forEach(x=>x.classList.toggle('active',x.dataset.step===id));
 const p=progress[id]||10;qs('#progressValue').textContent=p+'%';qs('#progressRing').style.background='conic-gradient(var(--green2) '+(p*3.6)+'deg,#dbe7e1 0)';
 window.scrollTo({top:0,behavior:'smooth'});
}
function unlock(id){qs('[data-step="'+id+'"]').classList.remove('locked')}
function renderDiagnostic(){
 qs('#diagnosticQuestions').innerHTML=diagnostic.map((x,i)=>'<article class="q-card" data-i="'+i+'"><h3>'+(i+1)+'. '+x.q+'</h3><div class="choice-grid">'+x.options.map(o=>'<button type="button" data-v="'+o+'">'+o+'</button>').join('')+'</div></article>').join('');
 qsa('.q-card button').forEach(b=>b.onclick=()=>{const c=b.closest('.q-card'),i=+c.dataset.i;c.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.answers[i]=b.dataset.v});
}
function choosePath(){
 if(Object.keys(state.answers).length<diagnostic.length){qs('#diagnosticMessage').textContent='أجب عن الأسئلة الثلاثة أولًا.';return}
 state.score=diagnostic.reduce((n,x,i)=>n+(state.answers[i]===x.answer?1:0),0);
 state.path=state.score<=1?'support':state.score===2?'standard':'challenge';
 const cfg={
  support:{title:'مسار الدعم الذكي',desc:'سنبدأ بمثال أبسط، ثم نجزئ المهارة إلى خطوات قصيرة مع تلميحات متدرجة.',why:'احتجت دعمًا في أكثر من جزئية، لذلك سنبني الفكرة دون استعجال.',features:[['شرح مصغر','جملة واحدة في كل خطوة'],['تلميحات','قبل إظهار الإجابة'],['تكرار ذكي','أمثلة مختلفة لا السؤال نفسه']]},
  standard:{title:'المسار القياسي المتكيف',desc:'لديك أساس جيد؛ سنركز على التطبيق ثم نتحقق من قدرتك على الاستدلال.',why:'أجبت عن معظم التشخيص بصورة صحيحة.',features:[['اكتشاف','قبل عرض القاعدة'],['تطبيق','سياق جديد'],['استدلال','لماذا هذه حال؟']]},
  challenge:{title:'مسار التحدي',desc:'أظهرت إتقانًا أوليًا، لذلك لن نكرر السهل وسننتقل مباشرة إلى التفسير والتوظيف.',why:'أتقنت التشخيص القبلي بالكامل.',features:[['اختصار','تجاوز التكرار السهل'],['تعليل','تفسير صحة الإجابة'],['إنتاج','إنشاء مثال من عندك']]}
 }[state.path];
 qs('#pathResult').innerHTML='<article class="path-card '+state.path+'"><span class="badge">اختيار آلي قابل للتغير</span><h2>'+cfg.title+'</h2><p>'+cfg.desc+'</p><div class="why-box"><b>لماذا هذا المسار؟</b>'+cfg.why+'</div><div class="path-features">'+cfg.features.map(f=>'<div><b>'+f[0]+'</b><span>'+f[1]+'</span></div>').join('')+'</div><button class="primary" id="startPath">ابدأ التعلم</button></article>';
 unlock('path');unlock('practice');setStep('path');qs('#adaptiveStatus').textContent=cfg.title;
 qs('#startPath').onclick=()=>{renderPractice();setStep('practice')};
}
function renderPractice(){
 const support=state.path==='support';
 const challenge=state.path==='challenge';
 qs('#practiceContent').innerHTML='<article class="practice-card"><div class="section-head"><div><span class="eyebrow">تعلم نشط</span><h2>'+(support?'نبني الفكرة خطوة خطوة':challenge?'اختبر فهمك في سياق جديد':'اكتشف ثم طبّق')+'</h2></div><span class="badge">'+(support?'دعم موجه':challenge?'تحدٍ':'تطبيق')+'</span></div><div class="mode-switch"><button class="active" data-mode="visual">شرح بصري</button><button data-mode="short">شرح مختصر</button><button data-mode="listen">استمع</button></div><div id="modeContent" class="micro-lesson"></div><div class="practice-action"><h3>جرّب الآن: «وقف الحارسُ منتبهًا»</h3><p>ما الحال في الجملة؟</p><div class="choice-grid" id="practiceChoices"><button>وقف</button><button>الحارس</button><button>منتبهًا</button><button>لا يوجد</button></div><div class="hint-row"><button class="secondary" id="hintBtn">أعطني تلميحًا</button><button class="secondary" id="exampleBtn">مثال آخر</button></div><div id="practiceFeedback" class="feedback"></div></div></article>';
 renderMode('visual');
 qsa('[data-mode]').forEach(b=>b.onclick=()=>{qsa('[data-mode]').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderMode(b.dataset.mode)});
 qsa('#practiceChoices button').forEach(b=>b.onclick=()=>{state.practiceAttempts++;qsa('#practiceChoices button').forEach(x=>x.classList.remove('correct','wrong'));const fb=qs('#practiceFeedback');fb.classList.add('show');if(b.textContent==='منتبهًا'){b.classList.add('correct');fb.className='feedback show good';fb.innerHTML='<b>أحسنت.</b> اسأل: كيف وقف الحارس؟ منتبهًا. الآن سننتقل للتحقق من الفهم.';unlock('mastery');setTimeout(()=>setStep('mastery'),700)}else{b.classList.add('wrong');fb.className='feedback show retry';fb.innerHTML='<b>محاولة جيدة.</b> ابحث عن الكلمة التي تصف هيئة الحارس وقت الوقوف.'}});
 qs('#hintBtn').onclick=()=>{qs('#practiceFeedback').className='feedback show retry';qs('#practiceFeedback').textContent='التلميح: اسأل «كيف وقف الحارس؟» ثم ابحث عن الإجابة داخل الجملة.'};
 qs('#exampleBtn').onclick=()=>openSupport();
}
function renderMode(mode){
 const host=qs('#modeContent');
 if(mode==='visual')host.innerHTML='<div class="visual-map"><div><b>الفعل</b><span>دخل</span></div><b>← كيف؟ →</b><div><b>الحال</b><span>مسرعًا</span></div></div><div class="sentence">دخل خالدٌ <u>مسرعًا</u>.</div><p>الحال يصف هيئة صاحبه وقت حدوث الفعل.</p>';
 if(mode==='short')host.innerHTML='<p><b>القاعدة في سطر واحد:</b> الحال اسم نكرة منصوب يبين هيئة صاحبه وقت وقوع الفعل.</p><p><b>مفتاح الحل:</b> اسأل «كيف وقع الفعل؟».</p>';
 if(mode==='listen'){host.innerHTML='<p>اضغط للاستماع إلى شرح قصير. الصوت يعتمد على الأصوات المتاحة في جهازك.</p><button class="primary" id="speakBtn">تشغيل الشرح</button>';qs('#speakBtn').onclick=()=>{if('speechSynthesis'in window){const u=new SpeechSynthesisUtterance('الحال كلمة تبين هيئة صاحبها وقت وقوع الفعل. لمعرفة الحال اسأل: كيف وقع الفعل؟');u.lang='ar-SA';speechSynthesis.cancel();speechSynthesis.speak(u)}}}
}
function mastery(){
 qsa('#masteryChoices button').forEach(b=>b.onclick=()=>{qsa('#masteryChoices button').forEach(x=>x.classList.remove('correct','wrong'));const ok=b.dataset.correct==='1';b.classList.add(ok?'correct':'wrong');const fb=qs('#masteryFeedback');fb.classList.add('show');if(ok){state.masteryPassed=true;fb.className='feedback show good';fb.innerHTML='<b>إتقان صحيح.</b> أنت لم تحفظ الكلمة فقط؛ بل فسرت وظيفتها في السياق.';unlock('next');renderNext(true);setTimeout(()=>setStep('next'),750)}else{fb.className='feedback show retry';fb.innerHTML='<b>نحتاج خطوة دعم صغيرة.</b> سنعيد فكرة «كيف وقع الفعل؟» بمثال مختلف ثم تعود لسؤال جديد.';renderNext(false);unlock('next');setTimeout(()=>setStep('next'),900)}})
}
function renderNext(passed){
 qs('#nextContent').innerHTML=passed?
 '<article class="next-card success"><span class="badge">تم الإتقان</span><h2>أحسنت، أصبحت جاهزًا للانتقال</h2><p>أظهرت فهمًا في التعرف على الحال وتفسير سبب استخدامه. يمكنك الآن الانتقال إلى إثراء قصير بدل تكرار الأسئلة السهلة.</p><div class="reward"><div class="reward-icon">🏅</div><div><b>شارة: فهمت وفسرت</b><p>المكافأة مرتبطة بالإتقان، لا بعدد النقرات أو الوقت.</p></div></div><button class="primary">ابدأ التحدي الإثرائي</button></article>':
 '<article class="next-card support"><span class="badge">مسار دعم</span><h2>بقيت خطوة واحدة قبل الإتقان</h2><p>المفهوم الأساسي موجود، لكنك تحتاج تدريبًا إضافيًا على تفسير لماذا تكون الكلمة حالًا. لن نعيد الدرس كاملًا.</p><div class="why-box"><b>الخطة الآن</b>مثال أبسط → سؤال مشابه جديد → تحقق قصير من الاستدلال.</div><button class="primary" id="retrySupport">ابدأ العلاج الموجّه</button></article>';
 if(!passed)qs('#retrySupport').onclick=()=>{openSupport();setTimeout(()=>setStep('mastery'),400)};
 qs('#adaptiveStatus').textContent=passed?'متقن • جاهز للإثراء':'علاج موجه • لا إعادة كاملة للدرس';
}
function openSupport(){qs('#supportModal').classList.add('open');qs('#supportModal').setAttribute('aria-hidden','false')}
function closeSupport(){qs('#supportModal').classList.remove('open');qs('#supportModal').setAttribute('aria-hidden','true')}
renderDiagnostic();mastery();
qs('#finishDiagnostic').onclick=choosePath;
qs('#helpBtn').onclick=openSupport;qs('#exampleBtn')?.addEventListener('click',openSupport);
qs('#closeSupport').onclick=closeSupport;qs('#supportDone').onclick=closeSupport;
qsa('[data-step]').forEach(b=>b.onclick=()=>{if(!b.classList.contains('locked'))setStep(b.dataset.step)});
})();