/* ════════════════════════════════════════════════════════════
   _auth.js — 공유 관리자 인증 헬퍼 (라우트 아님: '_' 접두사)
   관리자 인증 = 다음 중 하나
     1) 구글 로그인: idToken 검증 + 이메일이 env.ADMIN_EMAILS 화이트리스트에 포함
        (env.GOOGLE_CLIENT_ID 필요. ADMIN_EMAILS 는 콤마/공백 구분)
     2) 비밀번호: body.key === env.ADMIN_KEY
   아무 것도 설정되지 않으면 데모(개발/초기): 통과.
   ════════════════════════════════════════════════════════════ */

export async function verifyGoogle(idToken, clientId) {
  if (!idToken) return { ok: false };
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
    if (!r.ok) return { ok: false };
    const info = await r.json();
    if (clientId && info.aud !== clientId) return { ok: false };
    const exp = parseInt(info.exp, 10);
    if (!exp || exp * 1000 < Date.now()) return { ok: false };
    return { ok: true, email: String(info.email || "").toLowerCase(), name: info.name || info.email || "" };
  } catch (e) {
    return { ok: false };
  }
}

export function emailAllowed(env, email) {
  if (!env.ADMIN_EMAILS || !email) return false;
  const list = String(env.ADMIN_EMAILS).split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.indexOf(String(email).toLowerCase()) >= 0;
}

/* { ok, demo?, name?, email? } */
export async function isAdmin(env, body) {
  body = body || {};
  const hasPw = !!env.ADMIN_KEY;
  const hasGoogle = !!(env.ADMIN_EMAILS && env.GOOGLE_CLIENT_ID);
  // 관리자 인증이 전혀 구성되지 않음 → 데모(개발/초기 단계)
  if (!hasPw && !hasGoogle) return { ok: true, demo: true, name: "글로벌 법률사무소" };
  // 1) 비밀번호
  if (hasPw && body.key && body.key === env.ADMIN_KEY) return { ok: true, name: "글로벌 법률사무소" };
  // 2) 구글 + 화이트리스트
  if (hasGoogle && body.idToken) {
    const v = await verifyGoogle(body.idToken, env.GOOGLE_CLIENT_ID);
    if (v.ok && emailAllowed(env, v.email)) return { ok: true, name: v.name, email: v.email };
  }
  return { ok: false };
}
