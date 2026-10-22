import { isAdmin, makeSession, revokeSession } from './_auth.js';
import { reserveLoginAttempt } from './_admin-accounts.js';
import { sessionCookie, cookieSession, trustedRequest, smallJson } from './_admin-http.js';
function json(data,status=200,cookie) { return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...(status===429?{'retry-after':'900'}:{}),...(cookie?{'set-cookie':cookie}:{})}}); }
export async function onRequest({request,env}) {
  if (request.method!=='POST') return json({error:'method not allowed'},405);
  if (!trustedRequest(request)) return json({ok:false,error:'HTTPS 및 같은 사이트에서만 로그인할 수 있습니다.'},403);
  try {
    const body=await smallJson(request,16384);
    if (!body || typeof body!=='object' || Array.isArray(body)) return json({ok:false,error:'요청을 확인해 주세요.'},400);
    if (body.action==='logout') { await revokeSession(env,cookieSession(request)); return json({ok:true},200,sessionCookie(request,'')); }
    if (body.action==='check') {
      const current=await isAdmin(env,{},request);
      return current.ok ? json({ok:true,name:current.name||'',email:current.email||'',role:current.role}) : json({ok:false},401);
    }
    if (body.email!==undefined || body.password!==undefined) return json({ok:false,error:'등록된 Google 계정으로 로그인해 주세요.'},400);
    let attempt;
    if (body.key || body.idToken) {
      attempt=await reserveLoginAttempt(env,request,body.idToken?'google':'shared-admin');
      if (!attempt.ok) return json({ok:false,error:'로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.'},429);
    }
    const admin=await isAdmin(env,body,request);
    if (!admin.ok) return json({ok:false,error:body.idToken?'등록되지 않은 Google 계정입니다. 최고관리자에게 문의하세요.':'관리자 인증을 확인해 주세요.'},401);
    const token=await makeSession(env,admin.subject);
    if (attempt && attempt.pairBucket) await env.DB.prepare('DELETE FROM admin_login_attempts WHERE bucket=?').bind(attempt.pairBucket).run();
    return json({ok:true,name:admin.name||'',email:admin.email||'',role:admin.role},200,sessionCookie(request,token));
  } catch (error) { return json({ok:false,error:error.status?error.message:'로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},error.status||503); }
}
