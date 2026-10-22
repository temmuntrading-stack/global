// Private Google administrator allowlist and opaque sessions. No account passwords.
const encoder = new TextEncoder();
const ready = new WeakMap();
export async function ensureAccounts(db) {
  if (!db) throw new Error('관리자 계정 저장소가 연결되지 않았습니다.');
  if (!ready.has(db)) ready.set(db, db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS admin_google_accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, google_sub TEXT, created_at INTEGER NOT NULL, created_by TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, subject TEXT NOT NULL, expires INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires)'),
    db.prepare('CREATE TABLE IF NOT EXISTS admin_login_attempts (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_admin_attempts_expiry ON admin_login_attempts(expires)')
  ]).catch(error => { ready.delete(db); throw error; }));
  await ready.get(db);
}
export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
export function validEmail(email) {
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email);
}
function hex(bytes) { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
export async function reserveLoginAttempt(env, request, email) {
  await ensureAccounts(env.DB);
  const now = Date.now(), expires = now + 15 * 60 * 1000;
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value)).then(bytes => hex(new Uint8Array(bytes)));
  const ipBucket = await digest('ip:' + ip), pairBucket = await digest('pair:' + ip + ':' + email);
  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE expires <= ?').bind(now).run();
  for (const [bucket, limit] of [[ipBucket, 20], [pairBucket, 5]]) {
    const row = await env.DB.prepare('INSERT INTO admin_login_attempts (bucket,attempts,expires) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts')
      .bind(bucket, expires).first();
    if (row.attempts > limit) return {ok:false};
  }
  return {ok:true, pairBucket};
}
