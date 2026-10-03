import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const db=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false}});
const ALLOWED_ORIGINS=new Set(["https://zareee33-ctrl.github.io","http://localhost:8000","http://127.0.0.1:8000"]);

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  const allow=ALLOWED_ORIGINS.has(origin)?origin:"https://zareee33-ctrl.github.io";
  return {
    "Access-Control-Allow-Origin":allow,
    "Vary":"Origin",
    "Access-Control-Allow-Headers":"authorization,content-type",
    "Access-Control-Allow-Methods":"POST,OPTIONS",
    "Content-Type":"application/json"
  };
}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)})}
function bytesToB64(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}
async function sha256Text(text:string){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return bytesToB64(new Uint8Array(h))}
async function authAccount(req:Request){
  const h=req.headers.get("Authorization")||"";
  if(!h.startsWith("Bearer "))return null;
  const raw=h.slice(7).trim(); if(!raw)return null;
  const tokenHash=await sha256Text(raw);
  const {data:session}=await db.from("app_sessions").select("account_id,expires_at").eq("token_hash",tokenHash).maybeSingle();
  if(!session||new Date(session.expires_at).getTime()<=Date.now())return null;
  const {data:account}=await db.from("app_accounts").select("id,login_code,role,full_name,is_active").eq("id",session.account_id).eq("is_active",true).maybeSingle();
  return account||null;
}
const normalize=(s:string)=>s.trim().replace(/\s+/g," ").replace(/[إأآ]/g,"ا").replace(/ى/g,"ي");
function interventionType(word:string){
  const w=normalize(word);
  if(w.includes("علاج"))return "remedial";
  if(w.includes("اثراء"))return "enrichment";
  if(w.includes("تحد"))return "challenge";
  return "support";
}
function parseArabicCommand(raw:string){
  const original=raw.trim(), n=normalize(original);
  let m:RegExpMatchArray|null;
  if(/^(اختبر|افحص)\s+(النظام|المنصه)$/.test(n))return {type:"system.smoke_test",payload:{}};
  m=n.match(/^(افتح|انشر)\s+درس\s+(.+)$/);
  if(m)return {type:"lesson.set_published",payload:{lesson_ref:m[2],published:true}};
  m=n.match(/^(اغلق|اقفل|اخف|اوقف)\s+درس\s+(.+)$/);
  if(m)return {type:"lesson.set_published",payload:{lesson_ref:m[2],published:false}};
  m=n.match(/^(?:غير|اضبط|اجعل)\s+(?:حد\s+)?الاتقان\s+(?:لدرس\s+)?(.+?)\s+(?:الي|=)\s*(\d{1,3})\s*%?$/);
  if(m)return {type:"lesson.set_mastery_threshold",payload:{lesson_ref:m[1],threshold:Number(m[2])}};
  m=n.match(/^(عطل|اوقف)\s+(?:الطالب\s+)?([a-zA-Z0-9_-]+)$/);
  if(m)return {type:"student.set_active",payload:{student_code:m[2].toUpperCase(),active:false}};
  m=n.match(/^(فعل)\s+(?:الطالب\s+)?([a-zA-Z0-9_-]+)$/);
  if(m)return {type:"student.set_active",payload:{student_code:m[2].toUpperCase(),active:true}};
  m=n.match(/^(?:سجل\s+خروج|اخرج)\s+(?:الطالب\s+)?([a-zA-Z0-9_-]+)$/);
  if(m)return {type:"account.revoke_sessions",payload:{student_code:m[1].toUpperCase()}};
  m=n.match(/^(?:اسند|ارسل)\s+(علاج|تعزيز|اثراء|تحدي)\s+(?:درس\s+)?(.+?)\s+(?:للطالب|ل)\s+([a-zA-Z0-9_-]+)$/);
  if(m)return {type:"student.assign_intervention",payload:{intervention_type:interventionType(m[1]),lesson_ref:m[2],student_code:m[3].toUpperCase()}};
  return null;
}
async function resolveLesson(ref:string){
  const key=ref.trim();
  const {data:byCode}=await db.from("lessons").select("*").eq("code",key.toUpperCase()).maybeSingle();
  if(byCode)return byCode;
  const {data:rows}=await db.from("lessons").select("*").ilike("title",`%${key}%`).limit(2);
  if(!rows?.length)throw new Error("lesson_not_found");
  if(rows.length>1)throw new Error("lesson_ambiguous");
  return rows[0];
}
async function resolveStudent(code:string){
  const {data}=await db.from("app_accounts").select("id,login_code,full_name,is_active,role").eq("login_code",code.toUpperCase()).eq("role","student").maybeSingle();
  if(!data)throw new Error("student_not_found");
  return data;
}
async function event(commandId:string,eventType:string,message:string,details:Record<string,unknown>={},level="info"){
  await db.from("command_events").insert({command_id:commandId,event_type:eventType,message,details,level});
}
async function executeCommand(actor:any,type:string,payload:any){
  if(type==="system.smoke_test"){
    const [{count:students},{count:lessons},{count:sessions}]=await Promise.all([
      db.from("app_accounts").select("id",{count:"exact",head:true}).eq("role","student"),
      db.from("lessons").select("id",{count:"exact",head:true}),
      db.from("app_sessions").select("token_hash",{count:"exact",head:true}).gt("expires_at",new Date().toISOString())
    ]);
    return {before:null,result:{ok:true,students:students||0,lessons:lessons||0,active_sessions:sessions||0}};
  }
  if(type==="lesson.set_published"){
    const lesson=await resolveLesson(String(payload.lesson_ref||payload.lesson_code||""));
    const value=Boolean(payload.published);
    const before={lesson_id:lesson.id,code:lesson.code,title:lesson.title,is_published:lesson.is_published};
    const {data,error}=await db.from("lessons").update({is_published:value}).eq("id",lesson.id).select("id,code,title,is_published").single();
    if(error)throw error;
    return {before,result:{lesson:data}};
  }
  if(type==="lesson.set_mastery_threshold"){
    const threshold=Number(payload.threshold);
    if(!Number.isInteger(threshold)||threshold<50||threshold>100)throw new Error("invalid_mastery_threshold");
    const lesson=await resolveLesson(String(payload.lesson_ref||payload.lesson_code||""));
    const before={lesson_id:lesson.id,code:lesson.code,title:lesson.title,mastery_threshold:lesson.mastery_threshold};
    const {data,error}=await db.from("lessons").update({mastery_threshold:threshold}).eq("id",lesson.id).select("id,code,title,mastery_threshold").single();
    if(error)throw error;
    return {before,result:{lesson:data}};
  }
  if(type==="student.set_active"){
    const student=await resolveStudent(String(payload.student_code||""));
    const value=Boolean(payload.active);
    const before={student_id:student.id,login_code:student.login_code,is_active:student.is_active};
    const {data,error}=await db.from("app_accounts").update({is_active:value}).eq("id",student.id).select("id,login_code,full_name,is_active").single();
    if(error)throw error;
    if(!value)await db.from("app_sessions").delete().eq("account_id",student.id);
    return {before,result:{student:data,sessions_revoked:!value}};
  }
  if(type==="account.revoke_sessions"){
    const student=await resolveStudent(String(payload.student_code||""));
    const {count}=await db.from("app_sessions").select("token_hash",{count:"exact",head:true}).eq("account_id",student.id);
    const {error}=await db.from("app_sessions").delete().eq("account_id",student.id);
    if(error)throw error;
    return {before:null,result:{student_code:student.login_code,revoked_sessions:count||0,rollback_supported:false}};
  }
  if(type==="student.assign_intervention"){
    const student=await resolveStudent(String(payload.student_code||""));
    const lesson=await resolveLesson(String(payload.lesson_ref||payload.lesson_code||""));
    const t=String(payload.intervention_type||"support");
    if(!["support","remedial","enrichment","challenge"].includes(t))throw new Error("invalid_intervention_type");
    const {data,error}=await db.from("student_interventions").insert({
      student_id:student.id,lesson_id:lesson.id,intervention_type:t,
      note:String(payload.note||""),assigned_by:actor.id,status:"assigned"
    }).select("id,student_id,lesson_id,intervention_type,note,status,created_at").single();
    if(error)throw error;
    return {before:null,result:{intervention:data,student:{login_code:student.login_code,full_name:student.full_name},lesson:{code:lesson.code,title:lesson.title}}};
  }
  throw new Error("unsupported_command");
}
async function rollbackCommand(actor:any,job:any){
  const before=job.before_snapshot||{};
  if(job.command_type==="lesson.set_published"){
    const {data,error}=await db.from("lessons").update({is_published:Boolean(before.is_published)}).eq("id",before.lesson_id).select("id,code,title,is_published").single();
    if(error)throw error; return {lesson:data};
  }
  if(job.command_type==="lesson.set_mastery_threshold"){
    const {data,error}=await db.from("lessons").update({mastery_threshold:Number(before.mastery_threshold)}).eq("id",before.lesson_id).select("id,code,title,mastery_threshold").single();
    if(error)throw error; return {lesson:data};
  }
  if(job.command_type==="student.set_active"){
    const {data,error}=await db.from("app_accounts").update({is_active:Boolean(before.is_active)}).eq("id",before.student_id).select("id,login_code,full_name,is_active").single();
    if(error)throw error; return {student:data};
  }
  if(job.command_type==="student.assign_intervention"){
    const interventionId=job.result?.intervention?.id;
    if(!interventionId)throw new Error("rollback_not_available");
    const {data,error}=await db.from("student_interventions").update({status:"cancelled"}).eq("id",interventionId).select("*").single();
    if(error)throw error; return {intervention:data};
  }
  throw new Error("rollback_not_supported");
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
  const actor=await authAccount(req);
  if(!actor)return json(req,{error:"unauthorized"},401);
  if(!["teacher","admin"].includes(actor.role))return json(req,{error:"forbidden"},403);

  try{
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"execute");

    if(action==="logs"){
      const limit=Math.max(1,Math.min(Number(body.limit||25),100));
      const {data,error}=await db.from("command_jobs").select("id,raw_command,command_type,payload,status,result,error_code,error_message,created_at,started_at,finished_at,rolled_back_at").order("created_at",{ascending:false}).limit(limit);
      if(error)throw error;
      return json(req,{commands:data||[]});
    }

    if(action==="rollback"){
      const id=String(body.command_id||"");
      const {data:job}=await db.from("command_jobs").select("*").eq("id",id).maybeSingle();
      if(!job)return json(req,{error:"command_not_found"},404);
      if(job.status!=="succeeded")return json(req,{error:"command_not_rollbackable"},409);
      try{
        const result=await rollbackCommand(actor,job);
        await db.from("command_jobs").update({status:"rolled_back",rolled_back_at:new Date().toISOString()}).eq("id",id);
        await event(id,"rolled_back","تم التراجع عن الأمر",result);
        return json(req,{ok:true,command_id:id,status:"rolled_back",result});
      }catch(e){
        return json(req,{error:e instanceof Error?e.message:String(e)},400);
      }
    }

    const raw=String(body.command||"").trim();
    const parsed=body.type?{type:String(body.type),payload:body.payload||{}}:parseArabicCommand(raw);
    if(!parsed)return json(req,{error:"unrecognized_command",supported_examples:[
      "افتح درس الحال","أغلق درس HAL-01","غيّر الإتقان لدرس الحال إلى 85",
      "عطّل الطالب S3A001","فعّل الطالب S3A001","أسند علاج درس الحال للطالب S3A001","اختبر النظام"
    ]},400);

    const key=String(body.idempotency_key||crypto.randomUUID());
    const {data:existing}=await db.from("command_jobs").select("*").eq("idempotency_key",key).maybeSingle();
    if(existing)return json(req,{ok:existing.status==="succeeded",replayed:true,command:existing});

    const {data:job,error:insertError}=await db.from("command_jobs").insert({
      idempotency_key:key,actor_id:actor.id,actor_role:actor.role,raw_command:raw||null,
      command_type:parsed.type,payload:parsed.payload,status:"running",started_at:new Date().toISOString()
    }).select("*").single();
    if(insertError)throw insertError;
    await event(job.id,"accepted","تم قبول الأمر وبدء التنفيذ",{type:parsed.type,payload:parsed.payload});

    try{
      const out=await executeCommand(actor,parsed.type,parsed.payload);
      const finished=new Date().toISOString();
      const {data:done,error:updateError}=await db.from("command_jobs").update({
        status:"succeeded",before_snapshot:out.before,result:out.result,finished_at:finished
      }).eq("id",job.id).select("*").single();
      if(updateError)throw updateError;
      await event(job.id,"succeeded","تم تنفيذ الأمر بنجاح",out.result);
      return json(req,{ok:true,command:done});
    }catch(e){
      const code=e instanceof Error?e.message:"command_failed";
      await db.from("command_jobs").update({status:"failed",error_code:code,error_message:code,finished_at:new Date().toISOString()}).eq("id",job.id);
      await event(job.id,"failed","فشل تنفيذ الأمر",{error:code},"error");
      return json(req,{ok:false,command_id:job.id,error:code},400);
    }
  }catch(e){
    return json(req,{error:"server_error",detail:e instanceof Error?e.message:String(e)},500);
  }
});