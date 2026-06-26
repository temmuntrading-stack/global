/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 관리자 로그인 검증  (/api/admin-login)
   바인딩(선택):
     env.ADMIN_ID  → 관리자 아이디
     env.ADMIN_KEY → 관리자 비밀번호(쓰기 작업 인증과 공용)
   POST { id, key } → { ok:true } | 401 { ok:false, error }
   · 둘 다 미설정(데모/로컬)이면 통과(ok:true, demo:true).
   · ADMIN_ID 만 미설정이면 비밀번호만 검증.
   ════════════════════════════════════════════════════════════ */
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
  const id = String(b.id == null ? "" : b.id);
  const key = String(b.key == null ? "" : b.key);

  // 아무 것도 설정되지 않은 환경(초기/로컬): 데모 모드로 통과
  if (!env.ADMIN_KEY && !env.ADMIN_ID) return json({ ok: true, demo: true });

  const idOk = !env.ADMIN_ID || id === env.ADMIN_ID;
  const keyOk = !env.ADMIN_KEY || key === env.ADMIN_KEY;
  if (idOk && keyOk) return json({ ok: true });
  return json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
}
