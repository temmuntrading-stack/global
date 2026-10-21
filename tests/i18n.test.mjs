import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync('js/i18n.js','utf8'),context);
for(const file of fs.readdirSync('js').filter(f=>/^i18n-/.test(f)))vm.runInContext(fs.readFileSync('js/'+file,'utf8'),context);
test('all public page translation bindings and dynamic board/auth labels exist in all 11 languages',()=>{
 const keys=new Set();
 for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html')&&!f.startsWith('admin'))){for(const m of fs.readFileSync(file,'utf8').matchAll(/data-i18n(?:-html|-ph|-aria|-title)?="([^"]+)"/g))keys.add(m[1]);}
 for(const file of ['js/board.js','js/auth.js','js/blog.js'])for(const m of fs.readFileSync(file,'utf8').matchAll(/tr\("([^"]+)"\)/g))keys.add(m[1]);
 for(const key of ['f.validation','f.unavailable','f.error','f.network'])keys.add(key);
 for(const lang of context.window.LANGS)for(const key of keys)assert.ok(context.window.I18N[lang.code][key],lang.code+': '+key);
});
test('home and contact use the same address and map query, with no stale station guidance',()=>{
 const home=fs.readFileSync('index.html','utf8'),contact=fs.readFileSync('contact.html','utf8');
 const map=html=>html.match(/src="(https:\/\/maps.google.com\/maps\?[^\"]+)"/)[1];
 assert.equal(map(home),map(contact));
 assert.ok(!contact.includes('126.9922'));
 for(const lang of context.window.LANGS){const d=context.window.I18N[lang.code];assert.equal(d['contact.map.label'],d['loc.map']);assert.ok(d['ci.addr.v'].includes('301')||d['ci.addr.v'].includes('३०१'));}
 assert.equal(context.window.I18N.mn['loc.title'],'Манай хаяг');
});