const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/QiYou.js','utf8');
const province='<p>2026年10月29日，安徽汽油、柴油每升最新价格为：<a>92号汽油</a>为8.55元，<a>95号汽油</a>为9.14元，<a>0号柴油</a>为8.34元，</p>';
const jlc=(day,win,ton=410,dir='上调')=>`<p>据金联创测算，截至${day}第十个工作日，影响国内汽柴油标准品零售价分别${dir}<span>${ton}和335</span>元/吨。</p>窗口期：<td>${win}</td>`;
const list=(day='2026/10/29',path='./202610/t20261029_1408449.html')=>`<li class="news"><a title="国内成品油价格调整" href="${path}"><span>国内成品油价格调整</span></a><span>${day}</span></li>`;
const official='<div>根据现行价格机制计算，自10月29日24时起，国内汽、柴油（标准品）价格每吨分别应上调440元、420元，调控后实际上调345元、335元。</div>';
function run({time='2026-10-29T16:30:00+08:00',forecast=jlc('10月29日','2026年10月29日'),index=list(),article=official,arg='anhui',price=province,reverse=false}={}) {
 let result,count=0,queue=[],reqs=[];const clock=Date.parse(time);
 const $httpClient={get:(req,cb)=>{reqs.push(req.url);let body=req.url.includes('icauto')||req.url.includes('qiyoujiage')?price:req.url.includes('315i')?forecast:req.url.endsWith('/xwfb/')?index:article;
 const job=()=>cb(body===null?'network':null,{status:body===null?503:200},body||'');queue.push(job)}};
 vm.runInNewContext(code,{$argument:arg,$httpClient,$done:x=>{assert(!result,'double done');result=x;count++},Date:class extends Date{static now(){return clock}},console});
 while(queue.length){if(reverse)queue.pop()();else queue.shift()();}assert.equal(count,1);return {result,reqs};
}
let tests=0;function test(name,fn){fn();tests++;console.log('PASS '+name)}
test('official overrides theoretical and old prediction',()=>{let {result,reqs}=run();assert.match(result.content,/8\.81～8\.86/);assert.match(result.content,/9\.40～9\.45/);assert.match(result.content,/官方汽油\+345/);assert.equal(reqs.length,4);assert.doesNotMatch(result.content,/媒体|粗估/);assert(!result.icon)});
test('parallel callback order independent',()=>{assert.equal(run({reverse:true}).result.content,run().result.content)});
test('official works when JLC unavailable',()=>assert.match(run({forecast:null}).result.content,/官方汽油\+345/));
test('prediction works when official index unavailable',()=>assert.match(run({index:null}).result.content,/机构预测汽油\+410/));
test('before announcement never use past official',()=>{let r=run({time:'2026-10-28T17:00:00+08:00',forecast:jlc('10月28日','2026年10月29日'),index:list('2026/10/15')});assert.match(r.result.content,/8\.86～8\.92/);assert.equal(r.reqs.length,3)});
test('found unreadable announcement blocks old prediction',()=>assert.doesNotMatch(run({article:'new format no actual data'}).result.content,/8\.86|\+410/));
test('article HTTP failure blocks old prediction',()=>assert.match(run({article:null}).result.content,/预测暂不可用/));
test('downward ranges order low to high',()=>{let r=run({index:'',forecast:jlc('10月29日','2026年10月29日',555,'下调')});assert.match(r.result.content,/-0\.42～0\.50/);assert.match(r.result.content,/8\.05～8\.13/)});
test('normal official down adjustment',()=>{let r=run({article:'自10月29日24时起，国内汽、柴油（标准品）价格每吨分别下调555元、530元。'});assert.match(r.result.content,/官方汽油-555/)});
test('no adjustment retains current prices',()=>{let r=run({article:'本次汽、柴油价格不作调整。'});assert.match(r.result.content,/预计涨跌 · 不调整/);assert.match(r.result.content,/官方汽油不调整/)});
test('cross month target and forecast',()=>{let r=run({time:'2026-10-31T18:00:00+08:00',forecast:jlc('10月31日','2026年11月5日'),index:''});assert.match(r.result.content,/11月5日24时/)});
test('cross year target and forecast',()=>{let r=run({time:'2026-12-31T18:00:00+08:00',forecast:jlc('12月31日','2027年1月5日'),index:''});assert.match(r.result.content,/1月5日24时/)});
test('expired cycle rejected at midnight',()=>{let r=run({time:'2026-10-30T00:00:00+08:00',index:list('2026/10/29')});assert.match(r.result.content,/预测暂不可用/)});
test('over four day observation rejected',()=>assert.match(run({forecast:jlc('10月24日','2026年10月29日'),index:''}).result.content,/预测暂不可用/));
test('future observation rejected',()=>assert.match(run({forecast:jlc('10月30日','2026年11月5日'),index:''}).result.content,/预测暂不可用/));
test('invalid calendar date rejected',()=>assert.match(run({forecast:jlc('10月29日','2026年11月31日'),index:''}).result.content,/预测暂不可用/));
test('huge ton rejected',()=>assert.match(run({forecast:jlc('10月29日','2026年10月29日',9999),index:''}).result.content,/预测暂不可用/));
test('no same-day effective date rejects article',()=>assert.match(run({article:official.replace('10月29日','10月15日')}).result.content,/预测暂不可用/));
test('old cycle item not reused',()=>assert.match(run({index:list('2026/10/15')}).result.content,/机构预测汽油\+410/));
test('markup and entities inside ton are normalized',()=>assert.match(run({index:'',forecast:jlc('10月29日','2026年10月29日').replace('410和335','<b>410</b>&nbsp;和335')}).result.content,/机构预测汽油\+410/));
test('both sources unavailable current price survives',()=>assert.match(run({forecast:null,index:null}).result.content,/92号  8\.55/));
test('invalid region stops safely',()=>assert.match(run({arg:'../../bad'}).result.title,/失败/));
test('JLC table fallback independent of banner wording',()=>{let r=run({index:'',forecast:'<td>对应幅度(元/吨)</td><td>10月29日</td><td>7.94%</td><td>↑0.76</td><td>上调345、335</td><td>工作日：10</td><td>窗口期：2026年10月29日</td>'});assert.match(r.result.content,/机构预测汽油\+345/)});
console.log(`${tests} tests passed`);
