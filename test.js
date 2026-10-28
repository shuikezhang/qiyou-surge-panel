const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/QiYou.js','utf8');
const province='<p>2026年10月28日，山东汽油、柴油每升最新价格为：<a>92号汽油</a>为8.57元，<a>95号汽油</a>为9.2元，<a>0号柴油</a>为8.21元，</p><tr><td>2026-09-24</td>';
const city='<div class="daota01_title"><h1>西安油价</h1><br>2026-09-26</div><dl><dt>西安92号汽油</dt><dd>8.49(元)</dd></dl><dl><dt>西安95号汽油</dt><dd>8.97(元)</dd></dl><dl><dt>西安98号汽油</dt><dd>10.25(元)</dd></dl><dl><dt>西安0号柴油</dt><dd>8.19(元)</dd></dl>';
function run(arg,body,status=200,error=null){let result,requested;vm.runInNewContext(code,{$argument:arg,$httpClient:{get:(req,cb)=>{requested=req;cb(error,{status},body)}},$done:x=>{if(result)throw Error('double done');result=x;}});return {result,requested};}
let a=run('shandong',province);assert.match(a.result.content,/92号汽油  8\.57 元\/升/);assert.match(a.result.content,/页面日期 2026年10月28日/);assert.doesNotMatch(a.result.content,/98号汽油/);assert.match(a.requested.url,/^https:/);assert.match(a.result.content,/最近调价 2026-09-24/);
let b=run('shanxi-3/xian',city);assert.match(b.result.content,/95号汽油  8\.97/);assert.match(b.result.content,/页面日期 2026-09-26/);assert.match(b.result.content,/HTTP 来源/);
let c=run('shanxi-3/xian/../../evil','');assert.match(c.result.title,/失败/);
let d=run('shandong','<html></html>');assert.match(d.result.content,/格式变更/);
let e=run('shandong','',503);assert.match(e.result.content,/不可用/);
let f=run('shandong',province.replace('2026年10月28日','2026年10月27日'));assert.match(f.result.content,/2026年10月27日/);assert.doesNotMatch(f.result.title,/今日/);
console.log('6 tests passed');
