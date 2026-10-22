// Private D1 tables: never expose password hashes or session secrets via /api/settings.
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
const encoder = new TextEncoder();
const ready = new WeakMap();
export async function ensureAccounts(db) {
  if (!db) throw new Error('관리자 계정 저장소가 연결되지 않았습니다.');
  if (!ready.has(db)) ready.set(db, db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS admin_accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL, created_by TEXT NOT NULL)'),
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
export function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128 && password.trim().length >= 12;
}
function hex(bytes) { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
function unhex(value) { return Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16)); }
async function derive(password, salt, iterations) {
  // Standard PBKDF2 from a pinned library, not a custom chained construction.
  // Pure JS avoids Workers Web Crypto's native 100k iteration cap.
  const bytes = encoder.encode(password);
  try { return await pbkdf2Async(sha256,bytes,salt,{c:iterations,dkLen:32,asyncTick:10}); }
  finally { bytes.fill(0); }
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password,salt,600000);
  try { return 'pbkdf2-sha256$600000$' + hex(salt) + '$' + hex(derived); }
  finally { derived.fill(0); }
}
export async function checkPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const parts = String(stored || '').split('$');
  if (parts[0] !== 'pbkdf2-sha256' || !['100000','600000'].includes(parts[1]) || !/^[a-f0-9]{32}$/.test(parts[2]) || !/^[a-f0-9]{64}$/.test(parts[3])) return false;
  const actual = await derive(password, unhex(parts[2]), Number(parts[1])), expected = unhex(parts[3]);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  actual.fill(0); expected.fill(0);
  return difference === 0;
}
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
export async function loginWithPassword(env, email, password) {
  await ensureAccounts(env.DB);
  const account = await env.DB.prepare('SELECT id,email,password_hash FROM admin_accounts WHERE email=?').bind(email).first();
  const dummy = 'pbkdf2-sha256$600000$00000000000000000000000000000000$' + '0'.repeat(64);
  const matched = await checkPassword(password, account ? account.password_hash : dummy);
  if (matched && account && account.password_hash.startsWith('pbkdf2-sha256$100000$')) {
    const upgraded = await hashPassword(password);
    await env.DB.prepare('UPDATE admin_accounts SET password_hash=? WHERE id=? AND password_hash=?').bind(upgraded,account.id,account.password_hash).run();
  }
  return matched && account ? {ok:true, email:account.email, name:account.email, subject:'account:' + account.id} : {ok:false};
}
