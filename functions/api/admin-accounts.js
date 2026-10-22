import { isAdmin } from './_auth.js';
import { ensureAccounts, normalizeEmail, validEmail } from './_admin-accounts.js';
import { trustedRequest, smallJson } from './_admin-http.js';
function json(data,status=200) { return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}}); }
export async function onRequest({request,env}) {
  if (request.method!=='POST') return json({error:'method not allowed'},405);
  if (!trustedRequest(request)) return json({error:'HTTPS 및 같은 사이트에서만 요청할 수 있습니다.'},403);
  try {
    const body=await smallJson(request,8192);
    if (!body || typeof body!=='object' || Array.isArray(body)) return json({error:'요청을 확인해 주세요.'},400);
    const admin=await isAdmin(env,body,request);
    if (!admin.ok || admin.demo) return json({error:'관리자 로그인이 필요합니다.'},403);
    if (admin.role!=='superadmin') return json({error:'최고관리자만 관리자 계정을 관리할 수 있습니다.'},403);
    await ensureAccounts(env.DB);
    if (body.action==='list') {
      const {results}=await env.DB.prepare('SELECT id,email,created_at,created_by FROM admin_google_accounts ORDER BY created_at DESC').all();
      const googleEmails=String(env.ADMIN_EMAILS||'').split(/[,\s]+/).map(normalizeEmail).filter(Boolean);
      return json({accounts:results||[],googleEmails,googleLoginReady:!!env.GOOGLE_CLIENT_ID});
    }
    if (body.action!=='create') return json({error:'지원하지 않는 작업입니다.'},400);
    const email=normalizeEmail(body.email);
    if (!validEmail(email)) return json({error:'올바른 이메일 주소를 입력해 주세요.'},400);
    if (body.password!==undefined) return json({error:'비밀번호는 등록하지 않습니다. Google 계정 이메일만 입력해 주세요.'},400);
    if (!env.GOOGLE_CLIENT_ID) return json({error:'Google 로그인 연결을 확인해 주세요.'},503);
    if (String(env.ADMIN_EMAILS||'').split(/[,\s]+/).map(normalizeEmail).includes(email)) return json({error:'이미 Google 관리자로 등록된 이메일입니다.'},409);
    const id=crypto.randomUUID(),createdAt=Date.now(),createdBy=admin.email||admin.subject||'admin';
    const result=await env.DB.prepare('INSERT INTO admin_google_accounts (id,email,created_at,created_by) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING RETURNING id')
      .bind(id,email,createdAt,createdBy).first();
    if (!result) return json({error:'이미 등록된 이메일입니다.'},409);
    return json({ok:true,account:{id,email,created_at:createdAt,created_by:createdBy}},201);
  } catch (error) { return json({error:error.status?error.message:'관리자 계정을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},error.status||503); }
}
