export type PolicyTopic='overview'|'support'|'stay';
export type CityPolicySource={id:string;city:string;title:string;scope:string;url:string;text:string;publishedOn:string|null;checkedOn:string;mode:'reviewed'|'live';authority:string;applicationUrl?:string;category?:'graduate'|'settlement'|'stay';note?:string};
export type CityPolicyResult={city:string;topic:PolicyTopic;status:'matched'|'not-found'|'unavailable'|'not-covered';sources:CityPolicySource[];message:string;retrievedAt:string;cached?:boolean};
export const POLICY_DIRECTORY='https://jsdxzj.ncss.cn/qnyz/';
export const POLICY_CITIES=['广州','深圳','杭州','上海'] as const;
export const POLICY_TOPIC_NAMES:Record<PolicyTopic,string>={overview:'三类总览',support:'毕业 / 安居补贴',stay:'求职住宿'};
export function policyCity(value:unknown):string{
  if(typeof value!=='string')throw Error('请填写城市名称。');
  const city=value.trim().replace(/市$/u,'');
  if(!/^[\u4e00-\u9fff]{2,12}$/u.test(city))throw Error('请只填写城市名称，例如成都，不填写地址或个人信息。');
  return city;
}
/** Only explicit user cities can select a source; newer named cities override earlier ones. */
export function assertPolicyCityEvidence(city:string,userMessages:string[]){
 const names=[...new Set([city,...POLICY_CITIES,'北京','天津','重庆','成都','宁波','武汉','南京','苏州','无锡','合肥','郑州','长沙','西安','济南','青岛','福州','厦门','南昌','昆明','贵阳','南宁','海口','太原','沈阳','大连','长春','哈尔滨','石家庄','兰州','西宁','银川','呼和浩特','乌鲁木齐','拉萨','洛阳','开封','温州','绍兴','嘉兴','珠海','佛山','东莞'])];
 for(const message of [...userMessages].reverse()){
  const raw=names.filter(name=>message.includes(name));
  const mentioned=raw.filter(name=>{
   const at=message.lastIndexOf(name),before=message.slice(0,at).split(/[，,。；;！？!?\n]/u).at(-1)||'',after=message.slice(at+name.length).split(/[，,。；;！？!?\n]/u)[0];
   // Cancel only an explicit city/query mention, not an unrelated old result in the same sentence.
   const negated=/(?:不是|不在|不去|不查|不考虑|别用|不要|撤回|取消)[^，,。\n]{0,3}$/u.test(before)
    ||/^(?:市)?(?:(?:那|这)条|的(?:查询|住宿入口|住宿查询|补贴查询))?(?:先|暂时)?(?:撤回|取消|作废|不对|不去了|不查了|不考虑了|不要了)/u.test(after);
   const uncertain=/(?:可能|也许|是不是|是否|不确定|没确定|没决定|待确认)[^，,。\n]{0,4}$/u.test(before)
    ||/^(?:市)?(?:还|尚|暂时)?(?:不确定|没确定|未确定|待确认|没决定|没定|不知道)/u.test(after);
   return !negated&&!uncertain;
  });
  if(mentioned.length){if(mentioned.length!==1||mentioned[0]!==city)throw Error('请按最新明确的一个城市查询；不要复用旧城市。');return;}
  if(raw.length||/换个城市|城市(?:不对|(?:说|写|填)?错了?|改了|换了|(?:需要)?更正|(?:先)?撤回)|(?:更正|纠正)(?:一下)?城市|还没决定|城市(?:还|尚|暂时)?(?:不知道|不确定|没确定|未确定|没决定|没定)|改去|改查|换到|换成|我(?:现在)?(?:想去|要去)/u.test(message))break;
 }
 throw Error('请先确认要查的城市。');
}
export function officialPolicyUrl(value:unknown):value is string {
  if(typeof value!=='string')return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname.endsWith('.gov.cn')||['www.chsi.com.cn','www.ncss.cn','jsdxzj.ncss.cn','career.hznu.edu.cn'].includes(u.hostname));}catch{return false;}
}
export const REVIEWED_CITY_POLICIES:readonly CityPolicySource[]=[
 {id:'gz-job-support',category:'graduate',city:'广州',title:'广州市求职创业补贴',scope:'学校所在地为广州；不是到广州工作就能申请',url:'https://rsj.gz.gov.cn/zmhd/cjwt/ldbz/content/post_10677608.html',text:'广州市内普通高等学校、中等职业学校、技工院校毕业学年的学生；具有官方列示的困难家庭、特困、残疾或曾获得国家助学贷款等情形之一。每人3000元，一次性补贴，已申领过不可重复申领。申领方式为广东公共就业服务云平台。该页未给出当前申报窗口，需与学校核实。',publishedOn:'2026-02-11',checkedOn:'2026-11-06',mode:'reviewed',authority:'广州市人力资源和社会保障局',applicationUrl:'https://ggfw.hrss.gd.gov.cn/employment/internet/portal/#/home'},
 {id:'sz-job-support',category:'graduate',city:'深圳',title:'深圳高校毕业生一次性求职补贴',scope:'深圳院校毕业学年学生；工作地不能替代学校所在地',url:'https://hrss.sz.gov.cn/gkmlpt/content/12/12886/post_12886866.html',text:'对象为深圳市普通高等学校、中等职业学校、技工院校毕业学年学生。研究生的毕业学年指毕业前一年7月1日至毕业当年12月31日；其他学历指毕业前一年7月1日起的12个月。符合条件者原则上在毕业学年内、在校期间申请。此FAQ只说明对象与时间，不能据此认定所有毕业生都符合。',publishedOn:'2026-07-10',checkedOn:'2026-11-06',mode:'reviewed',authority:'深圳市人力资源和社会保障局',applicationUrl:'https://hrss.sz.gov.cn/ztfw/gaojyzt/rsrc/'},
 {id:'hz-youth-stay',category:'stay',city:'杭州',title:'杭州青年驿站：目录中的西湖区条目',scope:'正文为西湖区申请条件，不能泛化到杭州所有区',url:'https://www.chsi.com.cn/ncss/qnyz/202504/20250420/2293375781.html',text:'官方目录条目介绍为来西湖区就业创业等符合条件对象提供累计不超过7天（6晚）免费住宿；首次原则上不超过3天（2晚），后续分次申请。对象包括非杭州户籍且无房、毕业未满两年的大专及以上毕业生，或非西湖区院校的毕业学年在校生。需提供求职面试等证明，具体以当期驿站审核为准。',publishedOn:'2025-04-20',checkedOn:'2026-11-06',mode:'reviewed',authority:'国家大学生就业服务平台 · 青年驿站目录',applicationUrl:POLICY_DIRECTORY},
 {id:'sh-youth-stay',city:'上海',category:'stay',title:'上海青年驿站 · 2026年入住说明',scope:'非沪籍、毕业前一年至毕业后两年；以具体站点审核和当期规则为准',url:'https://www.shanghai.gov.cn/nw17239/20260714/e77bee37fcbe4dcd941f58f6db84d771.html',text:'官方2026年说明：符合条件的大学生可申请免费住宿，单次及全年累计均不超过15天，需提供在沪面试或录用等材料。通过“青春上海”“上海12355”或“海聚英才通”的青年驿站板块申请。此条更新了2025目录单次3天的旧说明；不代表当前有床位。',publishedOn:'2026-07-12',checkedOn:'2026-11-14',mode:'reviewed',authority:'上海市人民政府门户 · 黄浦区人民政府',applicationUrl:'https://www.shanghai.gov.cn/nw17239/20260714/e77bee37fcbe4dcd941f58f6db84d771.html'},
 {id:'gz-housing-support',city:'广州',category:'settlement',title:'人才住房租金补贴 · 黄埔区限定',scope:'限广州开发区（黄埔区）人才住房相关申请人，不是全广州毕业生普惠现金补贴',url:'https://www.hp.gov.cn/qmtjjczwgk/26sdly/bzxzfly/content/post_10963609.html',text:'2026年第二批人才住房租金补贴准备通知，要求相关申请人和单位于8月18日前在黄埔安居服务平台确认入住信息、完善材料。该批准备期限已过；不能据此宣称现在正在受理。是否纳入人才住房、单位及个人条件、下批窗口应另向主管部门核实。',publishedOn:'2026-08-13',checkedOn:'2026-11-14',mode:'reviewed',authority:'广州开发区建设和交通局 / 黄埔区住房和城乡建设局',note:'区级项目 · 已公开批次期限已过'},
 {id:'gz-youth-stay',city:'广州',category:'stay',title:'靠埔青年驿站 · 求职与入职过渡住宿',scope:'黄埔区站点，不等于广州全市所有驿站；学历、户籍和求职证明等需核实',url:'https://www.hp.gov.cn/2021gb/zz/zwyw/content/post_10362963.html',text:'官方介绍“双15天”：求职阶段单次1至3天（2晚），累计不超过15天；成功入职阶段单次1至15天（14晚），累计不超过15天。提前3个工作日申请。可经“青春黄埔”公众号或“黄埔青年驿站”小程序按要求提交面试或入职证明，最终以站点审核和房源为准。',publishedOn:'2025-07-21',checkedOn:'2026-11-14',mode:'reviewed',authority:'黄埔区人民政府门户 · 黄埔融媒',note:'区级驿站 · 是否开放及床位需当期核实'},
 {id:'sz-talent-support',city:'深圳',category:'settlement',title:'新引进优秀青年入户补贴 · 福田区指南',scope:'限福田符合条件的单位和新引进优秀青年；有院校、年龄、引进时间等限制',url:'https://www.szft.gov.cn/bmxx_qt/qwzzb/ych/rcyj/qnrc/content/post_12149484.html',text:'2026年指南面向符合规定的境内外知名高校硕士和本科毕业生，由用人单位申报，最高分别5万元、3万元。不是所有学历或入户者自动享有，需核对35周岁以下、2025年5月1日起引进及应届/留学等完整要求。不能用2021年旧补贴停办消息概括现行项目。',publishedOn:'2026-01-23',checkedOn:'2026-11-14',mode:'reviewed',authority:'深圳市福田区人才工作局',note:'区级条件项目 · 不作个人资格判断'},
 {id:'sz-youth-stay',city:'深圳',category:'stay',title:'福田青年驿站 · 短期居住支持',scope:'福田石厦站申请指南，需满足应届毕业生及无入住记录等要求',url:'https://www.szft.gov.cn/bmxx_qt/qwzzb/ych/rcfw/qnaj/content/post_12181476.html',text:'面向符合条件的来福田发展应届毕业生，需无青年驿站入住记录并遵守管理规定，可申请最长15天免费住宿，按官方流程线上申报、审核后入住。此份指南有效期至2026年12月31日；实际入住天数和房源以站点当期确认结果为准，不将其他人才项目条件套用到此。',publishedOn:'2026-03-30',checkedOn:'2026-11-14',mode:'reviewed',authority:'福田区人民政府门户 · 福田英才荟',note:'站点条件与当期床位需核实'},
 {id:'hz-job-support',city:'杭州',category:'graduate',title:'毕业学年一次性求职补贴 · 2026年校方通知',scope:'杭州市内院校的符合条件毕业生；杭州师大公开通知，其他学校以本校通知为准',url:'https://career.hznu.edu.cn/news/view/aid/230608/tag/tzgg',text:'校方2026年8月14日通知：毕业学年内的杭州院校非定向培养毕业生，需符合低保家庭、孤儿、残疾、助学贷款等七类情形之一。每人3000元，已享受不能重复申请。2026年申请期为8月15日至9月15日，现已结束；2027届后续安排应向学校核实，不能把工作地当学校所在地。',publishedOn:'2026-08-14',checkedOn:'2026-11-14',mode:'reviewed',authority:'杭州师范大学就业创业服务平台（校方公开通知）',note:'2026申请期已结束 · 不表示所有毕业生可领'},
 {id:'hz-housing-support',city:'杭州',category:'settlement',title:'新引进应届大学生租房补贴 · 官方问答',scope:'本科及以上应届毕业生，需核实就业、参保、无房及未享受住房优惠等完整条件',url:'https://ql.hangzhou.gov.cn/col/col1229597836/art/2026/art_8d62018211ba4915b09c78c7d2a7ca13.html',text:'2026年官方问答介绍：符合条件家庭每户每年1万元，可发放3年，每年分两笔。首笔需毕业后2年内申请，并满足毕业后1年半内连续参保6个月、连续参保首月在毕业后1年内等要求；家庭在杭无房、未享受相关租房优惠。入口为杭州市民卡人才码或亲清在线，不能仅凭本科或工作地认定资格。',publishedOn:'2026-03-25',checkedOn:'2026-11-14',mode:'reviewed',authority:'杭州市侨联 · 住房保障政策问答',note:'按家庭、参保与申请时限核实'},
 {id:'sh-job-support',city:'上海',category:'graduate',title:'2026届困难毕业生一次性求职补贴',scope:'上海市2026届就业工作通知中的困难毕业生支持，非全体毕业生普惠补贴',url:'https://www.shanghai.gov.cn/gwk/search/content/519721f4f0a5447fa39a305111871a4a',text:'2026届就业创业工作通知明确，毕业年度内有就业创业意愿、符合条件的困难毕业生可申请一次性求职补贴，每人1000元。应向学校核对困难情形、材料与申领窗口。该金额不是广州或深圳的标准，也不能仅凭来沪求职认定资格。',publishedOn:'2026-02-12',checkedOn:'2026-11-14',mode:'reviewed',authority:'上海市人民政府门户 · 沪教委学〔2026〕3号',note:'毕业年度与困难情形需核实'},
 {id:'sh-housing-support',city:'上海',category:'settlement',title:'新就业青年安居支持 · 松江区示例',scope:'在松江就业，年龄、住房、2026起新就业参保及院校等条件均需核实；不是全市统一现金',url:'https://www.shanghai.gov.cn/nw17239/20260806/2abd5a718ac645d1961f00757e4d4cfc.html',text:'2026年松江区说明采用保租房实物配租补贴，按房源区域、备案租金及上限计算，第二年额度退坡，不是直接按一笔现金普发。高水平大学本科及以上且毕业不满3年等需同时满足其他条件；松江大学城/高职应届毕业生另有区内通道。通过随申办或区内窗口核实，不能推广为所有上海毕业生均可领取。',publishedOn:'2026-08-06',checkedOn:'2026-11-14',mode:'reviewed',authority:'上海市人民政府门户 · 松江区人民政府',note:'区级安居项目 · 受房源与完整资格限制'},
];
export const POLICY_CATEGORY_NAMES={graduate:'毕业学年 · 求职补贴',settlement:'入职之后 · 生活与安居',stay:'异地求职 · 过渡住宿'} as const;
export function reviewedCityPolicies(city:string,topic:PolicyTopic){return REVIEWED_CITY_POLICIES.filter(x=>x.city===city&&(topic==='overview'||(topic==='stay'?x.category==='stay':x.category!=='stay'))).sort((a,b)=>['graduate','settlement','stay'].indexOf(a.category??'stay')-['graduate','settlement','stay'].indexOf(b.category??'stay'));}
export function isCityPolicyResult(value:unknown):value is CityPolicyResult {
  if(!value||typeof value!=='object')return false;const r=value as CityPolicyResult;
  try{if(policyCity(r.city)!==r.city)return false;}catch{return false;}
  if(!['overview','support','stay'].includes(r.topic)||!['matched','not-found','unavailable','not-covered'].includes(r.status)||typeof r.message!=='string'||r.message.length>600||!Number.isFinite(Date.parse(r.retrievedAt))||!Array.isArray(r.sources)||r.sources.length>3||(r.status==='matched')!==(r.sources.length>0))return false;
  return r.sources.every(s=>s&&s.city===r.city&&typeof s.id==='string'&&s.id.length<=80&&typeof s.title==='string'&&s.title.length<=200&&typeof s.scope==='string'&&s.scope.length<=300&&officialPolicyUrl(s.url)&&typeof s.text==='string'&&s.text.length>0&&s.text.length<=3000&&/^\d{4}-\d{2}-\d{2}$/u.test(s.checkedOn)&&(s.publishedOn===null||/^\d{4}-\d{2}-\d{2}$/u.test(s.publishedOn))&&['reviewed','live'].includes(s.mode)&&typeof s.authority==='string'&&s.authority.length<=120&&(s.applicationUrl===undefined||officialPolicyUrl(s.applicationUrl))&&(s.category===undefined||['graduate','settlement','stay'].includes(s.category))&&(s.note===undefined||typeof s.note==='string'&&s.note.length<=300));
}
export function policySourcesForCopy(r:CityPolicyResult){return [`${r.city} · ${POLICY_TOPIC_NAMES[r.topic]}`,r.message,...r.sources.flatMap(s=>[s.category?POLICY_CATEGORY_NAMES[s.category]:'',s.title,s.scope,s.note??'',s.text,`来源：${s.authority}`,`公开日期：${s.publishedOn??'页面未注明'}；获取/核验：${s.checkedOn}`,s.url,s.applicationUrl?`办理核实入口：${s.applicationUrl}`:'']),'资料不等于资格获批；申报窗口、床位及完整条件需向官方核实。'].filter(Boolean).join('\n\n');}
