/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 상담 신청(연락하기 폼) API
   경로: /api/contact
   바인딩(필수): env.DB → Cloudflare D1
   · POST (공개)            → 상담 신청 접수(이름·이메일·연락처·언어·분야·내용)
   · GET  (관리자)          → 신청 목록 / ?id 상세
   · POST { adminAction }   → 상태 변경(관리자)
   · DELETE (관리자)        → 신청 삭제
   개인정보(이메일·연락처)를 담으므로 조회/수정은 관리자 인증 필요.
   ════════════════════════════════════════════════════════════ */
import { isAdmin } from "./_auth.js";

function json(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
function clamp(s, n) { return String(s == null ? "" : s).slice(0, n); }
function rid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

let _ready = false;
async function ensureSchema(db) {
  if (_ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, lang TEXT, area TEXT, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', ts INTEGER NOT NULL)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_inq_ts ON inquiries(ts)").run();
  _ready = true;
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 바인딩(DB)이 설정되지 않았습니다." }, 500);
  const url = new URL(request.url);
  try {
    await ensureSchema(db);

    /* ── 신규 접수(공개) / 관리자 상태 변경 ── */
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));

      // 관리자: 상태 변경
      if (b.adminAction) {
        if (!(await isAdmin(env, b)).ok) return json({ error: "관리자 인증 실패" }, 403);
        if (b.adminAction === "status" && b.id) {
          const st = clamp(b.status, 20) || "new";
          await db.prepare("UPDATE inquiries SET status=? WHERE id=?").bind(st, b.id).run();
          return json({ ok: true });
        }
        return json({ error: "알 수 없는 요청입니다." }, 400);
      }

      // 공개: 상담 신청 접수
      const message = clamp(b.message, 5000);
      if (!message) return json({ error: "문의 내용을 입력하세요." }, 400);
      const id = rid("q");
      await db.prepare("INSERT INTO inquiries (id,name,email,phone,lang,area,message,status,ts) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id, clamp(b.name, 60) || "익명", clamp(b.email, 120), clamp(b.phone, 40), clamp(b.lang, 8), clamp(b.area, 80), message, "new", Date.now())
        .run();
      return json({ ok: true, id });
    }

    /* ── 목록 / 상세(관리자 전용) ── */
    if (request.method === "GET") {
      const auth = { key: url.searchParams.get("key"), idToken: url.searchParams.get("idToken"), session: url.searchParams.get("session") };
      if (!(await isAdmin(env, auth)).ok) return json({ error: "관리자 인증 실패" }, 403);
      const id = url.searchParams.get("id");
      if (id) {
        const row = await db.prepare("SELECT id,name,email,phone,lang,area,message,status,ts FROM inquiries WHERE id=?").bind(id).first();
        if (!row) return json({ error: "not found" }, 404);
        return json({ inquiry: row });
      }
      const { results } = await db.prepare("SELECT id,name,email,phone,lang,area,message,status,ts FROM inquiries ORDER BY ts DESC LIMIT 500").all();
      return json({ inquiries: results || [] });
    }

    /* ── 삭제(관리자 전용) ── */
    if (request.method === "DELETE") {
      const b = await request.json().catch(() => ({}));
      if (!(await isAdmin(env, b)).ok) return json({ error: "관리자 인증 실패" }, 403);
      if (b.id) { await db.prepare("DELETE FROM inquiries WHERE id=?").bind(b.id).run(); return json({ ok: true }); }
      return json({ error: "id가 필요합니다." }, 400);
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
