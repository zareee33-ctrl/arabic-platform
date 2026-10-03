import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function bytesToB64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function bytesToB64Url(bytes: Uint8Array) {
  return bytesToB64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
async function sha256Text(text: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToB64(new Uint8Array(hash));
}
async function passwordHash(password: string, saltB64: string, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: b64ToBytes(saltB64), iterations },
    keyMaterial, 256
  );
  return bytesToB64(new Uint8Array(bits));
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
function cleanAccount(a: any) {
  return { id:a.id, login_code:a.login_code, role:a.role, full_name:a.full_name, grade:a.grade, class_name:a.class_name };
}
async function loginKey(req: Request) {
  const rawIp=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim();
  return await sha256Text(rawIp);
}
async function isLoginBlocked(code: string, ipHash: string) {
  const since=new Date(Date.now()-10*60*1000).toISOString();
  const { count }=await db.from("login_attempts").select("id",{count:"exact",head:true})
    .eq("login_code",code).eq("ip_hash",ipHash).eq("succeeded",false).gte("attempted_at",since);
  return (count||0)>=5;
}
async function recordLoginAttempt(code: string, ipHash: string, succeeded: boolean) {
  await db.from("login_attempts").insert({login_code:code,ip_hash:ipHash,succeeded});
  if(succeeded){
    await db.from("login_attempts").delete().eq("login_code",code).eq("ip_hash",ipHash).eq("succeeded",false);
  }
}
async function authAccount(req: Request) {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const raw = h.slice(7).trim();
  if (!raw) return null;
  const tokenHash = await sha256Text(raw);
  const { data: session } = await db.from("app_sessions")
    .select("account_id,expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null;
  const { data: account } = await db.from("app_accounts")
    .select("*").eq("id", session.account_id).eq("is_active", true).maybeSingle();
  return account || null;
}
async function signPath(path: string | null) {
  if (!path) return null;
  const { data } = await db.storage.from("student-files").createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}
async function decoratePortfolio(rows: any[]) {
  return await Promise.all((rows || []).map(async r => ({...r, image_url: await signPath(r.storage_path)})));
}
async function decoratePapers(rows: any[]) {
  return await Promise.all((rows || []).map(async r => ({
    ...r,
    original_url: await signPath(r.original_storage_path),
    corrected_url: await signPath(r.corrected_storage_path)
  })));
}
function parseDataUrl(dataUrl: string) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!m) throw new Error("invalid_image");
  const mime = m[1];
  const bytes = b64ToBytes(m[2]);
  if (bytes.length > 4_000_000) throw new Error("image_too_large");
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { mime, bytes, ext };
}
async function uploadImage(studentId: string, kind: string, dataUrl: string) {
  const { mime, bytes, ext } = parseDataUrl(dataUrl);
  const path = `${studentId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from("student-files").upload(path, bytes, { contentType:mime, upsert:false });
  if (error) throw error;
  return path;
}
async function studentSnapshot(studentId: string) {
  const [{ data: progress }, { data: learning }, { data: portfolio }, { data: papers }, { data: interventions }] = await Promise.all([
    db.from("student_lesson_progress").select("*,lessons(code,title,unit_title,lesson_type,goal,mastery_threshold)").eq("student_id", studentId).order("started_at"),
    db.from("student_learning_preferences").select("*").eq("student_id", studentId).maybeSingle(),
    db.from("student_portfolio_items").select("*,lessons(code,title)").eq("student_id", studentId).order("created_at", { ascending:false }),
    db.from("paper_submissions").select("*,lessons(code,title)").eq("student_id", studentId).order("created_at", { ascending:false }),
    db.from("student_interventions").select("id,intervention_type,note,status,created_at,lessons(code,title)").eq("student_id",studentId).in("status",["assigned","in_progress"]).order("created_at",{ascending:false})
  ]);
  return {
    progress: progress || [],
    learning: learning || null,
    portfolio: await decoratePortfolio(portfolio || []),
    papers: await decoratePapers(papers || []),
    interventions: interventions || []
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error:"method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "login") {
      const code = String(body.code || "").trim().toUpperCase();
      const password = String(body.password || "");
      if (!code || !password) return json({ error:"missing_credentials" }, 400);
      const ipHash=await loginKey(req);
      if(await isLoginBlocked(code,ipHash)) return json({ error:"too_many_attempts" },429);
      const { data: account } = await db.from("app_accounts").select("*")
        .eq("login_code", code).eq("is_active", true).maybeSingle();
      if (!account) { await recordLoginAttempt(code,ipHash,false); return json({ error:"invalid_credentials" }, 401); }
      const computed = await passwordHash(password, account.password_salt, account.password_iterations);
      if (!safeEq(computed, account.password_hash)) { await recordLoginAttempt(code,ipHash,false); return json({ error:"invalid_credentials" }, 401); }
      await recordLoginAttempt(code,ipHash,true);
      const rawToken = bytesToB64Url(crypto.getRandomValues(new Uint8Array(32)));
      const tokenHash = await sha256Text(rawToken);
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.from("app_sessions").delete().lt("expires_at", new Date().toISOString());
      const { error } = await db.from("app_sessions").insert({ token_hash:tokenHash, account_id:account.id, expires_at:expires });
      if (error) throw error;
      return json({ token:rawToken, expires_at:expires, user:cleanAccount(account) });
    }

    const account = await authAccount(req);
    if (!account) return json({ error:"unauthorized" }, 401);

    if (action === "logout") {
      const raw = (req.headers.get("Authorization") || "").slice(7).trim();
      if (raw) await db.from("app_sessions").delete().eq("token_hash", await sha256Text(raw));
      return json({ ok:true });
    }
    if (action === "me") return json({ user:cleanAccount(account) });

    if (action === "student_snapshot") {
      if (account.role !== "student") return json({ error:"forbidden" }, 403);
      return json({ user:cleanAccount(account), ...(await studentSnapshot(account.id)) });
    }

    if (action === "lesson_access") {
      if (account.role !== "student") return json({ error:"forbidden" }, 403);
      const code=String(body.lesson_code||"").trim().toUpperCase();
      const {data:lesson}=await db.from("lessons").select("id,code,title,unit_title,lesson_type,goal,mastery_threshold,is_published").eq("code",code).maybeSingle();
      if(!lesson)return json({error:"lesson_not_found"},404);
      if(!lesson.is_published)return json({error:"lesson_closed",lesson:{code:lesson.code,title:lesson.title}},403);
      return json({lesson});
    }

    if (action === "save_progress") {
      if (account.role !== "student") return json({ error:"forbidden" }, 403);
      const lessonCode = String(body.lesson_code || "").trim().toUpperCase();
      const { data: lesson } = await db.from("lessons").select("*").eq("code", lessonCode).maybeSingle();
      if (!lesson) return json({ error:"lesson_not_found" }, 404);
      const row = {
        student_id:account.id, lesson_id:lesson.id,
        score:body.score ?? null,
        knowledge_percent:body.knowledge_percent ?? null,
        application_percent:body.application_percent ?? null,
        reasoning_percent:body.reasoning_percent ?? null,
        status:body.status || "in_progress",
        kwl_k:body.kwl_k ?? null, kwl_w:body.kwl_w ?? null, kwl_l:body.kwl_l ?? null,
        last_attempt_at:new Date().toISOString()
      };
      const { error } = await db.from("student_lesson_progress").upsert(row, { onConflict:"student_id,lesson_id" });
      if (error) throw error;
      return json({ ok:true });
    }

    if (action === "save_learning") {
      if (account.role !== "student") return json({ error:"forbidden" }, 403);
      const row = {
        student_id:account.id,
        responses:body.responses || {},
        visual_score:Number(body.visual_score || 0),
        verbal_score:Number(body.verbal_score || 0),
        active_score:Number(body.active_score || 0),
        primary_preference:body.primary_preference || null,
        updated_at:new Date().toISOString()
      };
      const { error } = await db.from("student_learning_preferences").upsert(row, { onConflict:"student_id" });
      if (error) throw error;
      return json({ ok:true });
    }

    if (action === "add_portfolio") {
      if (account.role !== "student") return json({ error:"forbidden" }, 403);
      const title = String(body.title || "").trim();
      const category = String(body.category || "").trim();
      if (!title || !category || !body.image_data_url) return json({ error:"missing_fields" }, 400);
      let lessonId = null;
      if (body.lesson_code) {
        const { data:l } = await db.from("lessons").select("id").eq("code", String(body.lesson_code).toUpperCase()).maybeSingle();
        lessonId = l?.id || null;
      }
      const path = await uploadImage(account.id, "portfolio", String(body.image_data_url));
      const { data, error } = await db.from("student_portfolio_items").insert({
        student_id:account.id, lesson_id:lessonId, title, category,
        reflection:String(body.reflection || ""), storage_path:path
      }).select("*").single();
      if (error) throw error;
      return json({ item:{...data,image_url:await signPath(path)} });
    }

    if (action === "submit_paper") {
      if (account.role !== "student") return json({ error:"forbidden" }, 403);
      const lessonCode = String(body.lesson_code || "").toUpperCase();
      const { data:l } = await db.from("lessons").select("id,title,code").eq("code",lessonCode).maybeSingle();
      if (!l) return json({ error:"lesson_not_found" }, 404);
      const path = await uploadImage(account.id, "papers", String(body.image_data_url));
      const { data, error } = await db.from("paper_submissions").insert({
        student_id:account.id, lesson_id:l.id, work_type:String(body.work_type || "ورقة عمل"),
        original_storage_path:path, status:"pending"
      }).select("*").single();
      if (error) throw error;
      return json({ item:{...data,lessons:l,original_url:await signPath(path)} });
    }

    if (!["teacher","admin"].includes(account.role)) return json({ error:"forbidden" }, 403);

    if (action === "teacher_snapshot") {
      const { data: students } = await db.from("app_accounts").select("id,login_code,full_name,grade,class_name,is_active,created_at")
        .eq("role","student").order("full_name");
      const ids=(students||[]).map(s=>s.id);
      if(!ids.length) return json({students:[]});
      const [{data:progress},{data:learning},{data:portfolio},{data:papers}] = await Promise.all([
        db.from("student_lesson_progress").select("*,lessons(code,title,unit_title,lesson_type,goal,mastery_threshold)").in("student_id",ids),
        db.from("student_learning_preferences").select("*").in("student_id",ids),
        db.from("student_portfolio_items").select("*,lessons(code,title)").in("student_id",ids).order("created_at",{ascending:false}),
        db.from("paper_submissions").select("*,lessons(code,title)").in("student_id",ids).order("created_at",{ascending:false})
      ]);
      const portfolios=await decoratePortfolio(portfolio||[]);
      const paperRows=await decoratePapers(papers||[]);
      const by=(rows:any[],id:string)=>rows.filter(r=>r.student_id===id);
      const out=(students||[]).map(s=>({
        student:s,
        progress:by(progress||[],s.id),
        learning:(learning||[]).find(x=>x.student_id===s.id)||null,
        portfolio:by(portfolios,s.id),
        papers:by(paperRows,s.id)
      }));
      return json({ students:out });
    }

    if (action === "student_profile") {
      const studentId = String(body.student_id || "");
      const { data:s } = await db.from("app_accounts").select("id,login_code,full_name,grade,class_name,is_active")
        .eq("id",studentId).eq("role","student").maybeSingle();
      if (!s) return json({ error:"student_not_found" }, 404);
      return json({ student:s, ...(await studentSnapshot(s.id)) });
    }

    if (action === "review_submission") {
      const id = String(body.submission_id || "");
      const { data:sub } = await db.from("paper_submissions").select("*").eq("id",id).maybeSingle();
      if (!sub) return json({ error:"submission_not_found" }, 404);
      let corrected = sub.corrected_storage_path;
      if (body.corrected_image_data_url) corrected = await uploadImage(sub.student_id, "corrected", String(body.corrected_image_data_url));
      const status = ["approved","needs_revision"].includes(body.status) ? body.status : "needs_revision";
      const { data, error } = await db.from("paper_submissions").update({
        status, teacher_note:String(body.teacher_note || ""), corrected_storage_path:corrected, reviewed_at:new Date().toISOString()
      }).eq("id",id).select("*").single();
      if (error) throw error;
      return json({ item:{...data,corrected_url:await signPath(corrected),original_url:await signPath(data.original_storage_path)} });
    }

    if (action === "create_student") {
      const code = String(body.code || "").trim().toUpperCase();
      const password = String(body.password || "");
      const name = String(body.full_name || "").trim();
      if (!code || password.length < 6 || !name) return json({ error:"invalid_student_data" }, 400);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltB64 = bytesToB64(salt);
      const iterations = 210000;
      const hash = await passwordHash(password, saltB64, iterations);
      const { data, error } = await db.from("app_accounts").insert({
        login_code:code,password_salt:saltB64,password_hash:hash,password_iterations:iterations,
        role:"student",full_name:name,grade:String(body.grade || "ثالث متوسط"),class_name:String(body.class_name || "")
      }).select("id,login_code,role,full_name,grade,class_name").single();
      if (error) return json({ error:"create_student_failed", detail:error.message }, 400);
      return json({ student:data });
    }

    return json({ error:"unknown_action" }, 400);
  } catch (e) {
    return json({ error:"server_error", detail:e instanceof Error ? e.message : String(e) }, 500);
  }
});