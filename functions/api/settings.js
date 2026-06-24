/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 사이트 정보 API  (/api/settings)
   바인딩: env.DB (D1), env.ADMIN_KEY (수정 인증, 선택)
   GET                      → { settings:{ phone,email,address,hours,kakao,blogUrl } }
   POST { settings:{...}, key }  → 수정(관리자) { ok }
   ════════════════════════════════════════════════════════════ */
function json(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
var ALLOWED = ["phone", "email", "address", "hours", "kakao", "blogUrl"];

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 바인딩(DB)이 설정되지 않았습니다." }, 500);
  try {
    if (request.method === "GET") {
      const { results } = await db.prepare("SELECT k,v FROM settings").all();
      const out = {};
      (results || []).forEach((r) => { out[r.k] = r.v; });
      return json({ settings: out });
    }
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      if (env.ADMIN_KEY && b.key !== env.ADMIN_KEY) return json({ error: "관리자 인증 실패" }, 403);
      const s = b.settings || {};
      const stmts = [];
      ALLOWED.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(s, k)) {
          stmts.push(db.prepare("INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v")
            .bind(k, String(s[k] == null ? "" : s[k]).slice(0, 300)));
        }
      });
      if (stmts.length) await db.batch(stmts);
      return json({ ok: true });
    }
    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
