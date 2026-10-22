import test, {beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequest as accounts} from '../functions/api/admin-accounts.js';
import {onRequest as login} from '../functions/api/admin-login.js';
import {onRequest as settings} from '../functions/api/settings.js';
import {isAdmin,makeSession,verifySession,verifyGoogle} from '../functions/api/_auth.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function database() {
  const sql=new DatabaseSync(':memory:');
  return {prepare(query){return {bind(...args){this.args=args;return this;},async run(){return sql.prepare(query).run(...(this.args||[]));},async first(){return sql.prepare(query).get(...(this.args||[]))||null;},async all(){return {results:sql.prepare(query).all(...(this.args||[]))};}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
}
const env=()=>({DB:database(),ADMIN_KEY:'test-bootstrap-secret',ADMIN_EMAILS:'owner@example.com',GOOGLE_CLIENT_ID:'public-test-client'});
const call=(handler,e,body,extra={})=>handler({env:e,request:new Request('https://test.invalid/api/test',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'127.0.0.1',...extra},body:JSON.stringify(body)})});
const create=(e,email='staff@example.com',extra={})=>call(accounts,e,{key:e.ADMIN_KEY,action:'create',email,...extra});
const nativeFetch=globalThis.fetch;
let claims,googleCalls;
beforeEach(()=>{
  claims={aud:'public-test-client',iss:'https://accounts.google.com',email_verified:'true',email:'owner@example.com',sub:'google-owner-123',exp:Math.floor(Date.now()/1000)+600};
  googleCalls=0;
  globalThis.fetch=async url=>{assert.equal(new URL(url).origin,'https://oauth2.googleapis.com');googleCalls++;return Response.json(claims);};
});
afterEach(()=>{globalThis.fetch=nativeFetch;});
function staffClaims(email='staff@example.com',sub='google-staff-456') {claims={...claims,email,sub};}
function cookie(response) {return response.headers.get('set-cookie')?.split(';')[0];}

