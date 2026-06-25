/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 자유게시판 API
   경로: /api/board
   바인딩(필수): env.DB  → Cloudflare D1 데이터베이스
   바인딩(선택): env.ADMIN_KEY → 변호사사무실 "공식 답변" 비밀키
      · 설정 시: 댓글에 official=true 를 쓰려면 올바른 key가 필요
      · 미설정 시: 누구나 공식 답변 가능(개발/테스트용)
   ════════════════════════════════════════════════════════════ */

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
function clamp(s, n) { return String(s == null ? "" : s).slice(0, n); }
function rid(pre) { return pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* 테이블 자동 생성 (최초 요청 시 1회 — D1 Console에 수동 적용 불필요) */
let _schemaReady = false;
async function ensureSchema(db) {
  if (_schemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, ts INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, official INTEGER NOT NULL DEFAULT 0, ts INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_posts_ts ON posts(ts)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)"),
  ]);
  _schemaReady = true;
}

/* Google ID 토큰 검증.
   env.GOOGLE_CLIENT_ID 설정 시: tokeninfo 로 검증 → { ok, name } 반환.
   검증 실패 시 { ok:false, error }.
   (env.GOOGLE_CLIENT_ID 미설정이면 호출하지 않음 → 기존 동작) */
async function verifyGoogle(idToken, clientId) {
  if (!idToken) return { ok: false, error: "로그인이 필요합니다." };
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
    if (!r.ok) return { ok: false, error: "로그인 인증에 실패했습니다." };
    const info = await r.json();
    if (info.aud !== clientId) return { ok: false, error: "로그인 인증에 실패했습니다." };
    const exp = parseInt(info.exp, 10);
    if (!exp || exp * 1000 < Date.now()) return { ok: false, error: "로그인이 만료되었습니다. 다시 로그인해 주세요." };
    return { ok: true, name: info.name || info.email || "익명" };
  } catch (e) {
    return { ok: false, error: "로그인 인증 중 오류가 발생했습니다." };
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 바인딩(DB)이 설정되지 않았습니다." }, 500);
  const url = new URL(request.url);

  try {
    await ensureSchema(db);
    /* ── 목록 / 단일 글 조회 ── */
    if (request.method === "GET") {
      const id = url.searchParams.get("id");
      if (id) {
        const post = await db.prepare("SELECT id,name,title,body,ts FROM posts WHERE id=?").bind(id).first();
        if (!post) return json({ error: "not found" }, 404);
        const { results } = await db
          .prepare("SELECT id,name,body,official,ts FROM comments WHERE post_id=? ORDER BY ts ASC")
          .bind(id).all();
        return json({ post, comments: (results || []).map((c) => ({ id: c.id, name: c.name, body: c.body, official: !!c.official, ts: c.ts })) });
      }
      const { results } = await db.prepare(
        "SELECT p.id,p.name,p.title,p.ts," +
        " (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS cc," +
        " (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.official=1) AS oc" +
        " FROM posts p ORDER BY p.ts DESC LIMIT 300"
      ).all();
      return json({ posts: (results || []).map((p) => ({ id: p.id, name: p.name, title: p.title, ts: p.ts, commentCount: p.cc, answered: p.oc > 0 })) });
    }

    /* ── 글 / 댓글 작성 ── */
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const ts = Date.now();

      if (b.type === "post") {
        if (!b.title || !b.body) return json({ error: "제목과 내용을 입력하세요." }, 400);
        let name = clamp(b.name, 40) || "익명";
        if (env.GOOGLE_CLIENT_ID) {
          const v = await verifyGoogle(b.idToken, env.GOOGLE_CLIENT_ID);
          if (!v.ok) return json({ error: v.error }, 401);
          name = clamp(v.name, 40) || "익명";
        }
        const id = rid("p");
        await db.prepare("INSERT INTO posts (id,name,title,body,ts) VALUES (?,?,?,?,?)")
          .bind(id, name, clamp(b.title, 120), clamp(b.body, 5000), ts).run();
        return json({ id });
      }

      if (b.type === "comment") {
        if (!b.postId || !b.body) return json({ error: "댓글 내용을 입력하세요." }, 400);
        let official = 0;
        let name = clamp(b.name, 40) || "익명";
        if (!b.official && env.GOOGLE_CLIENT_ID) {
          const v = await verifyGoogle(b.idToken, env.GOOGLE_CLIENT_ID);
          if (!v.ok) return json({ error: v.error }, 401);
          name = clamp(v.name, 40) || "익명";
        }
        if (b.official) {
          if (env.ADMIN_KEY) {
            if (b.key !== env.ADMIN_KEY) return json({ error: "관리자 키가 올바르지 않습니다." }, 403);
          }
          official = 1;
          name = "글로벌 법률사무소";
        }
        await db.prepare("INSERT INTO comments (id,post_id,name,body,official,ts) VALUES (?,?,?,?,?,?)")
          .bind(rid("c"), clamp(b.postId, 40), name, clamp(b.body, 3000), official, ts).run();
        return json({ ok: true });
      }

      return json({ error: "알 수 없는 요청입니다." }, 400);
    }

    /* ── 관리자 삭제 ── */
    if (request.method === "DELETE") {
      const b = await request.json().catch(() => ({}));
      if (env.ADMIN_KEY && b.key !== env.ADMIN_KEY) return json({ error: "관리자 인증 실패" }, 403);
      if (b.type === "post" && b.id) {
        await db.prepare("DELETE FROM comments WHERE post_id=?").bind(b.id).run();
        await db.prepare("DELETE FROM posts WHERE id=?").bind(b.id).run();
        return json({ ok: true });
      }
      if (b.type === "comment" && b.id) {
        await db.prepare("DELETE FROM comments WHERE id=?").bind(b.id).run();
        return json({ ok: true });
      }
      return json({ error: "id가 필요합니다." }, 400);
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
