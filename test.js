const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/QiYou.js','utf8');
const province='<p>2026年10月28日，安徽汽油、柴油每升最新价格为：<a>92号汽油</a>为8.55元，<a>95号汽油</a>为9.14元，<a>0号柴油</a>为8.34元，</p><tr><td>2026-09-24</td>';
const city='<div class="daota01_title"><h1>西安油价</h1><br>2026-09-26</div><dl><dt>西安92号汽油</dt><dd>8.49(元)</dd></dl><dl><dt>西安95号汽油</dt><dd>8.97(元)</dd></dl><dl><dt>西安98号汽油</dt><dd>10.25(元)</dd></dl><dl><dt>西安0号柴油</dt><dd>8.19(元)</dd></dl>';
const forecast='<p>据金联创测算，截至10月28日第九个工作日，参考原油品种均价为106.05美元/桶，变化率为7.18%，影响国内汽柴油标准品零售价应上调410元/吨。</p>窗口期：<td>2026年10月29日</td>';
const range='<meta property="og:release_date" content="2026-10-28 16:33"/>预计上调油价410元/吨，汽柴油价格将大涨0.31元/升—0.37元/升';
const now=Date.parse('2026-10-28T20:28:00+08:00');
function run(arg,reply){let result,reqs=[];const $httpClient={get:(req,cb)=>{reqs.push(req);let x=reply(req,reqs.length);cb(x.error||null,{status:x.status||200},x.body||'');}};vm.runInNewContext(code,{$argument:arg,$httpClient,$done:x=>{assert(!result,'double done');result=x},Date:class extends Date {static now(){return now}},console});return {result,reqs};}
const normal=(req,i)=>({body:i===1?province:i===2?forecast:range});
let a=run('anhui',normal);assert.match(a.result.content,/92  8\.55 → 8\.86～8\.92/);assert.match(a.result.content,/95  9\.14 → 9\.45～9\.51/);assert.match(a.result.content,/0柴  8\.34 → 8\.65～8\.71/);assert.match(a.result.content,/下次10月29日24时｜预计上调410元\/吨/);assert.match(a.result.content,/预测10\/28｜→粗估非官方/);assert(a.result.content.split('\n').length<=5);assert.match(a.reqs[0].url,/^https:/);
let b=run('shanxi-3/xian',(req,i)=>({body:i===1?city:i===2?forecast:range}));assert.match(b.result.title,/西安/);assert.match(b.result.content,/城市来源HTTP/);assert.match(b.result.content,/95  8\.97 →/);
let c=run('anhui',(req,i)=>({body:i===1?province:i===2?forecast.replace('2026年10月29日','2026年10月15日'):range}));assert.match(c.result.content,/下次调价：暂无可核实预测/);assert.doesNotMatch(c.result.content,/ → /);
let d=run('anhui',(req,i)=>({body:i===1?province:i===2?forecast:range.replace('410元/吨','370元/吨')}));assert.match(d.result.content,/预计上调410元\/吨/);assert.match(d.result.content,/调后价暂无法估算/);
let e=run('anhui',(req,i)=>({body:i===1?province:'',status:i===1?200:503}));assert.match(e.result.content,/下次调价：暂无可核实预测/);
let f=run('anhui',()=>({body:'<html></html>'}));assert.match(f.result.content,/格式变更/);
let g=run('shanxi-3/xian/../../evil',()=>({body:''}));assert.match(g.result.title,/失败/);
let h=run('anhui',(req,i)=>({body:i===1?province:i===2?forecast.replace('截至10月28日','截至10月01日'):range}));assert.match(h.result.content,/下次调价：暂无可核实预测/);
console.log('8 tests passed');
