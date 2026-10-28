/* Surge 油价面板：独立实现；数据来自车主手册或汽油价格网。 */
(function () {
  'use strict';
  var provinces = {
    beijing:['北京','110000'],tianjin:['天津','120000'],hebei:['河北','130000'],shanxi:['山西','140000'],neimenggu:['内蒙古','150000'],liaoning:['辽宁','210000'],jilin:['吉林','220000'],heilongjiang:['黑龙江','230000'],shanghai:['上海','310000'],jiangsu:['江苏','320000'],zhejiang:['浙江','330000'],anhui:['安徽','340000'],fujian:['福建','350000'],jiangxi:['江西','360000'],shandong:['山东','370000'],henan:['河南','410000'],hubei:['湖北','420000'],hunan:['湖南','430000'],guangdong:['广东','440000'],guangxi:['广西','450000'],hainan:['海南','460000'],chongqing:['重庆','500000'],sichuan:['四川','510000'],guizhou:['贵州','520000'],yunnan:['云南','530000'],xizang:['西藏','540000'],'shanxi-3':['陕西','610000'],gansu:['甘肃','620000'],qinghai:['青海','630000'],ningxia:['宁夏','640000'],xinjiang:['新疆','650000']
  };
  var raw = typeof $argument === 'string' ? $argument.trim().toLowerCase() : '';
  var region = raw || 'shandong';
  var province = provinces[region];
  var city = /^([a-z]+(?:-3)?)\/([a-z]+)$/.exec(region);
  if (!province && (!city || !provinces[city[1]])) return fail('地区参数无效，请填省份拼音；陕西用 shanxi-3');
  var url = province ? 'https://www.icauto.com.cn/oil/price_' + province[1] + '_0.html' : 'http://m.qiyoujiage.com/' + region + '.shtml';
  $httpClient.get({url:url,timeout:8000,headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'}},function (err,res,body) {
    if (err || !res || Number(res.status || res.statusCode) !== 200 || !body) return fail('数据源不可用，请稍后再试');
    try {
      var result = province ? parseProvince(body,province[0]) : parseCity(body);
      if (!result) return fail('数据源格式变更，无法核实报价');
      if ([result.p92,result.p95,result.d0].filter(function (x) {return x !== null;}).length < 3) return fail('报价不完整，暂不展示');
      fetchForecast(function (forecast) {
        var lines = forecastLines(result,forecast,!!province);
        $done({title:result.name+'油价 · 元/升',content:lines.join('\n')});
      });
    } catch(e) { fail('数据解析失败'); }
  });
  function fetchForecast(done) {
    var source='https://oil.315i.com/chengpy.html';
    $httpClient.get({url:source,timeout:3000},function (err,res,html) {
      if (err || !res || Number(res.status || res.statusCode)!==200 || !html) return done(null);
      var forecast=html.match(/据金联创测算，截至(\d{1,2})月(\d{1,2})日第[一二三四五六七八九十\d]+个工作日[\s\S]{0,250}?应(上调|下调)(\d{2,4})元\/吨/);
      var window=html.match(/窗口期：[\s\S]{0,180}?(20\d{2})年(\d{1,2})月(\d{1,2})日/);
      if (!forecast || !window) return done(null);
      var posted=window[1]+'-'+pad(forecast[1])+'-'+pad(forecast[2]);
      if (!validWindow(window,posted)) return done(null);
      var data={window:window[1]+'年'+window[2]+'月'+window[3]+'日24时',date:posted,ton:Number(forecast[4]),direction:forecast[3]};
      if (data.ton<50 || data.ton>1500) return done(null);
      // 升价采用同日媒体的汽柴油预测范围，不把标准品吨价直接换算成升价。
      $httpClient.get({url:'https://m.sohu.com/a/1093928064_121455647',timeout:3000},function (err2,res2,html2) {
        if (!err2 && res2 && Number(res2.status || res2.statusCode)===200 && html2) {
          var day=html2.match(/property="og:release_date" content="(20\d{2}-\d{2}-\d{2})/);
          var text=html2.replace(/<[^>]*>/g,'').replace(/\s+/g,'');
          var ton=text.match(/预计上调油价(\d{2,4})元\/吨/);
          var range=text.match(/(0\.\d{2})元\/升[—~～-](0\.\d{2})元\/升/);
          var sameWindow=text.indexOf(Number(window[2])+'月'+Number(window[3])+'日24时')!==-1;
          if (data.direction==='上调' && sameWindow && day && day[1]===data.date && ton && Number(ton[1])===data.ton && range && Number(range[1])>0 && Number(range[2])>=Number(range[1]) && Number(range[2])<2) data.range=[Number(range[1]),Number(range[2])];
        }
        done(data);
      });
    });
  }
  function pad(v) {return ('0'+Number(v)).slice(-2);}
  function validWindow(m,posted) {
    var y=Number(m[1]),mo=Number(m[2]),day=Number(m[3]);
    var deadline=Date.UTC(y,mo-1,day+1,0,0,0)-8*3600000;
    var published=Date.parse(posted+'T00:00:00+08:00');
    return mo>=1 && mo<=12 && day>=1 && day<=31 && deadline>Date.now() && published<=Date.now() && deadline-published<16*86400000;
  }
  function forecastLines(result,f,province) {
    var fuels=[['92号',result.p92],['95号',result.p95]];
    var lines=['当前价格'];
    fuels.forEach(function (item) {lines.push(item[0]+'  '+item[1]);});
    var range=f && f.range;
    lines.push('','下次调价 · '+(f?f.window.replace(/^20\d{2}年/,''):'预测暂不可用'));
    lines.push('','预计涨幅 · '+(range?'+'+range[0].toFixed(2)+'～'+range[1].toFixed(2)+'元/升':'预测暂不可用'));
    lines.push('','预计调后价格');
    fuels.forEach(function (item) {
      var value=range?(Number(item[1])+range[0]).toFixed(2)+'～'+(Number(item[1])+range[1]).toFixed(2):'预测暂不可用';
      lines.push(item[0]+'  '+value);
    });
    lines.push('','预测仅供参考，以正式公告为准');
    if (!province) lines.push('城市来源HTTP｜页面'+result.date);
    return lines;
  }
  function parseProvince(html,name) {
    var pattern = new RegExp('(20\\d{2}年\\d{1,2}月\\d{1,2}日)，'+name+'汽油、柴油每升最新价格为：([\\s\\S]*?)<\\/p>');
    var section = html.match(pattern);
    if (!section) return null;
    var values = {};
    var rx = />(90|92|93|95|97|0)号(汽油|柴油)<\/a>为(\d{1,2}(?:\.\d{1,3})?)元/g;
    var m;
    while ((m=rx.exec(section[2])) !== null) values[m[1]+m[2]]=m[3];
    var recent = html.match(/<tr>\s*<td>(20\d{2}-\d{2}-\d{2})<\/td>/);
    return {name:name,date:section[1],changed:recent && recent[1],p92:price(values['92汽油']),p95:price(values['95汽油']),p98:null,d0:price(values['0柴油'])};
  }
  function parseCity(html) {
    var title=html.match(/<h1>\s*([^<]{1,20})油价\s*<\/h1>/);
    var date=html.match(/<div class="daota01_title">[\s\S]*?<br>\s*(20\d{2}-\d{2}-\d{2})/);
    if (!title || !date) return null;
    var values={}, rx=/<dl>\s*<dt>[^<]*?(92|95|98)号汽油<\/dt>\s*<dd>(\d{1,2}(?:\.\d{1,3})?)\(元\)<\/dd>\s*<\/dl>|<dl>\s*<dt>[^<]*?0号柴油<\/dt>\s*<dd>(\d{1,2}(?:\.\d{1,3})?)\(元\)<\/dd>\s*<\/dl>/g,m;
    while ((m=rx.exec(html)) !== null) values[m[1]||'0']=m[2]||m[3];
    return {name:title[1],date:date[1],p92:price(values['92']),p95:price(values['95']),p98:price(values['98']),d0:price(values['0'])};
  }
  function price(value) { var n=Number(value);return value && n>0 && n<30 ? n.toFixed(2) : null; }
  function fail(message) {$done({title:'油价查询失败',content:message,icon:'exclamationmark.triangle.fill','icon-color':'#FF3B30'});}
})();
