import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/contact.js';
function database(){
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  return {prepare(query){return {bind(...args){this.args=args;return this;},async run(){return sql.prepare(query).run(...(this.args||[]));},async first(){return sql.prepare(query).get(...(this.args||[]))||null;},async all(){return {results:sql.prepare(query).all(...(this.args||[]))};}};}};
}
const payload={name:'Test visitor',email:'visitor@example.com',phone:'',lang:'km',area:'민사소송',message:'Integration test only'};
function request(env,method='GET',body,query=''){
 return onRequest({env,request:new Request('https://test.invalid/api/contact'+query,{method,...(body!==undefined?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})})});
}
test('consultation storage, admin read, status and delete round trip',async()=>{
 const env={DB:database(),ADMIN_KEY:'test-only-secret'};
 const created=await request(env,'POST',payload);assert.equal(created.status,200);const {id}=await created.json();assert.ok(id);
 assert.equal((await request(env)).status,403);
 assert.equal((await request(env,'POST',{adminAction:'status',id,status:'done'})).status,403);
 const list=await (await request(env,'GET',undefined,'?key=test-only-secret')).json();assert.equal(list.inquiries.length,1);assert.equal(list.inquiries[0].lang,'km');assert.equal(list.inquiries[0].message,payload.message);
 const detail=await (await request(env,'GET',undefined,'?key=test-only-secret&id='+id)).json();assert.equal(detail.inquiry.email,payload.email);
 assert.equal((await request(env,'POST',{adminAction:'status',key:env.ADMIN_KEY,id,status:'bad'})).status,400);
 assert.equal((await request(env,'POST',{adminAction:'status',key:env.ADMIN_KEY,id:'missing',status:'done'})).status,404);
 assert.equal((await request(env,'POST',{adminAction:'status',key:env.ADMIN_KEY,id,status:'done'})).status,200);
 const updated=await (await request(env,'GET',undefined,'?key=test-only-secret&id='+id)).json();assert.equal(updated.inquiry.status,'done');
 assert.equal((await request(env,'DELETE',{key:env.ADMIN_KEY,id})).status,200);
 assert.equal((await request(env,'GET',undefined,'?key=test-only-secret&id='+id)).status,404);
});
test('invalid form inputs never create consultation records',async()=>{
 const env={DB:database(),ADMIN_KEY:'test-only-secret'};
 for(const patch of [{name:' '},{email:'invalid'},{message:' '},{message:'x'.repeat(5001)},{name:'x'.repeat(61)}])assert.equal((await request(env,'POST',{...payload,...patch})).status,400);
 assert.equal((await (await request(env,'GET',undefined,'?key=test-only-secret')).json()).inquiries.length,0);
});
test('database outages cannot be mistaken for successful receipt or expose details',async()=>{
 assert.equal((await request({},'POST',payload)).status,503);
 const DB={prepare(){throw Error('internal database secret');}};
 const result=await request({DB},'POST',payload);assert.equal(result.status,500);assert.ok(!(await result.text()).includes('secret'));
});