test('account management fails closed for unauthenticated, cross-origin and role-forged requests',async()=>{
  for(const e of [{DB:database()},env()]) {
    assert.equal((await call(accounts,e,{action:'list',role:'superadmin'})).status,403);
    assert.equal((await call(accounts,e,{action:'create',email:'staff@example.com'})).status,403);
    assert.equal((await isAdmin(e,{})).ok,false);
  }
  const e=env();
  assert.equal((await call(accounts,e,{key:e.ADMIN_KEY,action:'list'},{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await call(login,e,{key:e.ADMIN_KEY},{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await call(accounts,e,null)).status,400);
});

test('superadmin registers only a normalized Google email without passwords, token fields or duplicate owners',async()=>{
  const e=env(),response=await create(e,' STAFF@Example.com '),saved=await response.json();
  assert.equal(response.status,201);assert.equal(saved.account.email,'staff@example.com');
  const row=await e.DB.prepare('SELECT * FROM admin_google_accounts').first();
  assert.equal(row.google_sub,null);assert.equal('password_hash' in row,false);
  const list=await (await call(accounts,e,{key:e.ADMIN_KEY,action:'list'})).json();
  assert.equal(list.accounts.length,1);assert.equal(list.googleLoginReady,true);
  assert.deepEqual(list.googleEmails,['owner@example.com']);
  assert.ok(!JSON.stringify([saved,list]).match(/password|idToken|session|google_sub/));
  assert.equal((await create(e,'staff@example.com')).status,409);
  assert.equal((await create(e,'OWNER@example.com')).status,409);
  assert.equal((await create(e,'invalid')).status,400);
  assert.equal((await create(e,'other@example.com',{password:'do not accept this password'})).status,400);
  assert.equal(googleCalls,0);
});

test('registered Google staff can manage the site but cannot list or add administrators',async()=>{
  const e=env();await create(e);staffClaims();
  const response=await call(login,e,{idToken:'verified-staff-token'}),data=await response.json(),staffCookie=cookie(response);
  assert.equal(response.status,200);assert.equal(data.role,'admin');assert.equal(data.email,'staff@example.com');assert.ok(!data.token);
  assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.match(response.headers.get('set-cookie'),/; Secure/);
  const row=await e.DB.prepare('SELECT * FROM admin_google_accounts').first();assert.equal(row.google_sub,'google-staff-456');
  assert.equal((await call(accounts,e,{action:'create',email:'escalated@example.com',role:'superadmin'},{cookie:staffCookie})).status,403);
  assert.equal((await call(accounts,e,{action:'list',role:'superadmin'},{cookie:staffCookie})).status,403);
  assert.equal((await call(settings,e,{settings:{phone:'02-2277-2442'}},{cookie:staffCookie})).status,200);
  assert.equal((await (await call(login,e,{action:'check'},{cookie:staffCookie})).json()).role,'admin');
  await e.DB.prepare('DELETE FROM admin_google_accounts WHERE email=?').bind('staff@example.com').run();
  assert.equal((await call(login,e,{action:'check'},{cookie:staffCookie})).status,401);
});

test('unregistered Google emails and changed Google subjects cannot inherit administrator access',async()=>{
  const e=env();staffClaims();
  assert.equal((await call(login,e,{idToken:'unregistered'})).status,401);
  await create(e);
  assert.equal((await call(login,e,{idToken:'registered'})).status,200);
  staffClaims('staff@example.com','different-google-identity');
  assert.equal((await call(login,e,{idToken:'replacement'})).status,401);
  assert.equal((await e.DB.prepare('SELECT google_sub FROM admin_google_accounts').first()).google_sub,'google-staff-456');
});

test('Google claims validate audience issuer expiry verified email and stable subject',async()=>{
  for(const patch of [{aud:'wrong-client'},{iss:'https://evil.invalid'},{exp:0},{email_verified:'false'},{email:'invalid'},{sub:''}]) {
    const original={...claims};claims={...original,...patch};assert.equal((await verifyGoogle('token','public-test-client')).ok,false);claims=original;
  }
  globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'https://evil.invalid'}});
  assert.equal((await verifyGoogle('token','public-test-client')).ok,false);
  globalThis.fetch=async()=>{throw Error('internal provider error');};
  const response=await call(login,env(),{idToken:'token'});assert.equal(response.status,401);assert.ok(!(await response.text()).includes('internal provider error'));
});

test('server-configured Google owners and bootstrap remain superadmins and lose sessions when removed',async()=>{
  const e=env(),owner=await call(login,e,{idToken:'owner-token'}),ownerCookie=cookie(owner);
  assert.equal(owner.status,200);assert.equal((await owner.json()).role,'superadmin');
  assert.equal((await call(accounts,e,{action:'create',email:'staff@example.com'},{cookie:ownerCookie})).status,201);
  e.ADMIN_EMAILS='different@example.com';assert.equal((await call(accounts,e,{action:'list'},{cookie:ownerCookie})).status,403);
  const bootstrap=await call(login,e,{key:e.ADMIN_KEY}),bootstrapCookie=cookie(bootstrap);assert.equal((await bootstrap.json()).role,'superadmin');
  delete e.ADMIN_KEY;assert.equal((await call(login,e,{action:'check'},{cookie:bootstrapCookie})).status,401);
});

test('legacy password rows and sessions never become Google administrator access',async()=>{
  const e=env();
  await e.DB.prepare('CREATE TABLE admin_accounts (id TEXT PRIMARY KEY,email TEXT,password_hash TEXT)').run();
  await e.DB.prepare('INSERT INTO admin_accounts VALUES (?,?,?)').bind('legacy','staff@example.com','private-old-hash').run();
  assert.equal((await call(login,e,{email:'staff@example.com',password:'old password'})).status,400);
  assert.equal(await verifySession(e,await makeSession(e,'account:legacy')),false);
  staffClaims();assert.equal((await call(login,e,{idToken:'unregistered'})).status,401);
  assert.equal((await e.DB.prepare('SELECT password_hash FROM admin_accounts').first()).password_hash,'private-old-hash');
  delete e.GOOGLE_CLIENT_ID;assert.equal((await create(e)).status,503);
});

test('Google login throttles invalid attempts and clears expiry without echoing ID tokens',async()=>{
  const e=env();staffClaims('unregistered@example.com');
  for(let i=0;i<5;i++) assert.equal((await call(login,e,{idToken:'invalid-token'})).status,401);
  const limited=await call(login,e,{idToken:'invalid-token'});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'900');
  assert.ok(!(await limited.text()).includes('invalid-token'));
  await e.DB.prepare('UPDATE admin_login_attempts SET expires=0').run();claims.email='owner@example.com';
  assert.equal((await call(login,e,{idToken:'valid-owner-token'})).status,200);
});

