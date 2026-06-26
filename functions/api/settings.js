/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 사이트 정보 API  (/api/settings)
   바인딩: env.DB (D1), env.ADMIN_KEY (수정 인증, 선택)
   GET                      → { settings:{ phone,email,address,hours,kakao,blogUrl } }
   POST { settings:{...}, key }  → 수정(관리자) { ok }
   ════════════════════════════════════════════════════════════ */
import { isAdmin } from "./_auth.js";

function json(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
var ALLOWED = ["phone", "email", "address", "hours", "kakao", "blogUrl", "hero1", "hero2", "hero3", "hero4", "hero5"];

/* 테이블 자동 생성 + 기본값 시드 (최초 요청 시 1회 — D1 Console에 수동 적용 불필요) */
let _schemaReady = false;
async function ensureSchema(db) {
  if (_schemaReady) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)").run();
  await db.batch([
    ["phone", "02 2277 2442"], ["email", "lawsqare@naver.com"],
    ["address", "서울특별시 중구 을지로 254, 3층 301호"], ["hours", "평일 09:00 – 18:00"],
    ["kakao", ""], ["blogUrl", "https://blog.naver.com/lawsqare"],
  ].map((kv) => db.prepare("INSERT OR IGNORE INTO settings (k,v) VALUES (?,?)").bind(kv[0], kv[1])));
  _schemaReady = true;
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 바인딩(DB)이 설정되지 않았습니다." }, 500);
  try {
    await ensureSchema(db);
    if (request.method === "GET") {
      const { results } = await db.prepare("SELECT k,v FROM settings").all();
      const out = {};
      (results || []).forEach((r) => { out[r.k] = r.v; });
      return json({ settings: out });
    }
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      if (!(await isAdmin(env, b)).ok) return json({ error: "관리자 인증 실패" }, 403);
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
