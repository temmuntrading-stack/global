import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequest as accounts} from '../functions/api/admin-accounts.js';
import {onRequest as login} from '../functions/api/admin-login.js';
import {onRequest as settings} from '../functions/api/settings.js';
import {isAdmin,makeSession,verifySession,verifyGoogle} from '../functions/api/_auth.js';
import {hashPassword,checkPassword} from '../functions/api/_admin-accounts.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {pbkdf2Sync} from 'node:crypto';
import {loginWithPassword} from '../functions/api/_admin-accounts.js';
function database() {
  const sql=new DatabaseSync(':memory:');
  return {prepare(query){return {bind(...args){this.args=args;return this;},async run(){return sql.prepare(query).run(...(this.args||[]));},async first(){return sql.prepare(query).get(...(this.args||[]))||null;},async all(){return {results:sql.prepare(query).all(...(this.args||[]))};}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
}
const env=()=>({DB:database(),ADMIN_KEY:'test-bootstrap-secret'});
const call=(handler,env,body,extra={})=>handler({env,request:new Request('https://test.invalid/api/test',{method:'POST',headers:{'content-type':'application/json','CF-Connecting-IP':'127.0.0.1',...extra},body:JSON.stringify(body)})});
const create=(e,email='new@example.com',password='A long test password!')=>call(accounts,e,{key:e.ADMIN_KEY,action:'create',email,password});
test('account APIs fail closed without authentication and never accept demo or cross-origin access',async()=>{
  for(const e of [{DB:database()},env()]) {
    assert.equal((await call(accounts,e,{action:'list'})).status,403);
    assert.equal((await call(accounts,e,{action:'create',email:'new@example.com',password:'A long test password!'})).status,403);
    assert.equal((await isAdmin(e,{})).ok,false);
  }
  const e=env();
  assert.equal((await call(accounts,e,{key:e.ADMIN_KEY,action:'list'},{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await call(login,e,{key:e.ADMIN_KEY},{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await call(accounts,e,null)).status,400);
});

test('600k password hashes match Node native PBKDF2 and legacy hashes upgrade only after a correct login',async()=>{
  const password='A long test password!';
  const stored=await hashPassword(password),parts=stored.split('$');
  assert.equal(parts[1],'600000');
  assert.equal(parts[3],pbkdf2Sync(password,Buffer.from(parts[2],'hex'),600000,32,'sha256').toString('hex'));
  const e=env();await create(e);
  const salt=Buffer.alloc(16,7),legacy='pbkdf2-sha256$100000$'+salt.toString('hex')+'$'+pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
  await e.DB.prepare('UPDATE admin_accounts SET password_hash=?').bind(legacy).run();
  assert.equal((await loginWithPassword(e,'new@example.com','incorrect password')).ok,false);
  assert.equal((await e.DB.prepare('SELECT password_hash FROM admin_accounts').first()).password_hash,legacy);
  assert.equal((await loginWithPassword(e,'new@example.com',password)).ok,true);
  assert.ok((await e.DB.prepare('SELECT password_hash FROM admin_accounts').first()).password_hash.startsWith('pbkdf2-sha256$600000$'));
  assert.equal(await checkPassword(password,stored.replace('$600000$','$999999999$')),false);
});
test('authenticated admin creates normalized account; password hashes are salted and never returned',async()=>{
  const e=env(),password=' A long test password! ';
  const response=await create(e,'  NEW@example.com  ',password),saved=await response.json();
  assert.equal(response.status,201);assert.equal(saved.account.email,'new@example.com');
  assert.ok(!JSON.stringify(saved).includes('password'));
  const row=await e.DB.prepare('SELECT * FROM admin_accounts').first();
  assert.notEqual(row.password_hash,password);assert.ok(await checkPassword(password,row.password_hash));
  assert.equal(await checkPassword(password.trim(),row.password_hash),false);
  assert.notEqual(row.password_hash,await hashPassword(password));
  const list=await (await call(accounts,e,{key:e.ADMIN_KEY,action:'list'})).json();
  assert.equal(list.accounts.length,1);assert.ok(!JSON.stringify(list).includes(row.password_hash));
  assert.equal((await create(e,'new@example.com')).status,409);
  e.ADMIN_EMAILS='google@example.com';assert.equal((await create(e,'GOOGLE@example.com')).status,409);
  assert.equal((await create(e,'invalid')).status,400);
  assert.equal((await create(e,'other@example.com','too short')).status,400);
  assert.equal((await create(e,'other@example.com','x'.repeat(129))).status,400);
});
test('new email login issues session usable for existing APIs and adding another admin',async()=>{
  const e=env();await create(e);
  const result=await call(login,e,{email:'NEW@example.com',password:'A long test password!'}),data=await result.json();
  const cookie=result.headers.get('set-cookie').split(';')[0],token=cookie.split('=')[1];
  assert.equal(result.status,200);assert.ok(!data.token);assert.equal(data.email,'new@example.com');
  assert.match(result.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.match(result.headers.get('set-cookie'),/; Secure/);
  assert.equal((await isAdmin(e,{session:token})).ok,true);
  assert.equal((await call(accounts,e,{action:'create',email:'second@example.com',password:'Another long password!'},{cookie})).status,201);
  assert.equal((await call(settings,e,{settings:{phone:'02-2277-2442'}},{cookie})).status,200);
  const storedSession=await e.DB.prepare('SELECT * FROM admin_sessions LIMIT 1').first();
  assert.notEqual(storedSession.token_hash,token);assert.ok(!JSON.stringify(storedSession).includes(token));
  const unknown=await call(login,e,{email:'unknown@example.com',password:'wrong password'});
  const wrong=await call(login,e,{email:'new@example.com',password:'wrong password'});
  assert.equal(wrong.status,401);assert.deepEqual(await wrong.json(),await unknown.json());
  await e.DB.prepare('DELETE FROM admin_accounts WHERE email=?').bind('new@example.com').run();
  assert.equal((await isAdmin(e,{session:token})).ok,false);
});
test('login throttling survives requests and returns retry-after without password disclosure',async()=>{
  const e=env();await create(e);
  for(let i=0;i<5;i++) assert.equal((await call(login,e,{email:'new@example.com',password:'wrong password'})).status,401);
  const limited=await call(login,e,{email:'new@example.com',password:'A long test password!'});
  assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'900');
  await e.DB.prepare('UPDATE admin_login_attempts SET expires=0').run();
  assert.equal((await call(login,e,{email:'new@example.com',password:'A long test password!'})).status,200);
});
test('Google-only deployment uses opaque hashed sessions; forged public-client-ID sessions fail',async()=>{
  const e={DB:database(),GOOGLE_CLIENT_ID:'public-client-id',ADMIN_EMAILS:'owner@example.com'};
  const token=await makeSession(e,'google:owner@example.com');
  assert.ok(await verifySession({...e},token));
  assert.equal(await verifySession(e,token+'x'),false);
  const encoder=new TextEncoder(),b64=b=>Buffer.from(b).toString('base64url');
  const payload=b64(encoder.encode(JSON.stringify({sub:'owner@example.com',exp:Date.now()+100000})));
  const publicKey=await crypto.subtle.importKey('raw',encoder.encode(e.GOOGLE_CLIENT_ID),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const forged=payload+'.'+b64(await crypto.subtle.sign('HMAC',publicKey,encoder.encode(payload)));
  assert.equal(await verifySession(e,forged),false);
  assert.equal((await call(accounts,e,{session:forged,action:'list'})).status,403);
  const publicSettings=await (await settings({env:e,request:new Request('https://test.invalid/api/settings')})).json();
  assert.ok(!JSON.stringify(publicSettings).includes('session-secret'));
  assert.equal(await verifySession(e,await makeSession(e,'google:other@example.com')),false);
  assert.equal(await verifySession(e,await makeSession(e,'account:missing')),false);
});
test('Google and shared-key login remain available with verified identities',async()=>{
  const e=env();assert.equal((await call(login,e,{key:e.ADMIN_KEY})).status,200);
  e.ADMIN_EMAILS='owner@example.com';e.GOOGLE_CLIENT_ID='client';
  const originalFetch=globalThis.fetch;
  let claims={aud:'client',iss:'https://accounts.google.com',email_verified:'true',email:'owner@example.com',exp:Math.floor(Date.now()/1000)+600};
  globalThis.fetch=async()=>Response.json(claims);
  try {
    const response=await call(login,e,{idToken:'test-google-token'}),data=await response.json();
    assert.equal(response.status,200);assert.ok(!data.token);assert.ok(await verifySession(e,response.headers.get('set-cookie').split(';')[0].split('=')[1]));
    claims={...claims,email_verified:'false'};assert.equal((await verifyGoogle('token','client')).ok,false);
    claims={...claims,email_verified:'true',aud:'wrong-client'};assert.equal((await verifyGoogle('token','client')).ok,false);
  } finally {globalThis.fetch=originalFetch;}
});

test('cookie sessions reject CSRF, cannot be recovered from database hashes, expire and revoke at logout',async()=>{
  const e=env();await create(e);
  const response=await call(login,e,{email:'new@example.com',password:'A long test password!'});
  const cookie=response.headers.get('set-cookie').split(';')[0],token=cookie.split('=')[1];
  assert.equal((await call(login,e,{action:'check'},{cookie})).status,200);
  const row=await e.DB.prepare('SELECT token_hash FROM admin_sessions').first();
  assert.equal(await verifySession(e,row.token_hash),false);
  for(const headers of [{cookie,Origin:'https://evil.invalid'},{cookie,'sec-fetch-site':'cross-site'}]) {
    assert.equal((await call(accounts,e,{action:'list'},headers)).status,403);
    assert.equal((await call(login,e,{action:'logout'},headers)).status,403);
  }
  const logout=await call(login,e,{action:'logout'},{cookie});
  assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal(await verifySession(e,token),false);
  assert.equal((await call(accounts,e,{action:'list'},{cookie})).status,403);
  const expired=await makeSession(e,'shared-admin');await e.DB.prepare('UPDATE admin_sessions SET expires=0').run();
  assert.equal(await verifySession(e,expired),false);
});

test('password endpoints reject HTTP, non-JSON and oversized streaming bodies without echoing input',async()=>{
  const e=env();
  for(const handler of [accounts,login]) {
    const http=await handler({env:e,request:new Request('http://example.com/api/test',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})});
    assert.equal(http.status,403);
    const notJson=await handler({env:e,request:new Request('https://test.invalid/api/test',{method:'POST',headers:{'content-type':'text/plain'},body:'not-json'})});assert.equal(notJson.status,415);
    const oversized=await call(handler,e,{password:'sensitive-test-marker'.repeat(1500)});
    assert.equal(oversized.status,413);assert.ok(!(await oversized.text()).includes('sensitive-test-marker'));
  }
  const DB={prepare(){throw Error('sensitive database content');},batch(){throw Error('sensitive database content');}};
  const error=await create({DB,ADMIN_KEY:'test-bootstrap-secret'});
  assert.equal(error.status,503);assert.ok(!(await error.text()).includes('sensitive database content'));
});

test('admin frontend clears password fields on failed submission and never stores credentials',async()=>{
  const elements=new Map(),listeners={},writes=[],requests=[],stored=new Map([['glo-admin-key','old-test-key'],['glo-admin-tok','old-test-token'],['glo-admin-sess','old-test-session']]);
  const node=(value='')=>({value,disabled:false,textContent:'',classList:{remove(){},add(){},contains(){return false;}},addEventListener(){}});
  for(const id of ['account-password','account-confirm','account-email','account-create','account-message','adm-password','adm-email','adm-key'])elements.set('#'+id,node());
  const root={innerHTML:'',addEventListener(type,callback){listeners[type]=callback;}};
  const context={window:{location:{hash:''}},document:{getElementById(){return root;},querySelector(selector){return elements.get(selector)||null;}},localStorage:{getItem(k){return stored.get(k)||null;},setItem(k,v){writes.push([k,v]);stored.set(k,v);},removeItem(k){stored.delete(k);}},fetch:async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return Response.json({ok:false,error:'test failure'},{status:400});},console,setTimeout,clearTimeout};
  vm.runInNewContext(readFileSync(new URL('../js/admin.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(stored.has('glo-admin-key'),false);assert.equal(stored.has('glo-admin-tok'),false);assert.equal(stored.has('glo-admin-sess'),false);
  const secret='Frontend password marker!';elements.get('#account-password').value=secret;elements.get('#account-confirm').value=secret;elements.get('#account-email').value='new@example.com';
  listeners.submit({preventDefault(){},target:{id:'adm-account-form',reportValidity(){return true;},reset(){}}});
  assert.equal(elements.get('#account-password').value,'');assert.equal(elements.get('#account-confirm').value,'');
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(elements.get('#account-message').textContent.includes('test failure'));
  assert.ok(requests.some(r=>r.body.action==='create'&&r.body.password===secret));
  assert.ok(requests.every(r=>!r.path.includes(secret)));assert.ok(writes.every(([k,v])=>!k.match(/key|sess|tok|password/)&&!v.includes(secret)));
  elements.get('#adm-password').value=secret;elements.get('#adm-email').value='new@example.com';
  const button=node();listeners.submit({preventDefault(){},target:{id:'adm-login-form',reportValidity(){return true;},querySelector(){return button;}}});
  assert.equal(elements.get('#adm-password').value,'');
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(writes.every(([k,v])=>!k.match(/key|sess|tok|password/)&&!v.includes(secret)));
});
