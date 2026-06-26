/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 성공 사례(블로그) API  (/api/blog)
   바인딩: env.DB (D1) + 관리자 인증(_auth.js: ADMIN_EMAILS/ADMIN_KEY)
   GET            → 목록 { posts:[{id,title,cat,excerpt,image,ts}] }
   GET ?id=ID     → 단일 { post:{id,title,cat,body,image,ts} }
   GET ?cats=1    → 카테고리 { cats:[name,…] }
   POST {title,body,cat,image}        → 글 작성(관리자) { id }
   POST {kind:"cat", name}            → 카테고리 추가(관리자) { ok }
   DELETE {id}                        → 글 삭제(관리자) { ok }
   DELETE {kind:"cat", name}          → 카테고리 삭제(관리자) { ok }
   ════════════════════════════════════════════════════════════ */
import { isAdmin } from "./_auth.js";

function json(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
function clamp(s, n) { return String(s == null ? "" : s).slice(0, n); }

/* 테이블 자동 생성/마이그레이션 (최초 요청 시 1회) */
let _schemaReady = false;
async function ensureSchema(db) {
  if (_schemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS blog (id TEXT PRIMARY KEY, title TEXT NOT NULL, cat TEXT, body TEXT NOT NULL, ts INTEGER NOT NULL, image TEXT, status TEXT, lang TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_blog_ts ON blog(ts)"),
    db.prepare("CREATE TABLE IF NOT EXISTS blog_cats (name TEXT PRIMARY KEY, ts INTEGER NOT NULL)"),
  ]);
  // 기존 blog 테이블에 누락 컬럼 추가
  try { await db.prepare("ALTER TABLE blog ADD COLUMN image TEXT").run(); } catch (e) {}
  try { await db.prepare("ALTER TABLE blog ADD COLUMN status TEXT").run(); } catch (e) {}
  try { await db.prepare("ALTER TABLE blog ADD COLUMN lang TEXT").run(); } catch (e) {}
  try { await db.prepare("UPDATE blog SET status='published' WHERE status IS NULL OR status=''").run(); } catch (e) {}
  try { await db.prepare("UPDATE blog SET lang='ko' WHERE lang IS NULL OR lang=''").run(); } catch (e) {}
  // 기본 카테고리 1개 시드(카테고리가 하나도 없을 때만)
  try {
    const c = await db.prepare("SELECT COUNT(*) AS n FROM blog_cats").first();
    if (!c || !c.n) await db.prepare("INSERT OR IGNORE INTO blog_cats (name,ts) VALUES (?,?)").bind("성공사례", Date.now()).run();
  } catch (e) {}
  _schemaReady = true;
}

async function listCats(db) {
  const { results } = await db.prepare("SELECT name FROM blog_cats ORDER BY ts ASC").all();
  return (results || []).map((r) => r.name);
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 바인딩(DB)이 설정되지 않았습니다." }, 500);
  const url = new URL(request.url);
  try {
    await ensureSchema(db);

    if (request.method === "GET") {
      if (url.searchParams.get("cats")) {
        return json({ cats: await listCats(db) });
      }
      const id = url.searchParams.get("id");
      if (id) {
        const post = await db.prepare("SELECT id,title,cat,body,ts,image,status,lang FROM blog WHERE id=?").bind(id).first();
        if (!post) return json({ error: "not found" }, 404);
        return json({ post });
      }
      // ?all=1 → 임시저장 포함(관리자), 기본 → 발행글만(공개)
      // ?lang=xx → 해당 언어 글만(공개 페이지/홈). all=1이면 언어 무시(관리자 전체).
      const all = url.searchParams.get("all");
      const lang = url.searchParams.get("lang");
      let sql = "SELECT id,title,cat,body,ts,image,status,lang FROM blog";
      const where = [], binds = [];
      if (!all) where.push("(status='published' OR status IS NULL)");
      if (!all && lang) { where.push("(lang=? OR lang IS NULL OR lang='')"); binds.push(lang); }
      if (where.length) sql += " WHERE " + where.join(" AND ");
      sql += " ORDER BY ts DESC LIMIT 200";
      const { results } = await db.prepare(sql).bind(...binds).all();
      return json({
        posts: (results || []).map((p) => ({
          id: p.id, title: p.title, cat: p.cat || "", ts: p.ts, image: p.image || "", status: p.status || "published", lang: p.lang || "ko",
          excerpt: clamp(String(p.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " "), 110),
        })),
      });
    }

    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      if (!(await isAdmin(env, b)).ok) return json({ error: "관리자 인증 실패" }, 403);

      // 카테고리 추가
      if (b.kind === "cat") {
        const name = clamp(b.name, 40).trim();
        if (!name) return json({ error: "카테고리 이름을 입력하세요." }, 400);
        await db.prepare("INSERT OR IGNORE INTO blog_cats (name,ts) VALUES (?,?)").bind(name, Date.now()).run();
        return json({ ok: true, cats: await listCats(db) });
      }

      // 글 수정(기존 id) 또는 작성
      const status = b.status === "draft" ? "draft" : "published";
      if (!b.title) return json({ error: "제목을 입력하세요." }, 400);
      // 본문 한도: R2 미연결 시 이미지가 base64로 본문에 포함될 수 있어 넉넉히(잘림 방지)
      var BODY_MAX = 5000000;
      var lang = clamp(b.lang, 8) || "ko";
      if (b.id) {
        await db.prepare("UPDATE blog SET title=?, cat=?, body=?, image=?, status=?, lang=? WHERE id=?")
          .bind(clamp(b.title, 160), clamp(b.cat, 40), clamp(b.body, BODY_MAX), clamp(b.image, 1800000), status, lang, b.id).run();
        return json({ id: b.id, updated: true });
      }
      const id = "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await db.prepare("INSERT INTO blog (id,title,cat,body,ts,image,status,lang) VALUES (?,?,?,?,?,?,?,?)")
        .bind(id, clamp(b.title, 160), clamp(b.cat, 40), clamp(b.body, BODY_MAX), Date.now(), clamp(b.image, 1800000), status, lang).run();
      return json({ id });
    }

    if (request.method === "DELETE") {
      const b = await request.json().catch(() => ({}));
      if (!(await isAdmin(env, b)).ok) return json({ error: "관리자 인증 실패" }, 403);

      // 카테고리 삭제
      if (b.kind === "cat") {
        if (!b.name) return json({ error: "카테고리 이름이 필요합니다." }, 400);
        await db.prepare("DELETE FROM blog_cats WHERE name=?").bind(b.name).run();
        return json({ ok: true, cats: await listCats(db) });
      }

      // 글 삭제
      if (!b.id) return json({ error: "id가 필요합니다." }, 400);
      await db.prepare("DELETE FROM blog WHERE id=?").bind(b.id).run();
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
