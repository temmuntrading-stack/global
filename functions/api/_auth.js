import { ensureAccounts } from './_admin-accounts.js';
import { cookieSession, trustedRequest } from './_admin-http.js';
const encoder = new TextEncoder();
function hex(bytes) { return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join(''); }
async function tokenHash(token) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token)))); }
export async function makeSession(env, sub) {
  await ensureAccounts(env.DB);
  const token=hex(crypto.getRandomValues(new Uint8Array(32))), expires=Date.now()+7*24*3600*1000;
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires<=?').bind(Date.now()).run();
  await env.DB.prepare('INSERT INTO admin_sessions (token_hash,subject,expires) VALUES (?,?,?)').bind(await tokenHash(token),sub||'shared-admin',expires).run();
  return token;
}
async function readSession(env, token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  try {
    await ensureAccounts(env.DB);
    const row=await env.DB.prepare('SELECT subject,expires FROM admin_sessions WHERE token_hash=?').bind(await tokenHash(token)).first();
    return row && row.expires>Date.now() ? {sub:row.subject} : null;
  } catch (_) { return null; }
}
export async function revokeSession(env,token) {
  if (typeof token!=='string' || !/^[a-f0-9]{64}$/.test(token)) return;
  await ensureAccounts(env.DB);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await tokenHash(token)).run();
}
export async function verifySession(env, token) { return !!(await sessionAdmin(env,token)).ok; }
async function sessionAdmin(env,token) {
  const payload=await readSession(env,token);
  if (!payload) return {ok:false};
  if (payload.sub.startsWith('account:')) {
    await ensureAccounts(env.DB);
    const account=await env.DB.prepare('SELECT id,email FROM admin_accounts WHERE id=?').bind(payload.sub.slice(8)).first();
    return account ? {ok:true,email:account.email,name:account.email,subject:payload.sub,role:'admin'} : {ok:false};
  }
  if (env.ADMIN_KEY && ['shared-admin','admin','글로벌 법률사무소'].includes(payload.sub)) return {ok:true,name:'최고관리자',subject:'shared-admin',role:'superadmin'};
  const email=payload.sub.replace(/^google:/,'');
  return emailAllowed(env,email) ? {ok:true,email,name:email,subject:'google:'+email,role:'superadmin'} : {ok:false};
}
export async function verifyGoogle(idToken,clientId) {
  if (typeof idToken!=='string' || !idToken || !clientId) return {ok:false};
  try {
    const response=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(idToken));
    if (!response.ok) return {ok:false};
    const info=await response.json();
    if (info.aud!==clientId || !['accounts.google.com','https://accounts.google.com'].includes(info.iss) || String(info.email_verified)!=='true' || !(Number(info.exp)*1000>Date.now())) return {ok:false};
    return {ok:true,email:String(info.email||'').toLowerCase(),name:info.name||info.email||''};
  } catch (_) { return {ok:false}; }
}
export function emailAllowed(env,email) {
  if (!env.ADMIN_EMAILS || !email) return false;
  return String(env.ADMIN_EMAILS).split(/[,\s]+/).map(s=>s.trim().toLowerCase()).includes(String(email).toLowerCase());
}
export async function isAdmin(env,body={},request) {
  if (request) {
    if (!trustedRequest(request)) return {ok:false};
    const token=cookieSession(request);
    if (token) { const admin=await sessionAdmin(env,token); if (admin.ok) return admin; }
  }
  if (body.session) { const admin=await sessionAdmin(env,body.session); if (admin.ok) return admin; }
  if (env.ADMIN_KEY && typeof body.key==='string' && body.key===env.ADMIN_KEY) return {ok:true,name:'최고관리자',subject:'shared-admin',role:'superadmin'};
  if (env.ADMIN_EMAILS && env.GOOGLE_CLIENT_ID && body.idToken) {
    const admin=await verifyGoogle(body.idToken,env.GOOGLE_CLIENT_ID);
    if (admin.ok && emailAllowed(env,admin.email)) return {...admin,subject:'google:'+admin.email,role:'superadmin'};
  }
  return {ok:false};
}
