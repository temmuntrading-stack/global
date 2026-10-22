import { isAdmin } from './_auth.js';
import { renderCase, sourceId, validatePost } from '../../js/case-layout.mjs';

const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const imageTypes = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
const MAX_IMAGE = 8*1024*1024;
export async function storeImageBytes(bytes,type,media){
  const valid=type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:
    type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
    type==='image/gif'?String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/):
    type==='image/webp'?String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP':false;
  if(!bytes.length||bytes.length>MAX_IMAGE||!valid)throw new Error('이미지 형식 또는 크기를 확인하세요.');
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const key='naver/'+digest+'.'+imageTypes[type];
  if(!(await media.head(key)))await media.put(key,bytes,{httpMetadata:{contentType:type,cacheControl:'public, max-age=31536000, immutable'}});
  return '/img/'+key;
}
export async function uploadOriginalImage(item,media){
  allowedImageUrl(item.original);
  if(typeof item.dataUrl!=='string'||item.dataUrl.length>Math.ceil(MAX_IMAGE*4/3)+100)throw new Error('8MB 이하의 원본 이미지가 필요합니다.');
  const match=item.dataUrl.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match)throw new Error('지원하지 않는 원본 이미지 형식');
  const binary=atob(match[2]),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return storeImageBytes(bytes,match[1],media);
}
export function allowedImageUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.pstatic.net') || url.username || url.password || (url.port && url.port !== '443')) throw new Error('네이버 원본 이미지 주소만 허용됩니다.');
  return url;
}
export async function migrateImage(value, media, fetchImage=fetch) {
  let url = allowedImageUrl(value), response;
  for(let i=0;i<4;i++) {
    response = await fetchImage(url.href,{headers:{Referer:'https://blog.naver.com/lawsqare','User-Agent':'Mozilla/5.0'},redirect:'manual',signal:AbortSignal.timeout(20000)});
    if ([301,302,303,307,308].includes(response.status)) { url=allowedImageUrl(new URL(response.headers.get('location'),url).href); continue; }
    break;
  }
  if (!response?.ok) throw new Error('원본 이미지 다운로드 실패');
  const type = (response.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if (!imageTypes[type]) throw new Error('지원하지 않는 원본 이미지 형식');
  if (Number(response.headers.get('content-length')) > MAX_IMAGE) throw new Error('8MB를 넘는 이미지');
  const reader=response.body.getReader(), chunks=[];let total=0;
  while(true){const {done,value:chunk}=await reader.read();if(done)break;total+=chunk.length;if(total>MAX_IMAGE){await reader.cancel();throw new Error('8MB를 넘는 이미지');}chunks.push(chunk);}
  const bytes = new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return storeImageBytes(bytes,type,media);
}
const ready=new WeakSet();
async function schema(db){
  if(ready.has(db))return;
  await db.prepare('CREATE TABLE IF NOT EXISTS blog (id TEXT PRIMARY KEY, title TEXT NOT NULL, cat TEXT, body TEXT NOT NULL, ts INTEGER NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS blog_cats (name TEXT PRIMARY KEY, ts INTEGER NOT NULL)').run();
  for(const [name,type] of [['image','TEXT'],['status','TEXT'],['lang','TEXT'],['source_url','TEXT'],['source_published_at','TEXT'],['excerpt','TEXT']]) {
    const columns=await db.prepare('PRAGMA table_info(blog)').all();
    if(!columns.results.some(c=>c.name===name))await db.prepare('ALTER TABLE blog ADD COLUMN '+name+' '+type).run();
  }
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_source_url ON blog(source_url)').run();ready.add(db);
}
export async function onRequest({request,env}){
  if(request.method!=='POST')return json({error:'method not allowed'},405);
  const data=await request.json().catch(()=>null);
  if(!data)return json({error:'JSON 파일을 확인하세요.'},400);
  if(!(await isAdmin(env,data,request)).ok)return json({error:'관리자 로그인이 필요합니다.'},403);
  if(!env.DB||!env.MEDIA)return json({error:'D1과 R2 연결이 필요합니다.'},503);
  if(data.action==='existing'){
    try{await schema(env.DB);const {results}=await env.DB.prepare('SELECT source_url FROM blog WHERE source_url IS NOT NULL').all();return json({sourceUrls:results.map(p=>p.source_url)});}
    catch(e){return json({error:'기존 이전 내역을 불러오지 못했습니다.'},500);}
  }
  if(data.action==='images'){
    if(!Array.isArray(data.images)||!data.images.length||data.images.length>3)return json({error:'이미지는 한 번에 최대 3개씩 처리합니다.'},400);
    const images=[];
    for(const item of data.images){
      const original=typeof item==='string'?item:item?.original;
      try{images.push({original,url:typeof item==='string'?await migrateImage(original,env.MEDIA):await uploadOriginalImage(item,env.MEDIA)});}
      catch(e){images.push({original,error:e.message});}
    }
    return json({images});
  }
  if(!Array.isArray(data.posts)||!data.posts.length||data.posts.length>3)return json({error:'한 번에 최대 3개 글을 처리합니다.'},400);
  try {
    for(const post of data.posts)validatePost(post);
    await schema(env.DB);
  }catch(e){return json({error:e.message},400);}
  const results=[];
  for(const input of data.posts){
    try{
      const id=sourceId(input.sourceUrl), sourceUrl='https://blog.naver.com/lawsqare/'+id;
      const existing=await env.DB.prepare('SELECT id,source_url FROM blog WHERE source_url=? OR (title=? AND lang=\'ko\' AND body LIKE ?) LIMIT 1').bind(sourceUrl,input.title,'%'+id+'%').first();
      if(existing?.source_url&&!data.refresh){results.push({sourceUrl,status:'skipped',id:existing.id});continue;}
      const post={...input,blocks:input.blocks.map(b=>({...b})),lang:'ko'};
      const remoteImages=post.blocks.filter(b=>b.type==='image'&&!/^\/img\/naver\/[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(b.url));
      if(remoteImages.length>6)throw new Error('이미지를 먼저 나누어 이전한 후 글을 저장해 주세요.');
      for(const block of remoteImages)block.url=await migrateImage(block.url,env.MEDIA);
      const body=renderCase(post),cover=post.blocks.find(b=>b.type==='image')?.url||'';
      const excerpt=(post.blocks.find(b=>b.type==='paragraph')?.text||post.title).slice(0,200);
      const date=String(post.publishedAt||'').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      const ts=date?Date.UTC(+date[1],+date[2]-1,+date[3])-9*3600000:Date.now();
      await env.DB.prepare('INSERT OR IGNORE INTO blog_cats(name,ts) VALUES (?,?)').bind(String(post.cat||'법률정보').slice(0,40),Date.now()).run();
      const savedId=existing?.id||'naver-'+id;
      await env.DB.prepare("INSERT INTO blog(id,title,cat,body,ts,image,status,lang,source_url,source_published_at,excerpt) VALUES (?,?,?,?,?,?,'published','ko',?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,cat=excluded.cat,body=excluded.body,ts=excluded.ts,image=excluded.image,status='published',lang='ko',source_url=excluded.source_url,source_published_at=excluded.source_published_at,excerpt=excluded.excerpt")
        .bind(savedId,post.title,String(post.cat||'법률정보').slice(0,40),body,ts,cover,sourceUrl,String(post.publishedAt||''),excerpt).run();
      results.push({sourceUrl,status:existing?'updated':'created',id:savedId});
    }catch(e){results.push({sourceUrl:input.sourceUrl,status:'error',error:e.message});}
  }
  return json({results});
}
