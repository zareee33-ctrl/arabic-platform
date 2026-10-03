(()=>{'use strict';
const API_URL='https://txvhzcrtqrbbyqqmkusr.supabase.co/functions/v1/tamakkun-api';
const SESSION_KEY='tamakkun_session_v1';
function getSession(){try{const s=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(!s||!s.token||!s.user)return null;if(s.expires_at&&new Date(s.expires_at).getTime()<=Date.now()){localStorage.removeItem(SESSION_KEY);return null}return s}catch{return null}}
function setSession(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s))}
function clearSession(){localStorage.removeItem(SESSION_KEY)}
async function request(action,payload={},auth=true){const s=getSession();const headers={'Content-Type':'application/json'};if(auth&&s?.token)headers.Authorization='Bearer '+s.token;const res=await fetch(API_URL,{method:'POST',headers,body:JSON.stringify({action,...payload})});const data=await res.json().catch(()=>({error:'invalid_response'}));if(res.status===401)clearSession();if(!res.ok)throw new Error(data.error||data.detail||'request_failed');return data}
async function login(code,password){const data=await request('login',{code,password},false);setSession({token:data.token,expires_at:data.expires_at,user:data.user});return data}
async function logout(){try{await request('logout')}catch{}clearSession()}
function requireRole(role,loginPage){const s=getSession();if(!s||s.user.role!==role){location.href=loginPage;return null}return s}
window.TamakkunAPI={getSession,clearSession,login,logout,requireRole,request,
studentSnapshot:()=>request('student_snapshot'),
teacherSnapshot:()=>request('teacher_snapshot'),
studentProfile:(student_id)=>request('student_profile',{student_id}),
saveProgress:(p)=>request('save_progress',p),
saveLearning:(p)=>request('save_learning',p),
addPortfolio:(p)=>request('add_portfolio',p),
submitPaper:(p)=>request('submit_paper',p),
reviewSubmission:(p)=>request('review_submission',p),
createStudent:(p)=>request('create_student',p)};
})();