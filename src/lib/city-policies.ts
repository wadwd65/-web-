export type PolicyTopic='support'|'stay';
export type CityPolicySource={id:string;city:string;title:string;scope:string;url:string;text:string;publishedOn:string|null;checkedOn:string;mode:'reviewed'|'live';authority:string;applicationUrl?:string};
export type CityPolicyResult={city:string;topic:PolicyTopic;status:'matched'|'not-found'|'unavailable'|'not-covered';sources:CityPolicySource[];message:string;retrievedAt:string;cached?:boolean};
export const POLICY_DIRECTORY='https://jsdxzj.ncss.cn/qnyz/';
export const POLICY_CITIES=['广州','深圳','杭州','上海'] as const;
export const POLICY_TOPIC_NAMES:Record<PolicyTopic,string>={support:'毕业补贴',stay:'求职住宿'};
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
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname.endsWith('.gov.cn')||['www.chsi.com.cn','www.ncss.cn','jsdxzj.ncss.cn'].includes(u.hostname));}catch{return false;}
}
export const REVIEWED_CITY_POLICIES:readonly CityPolicySource[]=[
 {id:'gz-job-support',city:'广州',title:'广州市求职创业补贴',scope:'学校所在地为广州；不是到广州工作就能申请',url:'https://rsj.gz.gov.cn/zmhd/cjwt/ldbz/content/post_10677608.html',text:'广州市内普通高等学校、中等职业学校、技工院校毕业学年的学生；具有官方列示的困难家庭、特困、残疾或曾获得国家助学贷款等情形之一。每人3000元，一次性补贴，已申领过不可重复申领。申领方式为广东公共就业服务云平台。该页未给出当前申报窗口，需与学校核实。',publishedOn:'2026-02-11',checkedOn:'2026-11-06',mode:'reviewed',authority:'广州市人力资源和社会保障局',applicationUrl:'https://ggfw.hrss.gd.gov.cn/employment/internet/portal/#/home'},
 {id:'sz-job-support',city:'深圳',title:'深圳高校毕业生一次性求职补贴',scope:'深圳院校毕业学年学生；工作地不能替代学校所在地',url:'https://hrss.sz.gov.cn/gkmlpt/content/12/12886/post_12886866.html',text:'对象为深圳市普通高等学校、中等职业学校、技工院校毕业学年学生。研究生的毕业学年指毕业前一年7月1日至毕业当年12月31日；其他学历指毕业前一年7月1日起的12个月。符合条件者原则上在毕业学年内、在校期间申请。此FAQ只说明对象与时间，不能据此认定所有毕业生都符合。',publishedOn:'2026-07-10',checkedOn:'2026-11-06',mode:'reviewed',authority:'深圳市人力资源和社会保障局',applicationUrl:'https://hrss.sz.gov.cn/ztfw/gaojyzt/rsrc/'},
 {id:'hz-youth-stay',city:'杭州',title:'杭州青年驿站：目录中的西湖区条目',scope:'正文为西湖区申请条件，不能泛化到杭州所有区',url:'https://www.chsi.com.cn/ncss/qnyz/202504/20250420/2293375781.html',text:'官方目录条目介绍为来西湖区就业创业等符合条件对象提供累计不超过7天（6晚）免费住宿；首次原则上不超过3天（2晚），后续分次申请。对象包括非杭州户籍且无房、毕业未满两年的大专及以上毕业生，或非西湖区院校的毕业学年在校生。需提供求职面试等证明，具体以当期驿站审核为准。',publishedOn:'2025-04-20',checkedOn:'2026-11-06',mode:'reviewed',authority:'国家大学生就业服务平台 · 青年驿站目录',applicationUrl:POLICY_DIRECTORY},
 {id:'sh-youth-stay',city:'上海',title:'上海青年驿站申请要求',scope:'目录要求非上海户籍、在沪无房等；各驿站仍需核实',url:'https://www.chsi.com.cn/ncss/qnyz/202504/20250419/2293375714.html',text:'目录介绍面向来沪求职的全日制普通高校应届毕业生，毕业前一年至毕业后两年。需按驿站要求提供本市面试、录用或实习等求职证明；申请人非上海户籍，且在上海无购房、租房及其他形式在住房屋。每人单次不超过3天，全年累计不超过15天，国家法定节假日不可选房。床位与当期要求需核实。',publishedOn:'2025-04-19',checkedOn:'2026-11-06',mode:'reviewed',authority:'国家大学生就业服务平台 · 青年驿站目录',applicationUrl:POLICY_DIRECTORY},
];
export function reviewedCityPolicies(city:string,topic:PolicyTopic){return REVIEWED_CITY_POLICIES.filter(x=>x.city===city&&(topic==='stay'?x.id.includes('stay'):x.id.includes('support')));}
export function isCityPolicyResult(value:unknown):value is CityPolicyResult {
  if(!value||typeof value!=='object')return false;const r=value as CityPolicyResult;
  try{if(policyCity(r.city)!==r.city)return false;}catch{return false;}
  if(!['support','stay'].includes(r.topic)||!['matched','not-found','unavailable','not-covered'].includes(r.status)||typeof r.message!=='string'||r.message.length>600||!Number.isFinite(Date.parse(r.retrievedAt))||!Array.isArray(r.sources)||r.sources.length>3||(r.status==='matched')!==(r.sources.length>0))return false;
  return r.sources.every(s=>s&&s.city===r.city&&typeof s.id==='string'&&s.id.length<=80&&typeof s.title==='string'&&s.title.length<=200&&typeof s.scope==='string'&&s.scope.length<=300&&officialPolicyUrl(s.url)&&typeof s.text==='string'&&s.text.length>0&&s.text.length<=3000&&/^\d{4}-\d{2}-\d{2}$/u.test(s.checkedOn)&&(s.publishedOn===null||/^\d{4}-\d{2}-\d{2}$/u.test(s.publishedOn))&&['reviewed','live'].includes(s.mode)&&typeof s.authority==='string'&&s.authority.length<=120&&(s.applicationUrl===undefined||officialPolicyUrl(s.applicationUrl)));
}
export function policySourcesForCopy(r:CityPolicyResult){return [`${r.city} · ${POLICY_TOPIC_NAMES[r.topic]}`,r.message,...r.sources.flatMap(s=>[s.title,s.scope,s.text,`来源：${s.authority}`,`公开日期：${s.publishedOn??'页面未注明'}；获取/核验：${s.checkedOn}`,s.url,s.applicationUrl?`办理核实入口：${s.applicationUrl}`:'']),'资料不等于资格获批；申报窗口、床位及完整条件需向官方核实。'].filter(Boolean).join('\n\n');}
