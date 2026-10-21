import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { onRequest as blog } from '../functions/api/blog.js';
import { onRequest as blogImport } from '../functions/api/blog-import.js';
import { onRequest as login } from '../functions/api/admin-login.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'imports','dev');fs.mkdirSync(dir,{recursive:true});
const sql=new DatabaseSync(path.join(dir,'preview.sqlite'));sql.exec(fs.readFileSync(path.join(root,'schema.sql'),'utf8'));
const DB={prepare(query){return {bind(...args){this.args=args;return this;},async run(){return sql.prepare(query).run(...(this.args||[]));},async first(){return sql.prepare(query).get(...(this.args||[]))||null;},async all(){return {results:sql.prepare(query).all(...(this.args||[]))};}};},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
const MEDIA={async head(key){return fs.existsSync(path.join(dir,key))?{key}:null;},async put(key,bytes,opts){const dest=path.join(dir,key);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);fs.writeFileSync(dest+'.meta',opts.httpMetadata.contentType);}};
const env={DB,MEDIA,ADMIN_KEY:'local-preview-only'};
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:8082');
 let response;
 if(url.pathname.startsWith('/api/')){
  const bytes=[];for await(const chunk of req)bytes.push(chunk);
  const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(bytes)}:{})});
  const handler={'/api/blog':blog,'/api/blog-import':blogImport,'/api/admin-login':login}[url.pathname];
  response=handler?await handler({request,env}):new Response(JSON.stringify({settings:{}}),{headers:{'content-type':'application/json'}});
 }else if(url.pathname.startsWith('/img/')){
  const file=path.resolve(dir,'.'+url.pathname.slice(4));if(!file.startsWith(dir+path.sep))throw Error('invalid path');
  response=fs.existsSync(file)?new Response(fs.readFileSync(file),{headers:{'content-type':fs.readFileSync(file+'.meta','utf8')}}):new Response('not found',{status:404});
 }else{
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep))throw Error('invalid path');
  response=fs.existsSync(file)&&fs.statSync(file).isFile()?new Response(fs.readFileSync(file),{headers:{'content-type':mime[path.extname(file)]||'application/octet-stream'}}):new Response('not found',{status:404});
 }
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
}catch(error){res.writeHead(500,{'content-type':'text/plain'});res.end(error.message);}});
server.listen(8082,'127.0.0.1',()=>console.log('Isolated import preview: http://127.0.0.1:8082/ (local database only)'));