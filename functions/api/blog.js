/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 블로그 API  (/api/blog)
   바인딩: env.DB (D1), env.ADMIN_KEY (작성/삭제 인증, 선택)
   GET            → 목록  { posts:[{id,title,cat,excerpt,ts}] }
   GET ?id=ID     → 단일  { post:{id,title,cat,body,ts} }
   POST {title,body,cat,key}       → 작성(관리자) { id }
   DELETE {id,key}                 → 삭제(관리자) { ok }
   ════════════════════════════════════════════════════════════ */
function json(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
function clamp(s, n) { return String(s == null ? "" : s).slice(0, n); }
function authed(env, key) { return !env.ADMIN_KEY || key === env.ADMIN_KEY; }

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 바인딩(DB)이 설정되지 않았습니다." }, 500);
  const url = new URL(request.url);
  try {
    if (request.method === "GET") {
      const id = url.searchParams.get("id");
      if (id) {
        const post = await db.prepare("SELECT id,title,cat,body,ts FROM blog WHERE id=?").bind(id).first();
        if (!post) return json({ error: "not found" }, 404);
        return json({ post });
      }
      const { results } = await db.prepare("SELECT id,title,cat,body,ts FROM blog ORDER BY ts DESC LIMIT 200").all();
      return json({ posts: (results || []).map((p) => ({ id: p.id, title: p.title, cat: p.cat || "", ts: p.ts, excerpt: clamp((p.body || "").replace(/\s+/g, " "), 110) })) });
    }
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      if (!authed(env, b.key)) return json({ error: "관리자 인증 실패" }, 403);
      if (!b.title || !b.body) return json({ error: "제목과 내용을 입력하세요." }, 400);
      const id = "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await db.prepare("INSERT INTO blog (id,title,cat,body,ts) VALUES (?,?,?,?,?)")
        .bind(id, clamp(b.title, 160), clamp(b.cat, 40), clamp(b.body, 20000), Date.now()).run();
      return json({ id });
    }
    if (request.method === "DELETE") {
      const b = await request.json().catch(() => ({}));
      if (!authed(env, b.key)) return json({ error: "관리자 인증 실패" }, 403);
      if (!b.id) return json({ error: "id가 필요합니다." }, 400);
      await db.prepare("DELETE FROM blog WHERE id=?").bind(b.id).run();
      return json({ ok: true });
    }
    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
