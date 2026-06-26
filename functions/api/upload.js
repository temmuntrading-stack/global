/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 이미지 업로드  (/api/upload)
   바인딩: env.MEDIA (R2 버킷) + 관리자 인증(_auth.js)
   POST multipart/form-data { file(webp), key?, idToken? }
     → R2에 저장하고 { url:"/img/<키>" } 반환
   · env.MEDIA 미설정이면 503(프런트가 base64 폴백)
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
  if (!env.MEDIA) return json({ error: "R2 바인딩(MEDIA)이 설정되지 않았습니다." }, 503);

  let form;
  try { form = await request.formData(); } catch (e) { return json({ error: "form 파싱 실패" }, 400); }

  const adm = await isAdmin(env, { key: form.get("key"), idToken: form.get("idToken") });
  if (!adm.ok) return json({ error: "관리자 인증 실패" }, 403);

  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "파일이 없습니다." }, 400);

  const buf = await file.arrayBuffer();
  if (buf.byteLength > 8 * 1024 * 1024) return json({ error: "이미지가 너무 큽니다(최대 8MB)." }, 413);

  const key = "media/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + ".webp";
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" } });
  return json({ url: "/img/" + key });
}