test('opaque sessions reject public-client-ID forgeries and database hashes cannot be used as tokens',async()=>{
  const e=env(),token=await makeSession(e,'google:owner@example.com');
  assert.ok(await verifySession(e,token));assert.equal(await verifySession(e,token+'x'),false);
  const stored=await e.DB.prepare('SELECT token_hash FROM admin_sessions').first();assert.notEqual(stored.token_hash,token);assert.equal(await verifySession(e,stored.token_hash),false);
  const encoded=Buffer.from(JSON.stringify({sub:'owner@example.com',exp:Date.now()+100000})).toString('base64url');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(e.GOOGLE_CLIENT_ID),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const forged=encoded+'.'+Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(encoded))).toString('base64url');
  assert.equal(await verifySession(e,forged),false);
  assert.equal(await verifySession(e,await makeSession(e,'google-account:missing')),false);
});

test('cookie sessions reject CSRF and expire or revoke at logout',async()=>{
  const e=env(),response=await call(login,e,{idToken:'owner-token'}),ownerCookie=cookie(response),token=ownerCookie.split('=')[1];
  for(const headers of [{cookie:ownerCookie,Origin:'https://evil.invalid'},{cookie:ownerCookie,'sec-fetch-site':'cross-site'}]) {
    assert.equal((await call(accounts,e,{action:'list'},headers)).status,403);assert.equal((await call(login,e,{action:'logout'},headers)).status,403);
  }
  const logout=await call(login,e,{action:'logout'},{cookie:ownerCookie});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);assert.equal(await verifySession(e,token),false);
  const expired=await makeSession(e,'google:owner@example.com');await e.DB.prepare('UPDATE admin_sessions SET expires=0').run();assert.equal(await verifySession(e,expired),false);
});

test('HTTP non-JSON oversized streaming bodies and database errors fail without leaking input',async()=>{
  const e=env();
  for(const handler of [accounts,login]) {
    assert.equal((await handler({env:e,request:new Request('http://example.com/api/test',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})})).status,403);
    assert.equal((await handler({env:e,request:new Request('https://test.invalid/api/test',{method:'POST',headers:{'content-type':'text/plain'},body:'not-json'})})).status,415);
    const oversized=await call(handler,e,{idToken:'sensitive-test-marker'.repeat(1500)});assert.equal(oversized.status,413);assert.ok(!(await oversized.text()).includes('sensitive-test-marker'));
  }
  const DB={prepare(){throw Error('sensitive database content');},batch(){throw Error('sensitive database content');}};
  const error=await create({...e,DB});assert.equal(error.status,503);assert.ok(!(await error.text()).includes('sensitive database content'));
});

test('admin UI uses Google-only login and removes old browser credentials without collecting passwords',async()=>{
  const root={innerHTML:'',addEventListener(){}},stored=new Map([['glo-admin-key','old-key'],['glo-admin-tok','old-token'],['glo-admin-sess','old-session']]);
  let cleared=false;
  const context={window:{location:{hash:'',hostname:'globallaw.co.kr'},AuthGoogle:{}},AuthGoogle:{clearStoredCredential(){cleared=true;}},document:{getElementById(){return root;},querySelector(){return null;}},localStorage:{getItem(k){return stored.get(k)||null;},setItem(k,v){stored.set(k,v);},removeItem(k){stored.delete(k);}},fetch:async()=>Response.json({ok:false},{status:401}),console,setTimeout,clearTimeout};
  vm.runInNewContext(readFileSync(new URL('../js/admin.js',import.meta.url),'utf8'),context);await new Promise(resolve=>setImmediate(resolve));
  assert.ok(root.innerHTML.includes('Google로 로그인'));assert.ok(!root.innerHTML.includes('type="password"'));assert.ok(!root.innerHTML.includes('adm-login-form'));
  assert.equal(cleared,true);for(const k of ['glo-admin-key','glo-admin-tok','glo-admin-sess'])assert.equal(stored.has(k),false);
});
