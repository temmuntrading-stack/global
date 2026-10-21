import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { renderCase,validatePost,sourceId } from '../js/case-layout.mjs';
import { onRequest,migrateImage,allowedImageUrl,uploadOriginalImage } from '../functions/api/blog-import.js';
import { onRequest as publicBlog } from '../functions/api/blog.js';
const post={sourceUrl:'https://blog.naver.com/lawsqare/224095160417',title:'법률정보 <제목>',cat:'형사소송',publishedAt:'2025. 12. 2. 9:30',blocks:[{type:'paragraph',text:'원문 문구 <script>alert(1)</script>'},{type:'heading',text:'검토할 사항'},{type:'paragraph',text:'법률 문구를 그대로 보존합니다.'},{type:'image',url:'https://postfiles.pstatic.net/test.png',alt:'원문 이미지'}]};
function database(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));return {async batch(statements){return Promise.all(statements.map(s=>s.run()));},prepare(query){return {bind(...args){this.args=args;return this;},async run(){return sql.prepare(query).run(...(this.args||[]));},async first(){return sql.prepare(query).get(...(this.args||[]))||null;},async all(){return {results:sql.prepare(query).all(...(this.args||[]))};}};}};}
function media(){const files=new Map();return {files,async head(k){return files.get(k)||null;},async put(k,b,opts){files.set(k,{b,opts});}};}
const call=(env,body)=>onRequest({env,request:new Request('https://test.invalid/api/blog-import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})});
test('source and image host validation reject unrelated sites and redirects',async()=>{
 assert.equal(sourceId(post.sourceUrl),'224095160417');
 for(const url of ['https://evil.test/lawsqare/224095160417','https://blog.naver.com/another/224095160417'])assert.throws(()=>sourceId(url));
 for(const url of ['http://postfiles.pstatic.net/a','https://pstatic.net.evil.test/a','https://127.0.0.1/a'])assert.throws(()=>allowedImageUrl(url));
 await assert.rejects(()=>migrateImage(post.blocks[3].url,media(),async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/a'}})));
});
test('case layout preserves source wording and escapes HTML rather than executing it',()=>{
 const local={...post,blocks:post.blocks.map(b=>b.type==='image'?{...b,url:'/img/naver/test.png'}:b)};
 const html=renderCase(local);assert.ok(html.includes('class="case-detail"'));assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('법률 문구를 그대로 보존합니다.'));assert.ok(html.includes('2025. 12. 2. 9:30'));
 assert.throws(()=>renderCase(post),/저장소/);assert.throws(()=>validatePost({...post,blocks:[]}));
});
test('image migration verifies MIME and size and deduplicates identical bytes in R2',async()=>{
 const store=media(),png=new Uint8Array([137,80,78,71]);const download=async()=>new Response(png,{headers:{'content-type':'image/png'}});
 const url=await migrateImage(post.blocks[3].url,store,download);assert.ok(url.startsWith('/img/naver/'));await migrateImage(post.blocks[3].url,store,download);assert.equal(store.files.size,1);
 await assert.rejects(()=>migrateImage(post.blocks[3].url,store,async()=>new Response('<html>',{headers:{'content-type':'text/html'}})));
 await assert.rejects(()=>migrateImage(post.blocks[3].url,store,async()=>new Response(png,{headers:{'content-type':'image/png','content-length':String(9*1024*1024)}})));
});
test('authenticated image packages verify image signatures and deduplicate storage',async()=>{
 const store=media(),original=post.blocks[3].url;
 const dataUrl='data:image/png;base64,'+btoa(String.fromCharCode(137,80,78,71,13,10,26,10));
 const path=await uploadOriginalImage({original,dataUrl},store);assert.ok(path.startsWith('/img/naver/'));
 await uploadOriginalImage({original,dataUrl},store);assert.equal(store.files.size,1);
 await assert.rejects(()=>uploadOriginalImage({original,dataUrl:'data:image/png;base64,PGh0bWw+'},store));
 await assert.rejects(()=>uploadOriginalImage({original:'https://evil.test/image.png',dataUrl},store));
});
test('bulk import uses existing admin auth, Korean-only source deduplication and original publication date',async()=>{
 const env={DB:database(),MEDIA:media(),ADMIN_KEY:'local-test-only'};
 assert.equal((await call(env,{posts:[post]})).status,403);
 const nativeFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});
 try{
  const first=await (await call(env,{key:env.ADMIN_KEY,posts:[post]})).json();assert.equal(first.results[0].status,'created');
  const again=await (await call(env,{key:env.ADMIN_KEY,posts:[post]})).json();assert.equal(again.results[0].status,'skipped');
  const count=await env.DB.prepare('SELECT count(*) AS n FROM blog').first();assert.equal(count.n,1);
  const existing=await (await call(env,{key:env.ADMIN_KEY,action:'existing'})).json();assert.deepEqual(existing.sourceUrls,[post.sourceUrl]);
  const migrated=await (await call(env,{key:env.ADMIN_KEY,action:'images',images:[post.blocks[3].url]})).json();assert.ok(migrated.images[0].url.startsWith('/img/naver/'));
  const publicRequest=lang=>publicBlog({env,request:new Request('https://test.invalid/api/blog?id='+first.results[0].id+'&lang='+lang)});
  assert.equal((await publicRequest('ko')).status,200);assert.equal((await publicRequest('en')).status,404);
  const saved=await env.DB.prepare('SELECT * FROM blog').first();assert.equal(saved.lang,'ko');assert.equal(saved.source_url,post.sourceUrl);assert.ok(!saved.body.includes('src="https://postfiles'));assert.equal(saved.excerpt,post.blocks[0].text);assert.equal(new Date(saved.ts+9*3600000).toISOString().slice(0,10),'2025-12-02');
  const failed={...post,sourceUrl:'https://blog.naver.com/lawsqare/224095160418'};globalThis.fetch=async()=>new Response('blocked',{status:403});
  const result=await (await call(env,{key:env.ADMIN_KEY,posts:[failed]})).json();assert.equal(result.results[0].status,'error');assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM blog').first()).n,1);
 }finally{globalThis.fetch=nativeFetch;}
});
