const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {languages,rows,detect,t,message}=require('../i18n');
test('system languages map regional variants and unsupported languages fall back to English',()=>{
 for(const [input,expected] of [['zh_CN','zh-CN'],['zh-Hant-TW','zh-CN'],['en-GB','en'],['ja-JP','ja'],['ko-KR','ko'],['fr-FR','en'],['','en']])assert.equal(detect([input]),expected);
 assert.equal(detect(['fr-FR','ja-JP']),'ja');assert.equal(detect([]),'en');
});
test('all translation keys are complete and preserve interpolation parameters',()=>{
 for(const [key,row] of Object.entries(rows)){assert.equal(row.length,4,key);const parameters=row[0].match(/\{\w+\}/g)||[];for(const text of row){assert.ok(typeof text==='string'&&text.trim(),key);assert.deepEqual((text.match(/\{\w+\}/g)||[]).sort(),[...parameters].sort(),key)}}
 assert.equal(t('en','selected',{count:3}),'3 highlights selected');assert.equal(message('ja','时间无效'),t('ja','timeError'));
});
test('all static and literal renderer translation keys exist',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');for(const m of html.matchAll(/data-i18n(?:-aria|-placeholder)?="([^"]+)"/g))assert.ok(rows[m[1]],m[1]);
 const js=fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8');for(const m of js.matchAll(/\bt\('([^']+)'/g))assert.ok(rows[m[1]],m[1]);
 assert.ok(!html.includes('data-tab="heroes"'));assert.ok(js.includes('id="refreshHeroes"'));
});
test('bundled hero labels contain each existing hero in all four languages',()=>{
 const heroes=require('../assets/heroes.json'),names=require('../assets/hero-names.json');for(const language of languages)for(const hero of heroes)assert.ok(names[language][hero.key],`${language}: ${hero.key}`);
});
