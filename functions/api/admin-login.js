/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 관리자 로그인 검증  (/api/admin-login)
   POST { idToken }  → 구글 로그인(ADMIN_EMAILS 화이트리스트) 검증
   POST { key }      → 비밀번호(ADMIN_KEY) 검증
   → { ok:true, name, email } | 401 { ok:false, error }
   설정(ADMIN_EMAILS/ADMIN_KEY)이 전혀 없으면 데모로 통과.
   ════════════════════════════════════════════════════════════ */
import { isAdmin } from "./_auth.js";

function json(d, s) {
  return new Response(JSON.stringify(d), {
    status: s || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  const b = await request.json().catch(() => ({}));
  const adm = await isAdmin(env, b);
  if (adm.ok) return json({ ok: true, name: adm.name || "", email: adm.email || "", demo: !!adm.demo });
  // 구글 로그인 시도였는데 거부된 경우 메시지 구분
  if (b && b.idToken) return json({ ok: false, error: "허용되지 않은 구글 계정입니다. 관리자에게 문의하세요." }, 401);
  return json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
}
