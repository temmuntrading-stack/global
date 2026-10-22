const COOKIE = '__Host-glo-admin';
const LOCAL_COOKIE = 'glo-admin-local';
export function localRequest(request) {
  const url = new URL(request.url);
  return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
}
export function trustedRequest(request) {
  const url = new URL(request.url), origin = request.headers.get('origin');
  if (url.protocol !== 'https:' && !localRequest(request)) return false;
  if (origin && origin !== url.origin) return false;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  return true;
}
export function sessionCookie(request, token) {
  const local = localRequest(request);
  return (local ? LOCAL_COOKIE : COOKIE) + '=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + (token ? '604800' : '0') + (local ? '' : '; Secure');
}
export function cookieSession(request) {
  const name = localRequest(request) ? LOCAL_COOKIE : COOKIE;
  const part = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return part ? part.slice(name.length + 1) : '';
}
// Enforce limits even when Content-Length is absent (HTTP/2 or chunked requests).
export async function smallJson(request, limit) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw Object.assign(new Error('JSON 요청이 필요합니다.'), {status:415});
  if (Number(request.headers.get('content-length')) > limit) throw Object.assign(new Error('요청이 너무 큽니다.'), {status:413});
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0; const chunks = [];
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw Object.assign(new Error('요청이 너무 큽니다.'), {status:413}); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch (_) { return null; }
}
