import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function browser(gis=true) {
  const stored=new Map(),writes=[];let callback,prompts=0;
  const element=()=>({innerHTML:'',parentNode:null,appendChild(child){child.parentNode=this;},removeChild(child){child.parentNode=null;},addEventListener(){},querySelector(){return element();}});
  const document={body:element(),createElement:element,addEventListener(){},removeEventListener(){}};
  const google={accounts:{id:{initialize(options){callback=options.callback;},renderButton(){},prompt(){},disableAutoSelect(){}}}};
  const window={prompt(){prompts++;return 'unverified name';},...(gis?{google}:{})};
  const context={window,document,google,localStorage:{getItem(k){return stored.get(k)||null;},setItem(k,v){stored.set(k,v);writes.push([k,v]);},removeItem(k){stored.delete(k);}},atob};
  vm.runInNewContext(readFileSync(new URL('../js/auth.js',import.meta.url),'utf8'),context);
  return {auth:window.AuthGoogle,stored,writes,get prompts(){return prompts;},credential(token){callback({credential:token});}};
}
const token='header.'+Buffer.from(JSON.stringify({name:'Verified owner',email:'owner@example.com',sub:'owner-id'})).toString('base64url')+'.signature';
test('administrator Google sign-in returns its credential once without storing it or a new public profile',async()=>{
  const page=browser(),pending=page.auth.signIn({persist:false,requireGoogle:true});page.credential(token);
  assert.equal((await pending).idToken,token);assert.equal(page.writes.length,0);
  page.stored.set('glo-user',JSON.stringify({name:'Owner',idToken:'old-private-credential'}));page.auth.clearStoredCredential();
  assert.ok(!page.stored.get('glo-user').includes('old-private-credential'));
});
test('public Google profile persists without credentials while current-page board posting retains the in-memory token',async()=>{
  const page=browser(),pending=page.auth.signIn();page.credential(token);await pending;
  assert.equal(page.auth.getUser().idToken,token);assert.ok(page.stored.get('glo-user').includes('Verified owner'));
  assert.ok(page.writes.every(([,value])=>!value.includes(token)&&!value.includes('idToken')));
  page.auth.clearStoredCredential();assert.equal(page.auth.getUser().idToken,undefined);
});
test('administrator sign-in never falls back to a typed display name when Google is unavailable',async()=>{
  const page=browser(false);assert.equal(await page.auth.signIn({persist:false,requireGoogle:true}),null);assert.equal(page.prompts,0);assert.equal(page.writes.length,0);
});
