const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/QiYou.js','utf8');
const province='<p>2026年10月28日，安徽汽油、柴油每升最新价格为：<a>92号汽油</a>为8.55元，<a>95号汽油</a>为9.14元，<a>0号柴油</a>为8.34元，</p><tr><td>2026-09-24</td>';
const city='<div class="daota01_title"><h1>西安油价</h1><br>2026-09-26</div><dl><dt>西安92号汽油</dt><dd>8.49(元)</dd></dl><dl><dt>西安95号汽油</dt><dd>8.97(元)</dd></dl><dl><dt>西安98号汽油</dt><dd>10.25(元)</dd></dl><dl><dt>西安0号柴油</dt><dd>8.19(元)</dd></dl>';
const forecast='<p>据金联创测算，截至10月28日第九个工作日，参考原油品种均价为106.05美元/桶，变化率为7.18%，影响国内汽柴油标准品零售价应上调410元/吨。</p>窗口期：<td>2026年10月29日</td>';
const range='<meta property="og:release_date" content="2026-10-28 16:33"/>10月29日24时进行，预计上调油价410元/吨，汽柴油价格将大涨0.31元/升—0.37元/升';
const now=Date.parse('2026-10-28T20:28:00+08:00');
function run(arg,reply){let result,reqs=[];const $httpClient={get:(req,cb)=>{reqs.push(req);let x=reply(req,reqs.length);cb(x.error||null,{status:x.status||200},x.body||'');}};vm.runInNewContext(code,{$argument:arg,$httpClient,$done:x=>{assert(!result,'double done');result=x},Date:class extends Date {static now(){return now}},console});return {result,reqs};}
const normal=(req,i)=>({body:i===1?province:i===2?forecast:range});
let a=run('anhui',normal);assert.equal(a.result.title,'安徽油价 · 元/升');assert.equal(a.result.content,'当前价格\n92号  8.55\n95号  9.14\n\n下次调价 · 10月29日24时\n\n预计涨幅 · +0.31～0.37元/升\n\n预计调后价格\n92号  8.86～8.92\n95号  9.45～9.51\n\n预测仅供参考，以正式公告为准');assert(!('icon' in a.result));assert(!('icon-color' in a.result));assert.doesNotMatch(a.result.content,/粗估|待更新|→/);assert.match(a.result.content,/预测仅供参考，以正式公告为准$/);assert.equal(a.reqs.length,3);assert.match(a.reqs[0].url,/^https:/);
let b=run('shanxi-3/xian',(req,i)=>({body:i===1?city:forecast}));assert.match(b.result.title,/西安/);assert.match(b.result.content,/城市来源HTTP｜页面2026-09-26/);assert.doesNotMatch(b.result.content,/98|柴油/);assert.match(b.result.content,/92号  8\.49\n95号  8\.97/);
let c=run('anhui',(req,i)=>({body:i===1?province:forecast.replace('2026年10月29日','2026年10月15日')}));assert.match(c.result.content,/下次调价 · 预测暂不可用/);assert.doesNotMatch(c.result.content,/10月29日/);
let d=run('anhui',(req,i)=>({body:i===1?province:forecast.replace('上调410','下调400')}));assert.match(d.result.content,/下次调价 · 10月29日24时/);assert.doesNotMatch(d.result.content,/8\.15|0\.40/);
let e=run('anhui',(req,i)=>({body:i===1?province:'',status:i===1?200:503}));assert.match(e.result.content,/下次调价 · 预测暂不可用/);assert.match(e.result.content,/92号  8\.55/);
let f=run('anhui',()=>({body:'<html></html>'}));assert.match(f.result.content,/格式变更/);
let g=run('shanxi-3/xian/../../evil',()=>({body:''}));assert.match(g.result.title,/失败/);
let h=run('anhui',(req,i)=>({body:i===1?province:forecast.replace('截至10月28日','截至10月01日')}));assert.match(h.result.content,/下次调价 · 预测暂不可用/);
for (const bad of [range.replace('2026-10-28','2026-10-27'),range.replace('410元/吨','370元/吨'),range.replace('10月29日','10月15日')]) {
  let r=run('anhui',(req,i)=>({body:i===1?province:i===2?forecast:bad}));assert.match(r.result.content,/92号  预测暂不可用/);assert.doesNotMatch(r.result.content,/8\.86|\+0\.31/);
}
let unavailable=run('anhui',(req,i)=>({body:i===1?province:i===2?forecast:'',status:i===3?403:200}));assert.match(unavailable.result.content,/下次调价 · 10月29日24时/);assert.doesNotMatch(unavailable.result.content,/8\.86/);
console.log('12 tests passed');
