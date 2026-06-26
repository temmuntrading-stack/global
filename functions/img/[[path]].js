/* ════════════════════════════════════════════════════════════
   Cloudflare Pages Function — 이미지 서빙  (/img/<키>)
   바인딩: env.MEDIA (R2 버킷)
   R2에서 객체를 읽어 캐시 헤더와 함께 반환(버킷 공개 설정 불필요).
   ════════════════════════════════════════════════════════════ */
export async function onRequest(context) {
  const { env, params } = context;
  if (!env.MEDIA) return new Response("R2(MEDIA) not configured", { status: 500 });
  const key = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  if (!key) return new Response("not found", { status: 404 });

  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (!headers.has("content-type")) headers.set("content-type", "image/webp");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", obj.httpEtag);
  return new Response(obj.body, { headers });
}
