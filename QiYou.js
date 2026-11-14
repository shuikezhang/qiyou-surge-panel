/* Surge 油价面板：独立实现；数据来自东方财富、汽油价格网或车主手册。 */
(function () {
  'use strict';
  var settled = false;
  function finishDone(payload) {
    if (settled) return;
    settled = true;
    $done(payload);
  }
  var provinces = {
    beijing:['北京','110000'],tianjin:['天津','120000'],hebei:['河北','130000'],shanxi:['山西','140000'],neimenggu:['内蒙古','150000'],liaoning:['辽宁','210000'],jilin:['吉林','220000'],heilongjiang:['黑龙江','230000'],shanghai:['上海','310000'],jiangsu:['江苏','320000'],zhejiang:['浙江','330000'],anhui:['安徽','340000'],fujian:['福建','350000'],jiangxi:['江西','360000'],shandong:['山东','370000'],henan:['河南','410000'],hubei:['湖北','420000'],hunan:['湖南','430000'],guangdong:['广东','440000'],guangxi:['广西','450000'],hainan:['海南','460000'],chongqing:['重庆','500000'],sichuan:['四川','510000'],guizhou:['贵州','520000'],yunnan:['云南','530000'],xizang:['西藏','540000'],'shanxi-3':['陕西','610000'],gansu:['甘肃','620000'],qinghai:['青海','630000'],ningxia:['宁夏','640000'],xinjiang:['新疆','650000']
  };
  var raw = typeof $argument === 'string' ? $argument.trim().toLowerCase() : '';
  var region = raw || 'shandong';
  var province = provinces[region];
  var city = /^([a-z]+(?:-3)?)\/([a-z]+)$/.exec(region);
  if (!province && (!city || !provinces[city[1]])) return fail('地区参数无效，请填省份拼音；陕西用 shanxi-3');
  var uaHeaders = {'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'};

  function hasCompletePrices(res) {
    return [res.p92,res.p95,res.d0].filter(function (x) {return x !== null;}).length === 3;
  }

  function renderResult(result, isProvince) {
    fetchForecast(function (forecast) {
      try {
        var lines = forecastLines(result,forecast,isProvince);
        finishDone({title:result.name+'油价 · 元/升',content:lines.join('\n')});
      } catch (e) {
        fail('数据解析失败');
      }
    });
  }

  if (province) {
    var sources = [
      {
        url: 'https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_YJ_JH&columns=DIM_DATE,CITYNAME,V92,V95,V0&filter=(CITYNAME%3D%22' + encodeURIComponent(province[0]) + '%22)&pageNumber=1&pageSize=1&sortTypes=-1&sortColumns=DIM_DATE',
        timeout: 4000,
        parse: function (body) { return parseEastMoney(body,province[0]); }
      },
      {
        url: 'http://m.qiyoujiage.com/' + region + '.shtml',
        timeout: 4000,
        parse: function (body) {
          var res = parseCity(body);
          if (!res || res.name !== province[0]) return null;
          res.insecure = true;
          return res;
        }
      },
      {
        url: 'https://www.icauto.com.cn/oil/price_' + province[1] + '_0.html',
        timeout: 3500,
        parse: function (body) {
          var res = parseProvince(body,province[0]);
          if (res) res.insecure = false;
          return res;
        }
      }
    ];
    var had200 = false;
    var hadIncomplete = false;
    (function trySource(idx) {
      if (idx >= sources.length) {
        if (!had200) return fail('数据源不可用，请稍后再试');
        if (hadIncomplete) return fail('报价不完整，暂不展示');
        return fail('数据源格式变更，无法核实报价');
      }
      var current = sources[idx];
      var stepDone = false;
      $httpClient.get({url:current.url,timeout:current.timeout,headers:uaHeaders},function (err,res,body) {
        if (stepDone) return;
        stepDone = true;
        if (!err && res && Number(res.status || res.statusCode) === 200 && body) {
          had200 = true;
          try {
            var parsed = current.parse(body);
            if (parsed) {
              if (hasCompletePrices(parsed)) return renderResult(parsed,true);
              hadIncomplete = true;
            }
          } catch (e) {}
        }
        trySource(idx + 1);
      });
    })(0);
  } else {
    $httpClient.get({url:'http://m.qiyoujiage.com/' + region + '.shtml',timeout:6000,headers:uaHeaders},function (err,res,body) {
      if (err || !res || Number(res.status || res.statusCode) !== 200 || !body) return fail('数据源不可用，请稍后再试');
      try {
        var result = parseCity(body);
        if (!result) return fail('数据源格式变更，无法核实报价');
        if (!hasCompletePrices(result)) return fail('报价不完整，暂不展示');
        renderResult(result,false);
      } catch (e) { fail('数据解析失败'); }
    });
  }

  function fetchForecast(done) {
    var today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
    var prediction=null,official=null,pending=2,blocked=false,finished=false;
    function finish() {
      if (finished || --pending!==0) return;
      finished=true;
      // 发现今日正式文章却无法读懂实际调幅时，拒绝回退到可能失效的机构预测。
      done(blocked?null:withEstimate(official || prediction));
    }
    var jlcDone=false;
    function finishJlc() {
      if (jlcDone) return;
      jlcDone=true;
      finish();
    }
    var ndrcDone=false;
    function finishNdrc() {
      if (ndrcDone) return;
      ndrcDone=true;
      finish();
    }
    $httpClient.get({url:'https://oil.315i.com/chengpy.html',timeout:4500},function (err,res,html) {
      try {
        if (!err && res && Number(res.status || res.statusCode)===200 && html) {
          var text=plainText(html).replace(/\s+/g,'');
          var w=text.match(/窗口期[:：](20\d{2})年(\d{1,2})月(\d{1,2})日/);
          var e=text.match(/据金联创测算[,，]?截至(\d{1,2})月(\d{1,2})日[\s\S]{0,260}?(?:应|分别)?(上调|下调)(\d{2,4})(?:[和、]\d{2,4})?元\/吨/);
          // 公告栏措辞变动时，独立尝试同页日期/调幅数据表。
          if (!e) e=text.match(/对应幅度[（(]元\/吨[）)](\d{1,2})月(\d{1,2})日[\s\S]{0,45}?(上调|下调)(\d{2,4})(?:[、和]\d{2,4})?工作日/);
          if (w && e) {
            var year=Number(w[1])-(Number(e[1])>Number(w[2])?1:0);
            var posted=year+'-'+pad(e[1])+'-'+pad(e[2]);
            if (validWindow(w,posted) && Number(e[4])>=50 && Number(e[4])<=1500) prediction={window:w[1]+'年'+w[2]+'月'+w[3]+'日24时',date:posted,ton:Number(e[4]),direction:e[3]};
          }
        }
      } catch (e) {}
      finishJlc();
    });
    $httpClient.get({url:'https://www.ndrc.gov.cn/xwdt/xwfb/',timeout:4500},function (err,res,html) {
      var articleRequested=false;
      try {
        if (err || !res || Number(res.status || res.statusCode)!==200 || !html) return finishNdrc();
        var articles=/<li\b[^>]*>([\s\S]*?)<\/li>/gi,m,link=null;
        while ((m=articles.exec(html))!==null) {
          var item=plainText(m[1]),date=item.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/);
          var href=m[1].match(/href=["'](\.\/(?:20\d{4})\/t\d{8}_\d+\.html)["']/);
          if (date && href && date[1]+'-'+pad(date[2])+'-'+pad(date[3])===today && /成品油价格|成品油.*调控/.test(item)) {link=href[1];break;}
        }
        if (!link) return finishNdrc();
        articleRequested=true;
        $httpClient.get({url:'https://www.ndrc.gov.cn/xwdt/xwfb/'+link.slice(2),timeout:4500},function (aErr,aRes,article) {
          try {
            if (aErr || !aRes || Number(aRes.status || aRes.statusCode)!==200 || !article) {blocked=true;return finishNdrc();}
            var body=plainText(article).replace(/\s+/g,'');
            var w=today.split('-');
            var data={window:w[0]+'年'+Number(w[1])+'月'+Number(w[2])+'日24时',date:today,official:true};
            if (/本次(?:国内成品油|汽、柴油)价格不作调整/.test(body)) {
              data.ton=0;data.direction='不调整';official=data;return finishNdrc();
            }
            // 必须有正文同日生效时间；调整前回顾中的旧调幅不能被误取。
            var effective=new RegExp('(?:自)?'+Number(w[1])+'月'+Number(w[2])+'日(?:24时起|国内汽)');
            var actual=body.match(/调控后实际(上调|下调)(\d{2,4})元[、,，](\d{2,4})元/);
            if (!actual && !/调控后|实际(?:上调|下调)/.test(body)) actual=body.match(/国内汽、柴油[（(]标准品[）)]价格每吨分别(上调|下调)(\d{2,4})元[、,，](\d{2,4})元/);
            if (!effective.test(body) || !actual || Number(actual[2])<50 || Number(actual[2])>1500 || Number(actual[3])<0 || Number(actual[3])>1500) {blocked=true;return finishNdrc();}
            data.direction=actual[1];data.ton=Number(actual[2]);official=data;finishNdrc();
          } catch (e) {
            blocked=true;
            finishNdrc();
          }
        });
      } catch (e) {
        if (!articleRequested) finishNdrc();
      }
    });
  }
  function plainText(html) {return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();}
  function withEstimate(data) {
    if (!data) return null;
    // 经验比例，仅作升价估算，非官方分油号换算。345元/吨→0.26～0.31，410→0.31～0.37。
    if (data.ton===0) data.range=[0,0];
    else data.range=[Math.round(data.ton*0.00075*100)/100,Math.round(data.ton*0.0009*100)/100];
    return data;
  }
  function pad(v) {return ('0'+Number(v)).slice(-2);}
  function validWindow(m,posted) {
    var y=Number(m[1]),mo=Number(m[2]),day=Number(m[3]);
    var deadline=Date.UTC(y,mo-1,day+1,0,0,0)-8*3600000;
    var published=Date.parse(posted+'T00:00:00+08:00');
    var normalized=new Date(Date.UTC(y,mo-1,day)).toISOString().slice(0,10);
    return normalized===y+'-'+pad(mo)+'-'+pad(day) && deadline>Date.now() && published<=Date.now() && Date.now()-published<=4*86400000 && deadline-published<16*86400000;
  }
  function forecastLines(result,f,province) {
    var fuels=[['92号',result.p92],['95号',result.p95]];
    var lines=['当前价格'];
    fuels.forEach(function (item) {lines.push(item[0]+'  '+item[1]);});
    var range=f && f.range;
    lines.push('','下次调价 · '+(f?f.window.replace(/^20\d{2}年/,''):'预测暂不可用'));
    var sign=f && f.direction==='下调'?-1:1;
    lines.push('','预计涨跌 · '+(range?(f.ton===0?'不调整':(sign<0?'-':'+')+range[0].toFixed(2)+'～'+range[1].toFixed(2)+'元/升'):'预测暂不可用'));
    lines.push('','预计调后价格');
    fuels.forEach(function (item) {
      var low=range && Number(item[1])+sign*(sign<0?range[1]:range[0]);
      var high=range && Number(item[1])+sign*(sign<0?range[0]:range[1]);
      var value=range?(f.ton===0?Number(item[1]).toFixed(2):low.toFixed(2)+'～'+high.toFixed(2)):'预测暂不可用';
      lines.push(item[0]+'  '+value);
    });
    lines.push('',f?'升价为模型估算；'+(f.official?'官方':'机构预测')+'汽油'+(f.ton===0?'不调整':(sign<0?'-':'+')+f.ton+'元/吨'):'预测仅供参考，以正式公告为准');
    if (!province) lines.push('城市来源HTTP｜页面'+result.date);
    else if (result.insecure) lines.push('备用来源HTTP｜页面'+result.date);
    return lines;
  }
  function parseEastMoney(body,name) {
    var obj = JSON.parse(body);
    var list = obj && obj.result && Array.isArray(obj.result.data) ? obj.result.data : null;
    var row = list && list[0];
    if (!row || row.CITYNAME !== name || typeof row.DIM_DATE !== 'string') return null;
    var dm = row.DIM_DATE.match(/^(20\d{2}-\d{2}-\d{2})/);
    if (!dm) return null;
    return {name:name,date:dm[1],p92:price(row.V92),p95:price(row.V95),p98:null,d0:price(row.V0),insecure:false};
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
  function price(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return isFinite(n) && n > 0 && n < 30 ? n.toFixed(2) : null;
  }
  function fail(message) {finishDone({title:'油价查询失败',content:message,icon:'exclamationmark.triangle.fill','icon-color':'#FF3B30'});}
})();
