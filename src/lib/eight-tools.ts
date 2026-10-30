export const VERIFIED='2026-10-29';
export const SOURCES={
  labour:{name:'劳动合同法 · 第17、37、50条',url:'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_0abfdd261c03417b949df19d869add8d.html',scope:'中国内地劳动关系；2013-07-01起施行现行修订文本'},
  tax:{name:'个人所得税法 · 年度综合所得',url:'https://www.chinatax.gov.cn/chinatax/n810219/n810744/n3752930/n3752974/c3970366/content.html',scope:'居民个人；现行综合所得税率自2019年起适用'},
  rates:{name:'税务总局 · 年度申报表与税率表',url:'https://12366.chinatax.gov.cn/bzds/079/079.html',scope:'本工具仅计算全年工资薪金，非正式申报'},
  taxGuide:{name:'税务总局 · 年度汇算管理办法',url:'https://fgk.chinatax.gov.cn/zcfgk/c100015/c5238556/content.html',scope:'居民个人综合所得年度汇算；具体年度办理以公告为准'},
  rentTax:{name:'税务机关 · 住房租金扣除问答',url:'https://shanghai.chinatax.gov.cn/tax/zcfw/rdwd/202603/t479656.html',scope:'2026-03-10发布；扣除资格与所在城市标准须另核实'},
  rent:{name:'民法典 · 第14章租赁合同',url:'https://gdca.miit.gov.cn/zwgk/zcwj/flfg/art/2020/art_573d6ef5018b46b6a4e1f31ca085a710.html',scope:'中国内地租赁合同；2021-01-01起施行'},
  medical:{name:'国家医保局 · 跨省异地就医办理',url:'https://www.nhsa.gov.cn/art/2025/3/16/art_14_16010.html',scope:'2025-03-16发布；待遇和材料以参保地规定为准'},
  transfer:{name:'人社部门 · 养老保险转移网上办理',url:'https://rsj.sh.gov.cn/tzhgl_17555/20260427/t0035_1440273.html',scope:'2026-04-24发布；全国线上渠道说明，非各地完整规则'},
  card:{name:'国务院客户端 · 社保卡使用指南',url:'https://app.www.gov.cn/govdata/gov/202202/09/481703/article.html',scope:'2022-02-09发布；启用与材料向发卡地核实'},
};
export type Source=typeof SOURCES[keyof typeof SOURCES];
export const PORTALS={social:'https://si.12333.gov.cn/',medical:'https://fuwu.nhsa.gov.cn/',tax:'https://etax.chinatax.gov.cn/'};
export function amount(value:string,label:string,optional=false):number|null{
  const clean=value.trim();if(!clean){if(optional)return null;throw new Error(`请填写${label}；确认没有请填 0。`);}
  if(!/^\d+(?:\.\d{1,2})?$/u.test(clean))throw new Error(`${label}请填写非负金额，最多两位小数。`);
  const cents=Math.round(Number(clean)*100);if(!Number.isSafeInteger(cents)||cents>100_000_000_00)throw new Error(`${label}超出当前工具范围。`);return cents;
}
export const cash=(cents:number)=>new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
export type OfferInput={id:string;name:string;monthly:string;months:string;rent:string;commute:string;hours:string;probation:string;employer:string};
export function compareOffers(input:OfferInput[]){
  if(input.length<2||input.length>3)throw new Error('请保留 2–3 份机会进行对比。');
  return input.map((offer,index)=>{
    const name=offer.name.trim()||`机会 ${index+1}`,monthly=amount(offer.monthly,`${name}月薪`)!;
    if(monthly<=0)throw new Error(`${name}月薪需大于 0。`);
    const months=offer.months.trim()===''?null:Number(offer.months);if(months!==null&&(!Number.isInteger(months)||months<12||months>24))throw new Error('明确发薪月数须为 12–24 的整数。');
    const rent=amount(offer.rent,`${name}每月住房预算`,true),commute=amount(offer.commute,`${name}每月通勤预算`,true),probation=amount(offer.probation,`${name}试用月薪`,true);
    const hours=offer.hours.trim()===''?null:Number(offer.hours);if(hours!==null&&(!Number.isFinite(hours)||hours<=0||hours>168))throw new Error('每周工作时长请填 0–168 之间的已知小时数。');
    const annual=months===null?null:monthly*months,budget=annual!==null&&rent!==null&&commute!==null?annual-(rent+commute)*12:null;
    const questions=[months===null?'请明确固定发薪月数，奖金是否另有条件？':null,probation===null?'请明确试用期工资及其组成。':null,!offer.employer||offer.employer==='unknown'?'请明确签约主体、用工单位及是否劳务派遣。':null,rent===null||commute===null?'请补齐住房和通勤预算后再比较生活负担。':null,hours===null?'请明确实际工时、休息和加班安排。':null].filter((v):v is string=>!!v);
    return {id:offer.id,name,monthly,months,annual,baseline:monthly*12,rent,commute,budget,probation,hours,employer:offer.employer,questions};
  });
}
export type TaxInput={income:string;insurance:string;additional:string;other:string;prepaid:string;resident:boolean;salaryOnly:boolean;year:string};
export const TAX_BANDS=[{limit:36000,rate:3,quick:0},{limit:144000,rate:10,quick:2520},{limit:300000,rate:20,quick:16920},{limit:420000,rate:25,quick:31920},{limit:660000,rate:30,quick:52920},{limit:960000,rate:35,quick:85920},{limit:Infinity,rate:45,quick:181920}] as const;
export function estimateAnnualTax(form:TaxInput){
  if(!form.resident||!form.salaryOnly)throw new Error('请先确认居民个人和本次仅含工资薪金的计算范围；其他情形请使用官方申报工具。');
  if(!['2025','2026'].includes(form.year))throw new Error('当前只提供 2025/2026 年规则说明下的工资薪金试算。');
  const income=amount(form.income,'全年工资薪金收入')!,insurance=amount(form.insurance,'全年个人社保公积金')!,additional=amount(form.additional,'全年专项附加扣除')!,other=amount(form.other,'其他依法扣除')!,prepaid=amount(form.prepaid,'已预缴税额')!;
  const taxable=Math.max(0,income-6_000_000-insurance-additional-other),band=TAX_BANDS.find(b=>taxable<=b.limit*100)!;
  const tax=Math.max(0,Math.round(taxable*band.rate/100)-band.quick*100);
  return {income,insurance,additional,other,prepaid,taxable,tax,balance:prepaid-tax,rate:band.rate,quick:band.quick*100,year:form.year};
}
export type RentFinding={id:string;label:string;status:'located'|'missing'|'confirm';quote:string;start:number;question:string;article:string};
const RENT_RULES=[
  {id:'parties',label:'出租人与出租权限',pattern:/出租人|甲方|房东/u,question:'请提供出租人身份及产权或合法转租授权，确认签约人与收款人。',article:'合同主体与出租权限核实'},
  {id:'term',label:'房屋与租期',pattern:/房屋地址|坐落|租赁期限|租期/u,question:'请明确房屋地址、租赁起止日和交付状态。',article:'第704条'},
  {id:'rent',label:'租金与支付',pattern:/租金|月租|付款方式/u,question:'请明确每期租金、支付日、收款账户以及额外收费。',article:'第704条'},
  {id:'deposit',label:'押金退还',pattern:/押金|保证金/u,question:'押金在什么条件和时间退还？哪些扣除需要提供凭据？',article:'押金属于双方具体约定，不能只凭关键词判断'},
  {id:'repair',label:'维修责任',pattern:/维修|修缮/u,question:'请明确设施故障如何报修、谁承担费用及处理时间。',article:'第712、713条'},
  {id:'bills',label:'水电与交接',pattern:/水电|电费|水费|物业|交接清单/u,question:'水电、物业和网络分别由谁承担？入住时能否一起记录表底和物品状态？',article:'费用与交付约定核实'},
  {id:'exit',label:'提前退租与结算',pattern:/提前退租|解除|违约|退房/u,question:'提前退租需怎样通知、费用如何算、房屋和钥匙怎样交接？',article:'解除与结算需结合具体约定'},
];
export function reviewRent(text:string):RentFinding[]{
  if(text.trim().length<10)throw new Error('请先粘贴至少 10 个字的租房材料。');if(text.length>30000)throw new Error('当前每次最多核对 30000 字。');
  const segments=[...text.matchAll(/[^。；\n]+[。；\n]?/gu)];
  return RENT_RULES.map(rule=>{const hit=segments.find(segment=>rule.pattern.test(segment[0])),quote=hit?.[0].slice(0,360)??'';return {id:rule.id,label:rule.label,quote,start:hit?.index??-1,status:!hit?'missing':rule.id==='parties'||rule.id==='deposit'?'confirm':'located',question:rule.question,article:rule.article};});
}
export function rentBudget(monthly:string,period:string,deposit:string,fee:string){
  const rent=amount(monthly,'月租',true),security=amount(deposit,'押金',true),agent=amount(fee,'中介及其他首次费用',true),months=period===''?null:Number(period);
  if(months!==null&&(!Number.isInteger(months)||months<1||months>12))throw new Error('首次付租月数请填 1–12 的整数。');
  return rent===null||security===null||agent===null||months===null?null:rent*months+security+agent;
}
export type RouteStep={id:string;title:string;detail:string;source:Source;url?:string};
export type SocialInput={scenario:'first'|'medical'|'transfer'|'card';city:string;target:string;insured:'employee'|'resident'|'unknown'};
export function socialRoute(input:SocialInput):RouteStep[]{
  const city=input.city.trim()||'待确认参保地',target=input.target.trim()||'待确认办理地';
  const common:RouteStep={id:'verify',title:'先核实当前记录',detail:`参保地：${city}；办理或就医地：${target}。${input.insured==='unknown'?'险种尚不明确，先查询职工/居民参保记录，再选择对应业务。':'已按你自述的险种整理，仍需与官方记录一致。'}`,source:SOURCES.transfer,url:PORTALS.social};
  if(input.scenario==='medical')return [common,{id:'filing',title:'核实跨省异地就医备案',detail:'确认适用的备案类型、有效期与所需材料；省内异地按参保地另行核实。备案不等于已经取得全部待遇资格。',source:SOURCES.medical,url:PORTALS.medical},{id:'hospital',title:'查询定点与待遇',detail:'就医前核对联网定点机构及门诊/住院适用范围；支付政策以参保地规定为准，本页不推算报销金额。',source:SOURCES.medical,url:PORTALS.medical},{id:'record',title:'保留办理和结算记录',detail:'在官方平台查询备案进度和费用明细；不在本网站上传身份或医疗材料。',source:SOURCES.medical,url:PORTALS.medical}];
  if(input.scenario==='transfer')return [common,{id:'join',title:'向新参保地核实接续事项',detail:'先确认新旧险种和转入地受理要求；养老与医保分别核实，不能将一个险种的转移替代全部保障。',source:SOURCES.transfer,url:PORTALS.social},{id:'apply',title:'通过官方渠道申请',detail:'企业职工养老保险可在国家社会保险公共服务平台寻找关系转移申请；其他情形向经办机构确认。',source:SOURCES.transfer,url:PORTALS.social},{id:'track',title:'查询申请与转移进度',detail:'保存受理记录，再核对转入结果；完成勾选仅是个人台账，不代表机构已办结。',source:SOURCES.transfer,url:PORTALS.social}];
  if(input.scenario==='card')return [common,{id:'card',title:'核实卡片与申领渠道',detail:'查询实体卡、电子社保卡状态及发卡地服务，不重复提交不明渠道的申请。',source:SOURCES.card,url:PORTALS.social},{id:'activate',title:'区分社保功能与金融功能',detail:'两种功能的启用渠道和用途不同，向发卡地及合作银行核实；不要将卡已启用等同于已经参保。',source:SOURCES.card},{id:'secure',title:'记录启用与挂失渠道',detail:'保存官方服务入口及办理记录，不在本工具记录卡号、密码或证件号码。',source:SOURCES.card,url:PORTALS.social}];
  return [common,{id:'enrol',title:'向单位确认参保登记',detail:'核实参保主体、参保地、险种、登记月份与工资条个人扣款，不把工资条扣款当作到账证明。',source:SOURCES.labour},{id:'check',title:'自己查询缴费记录',detail:'在官方平台逐项对照参保、缴费月份和记录；记录缺失时先向单位及经办机构核实。地方费率由当地核定，本工具不自动补造。',source:SOURCES.transfer,url:PORTALS.social},{id:'use',title:'确认医保及卡片可用状态',detail:'待遇等待期、启用方式及就医范围向参保地医保经办机构核实；参保与卡片启用是不同事项。',source:SOURCES.card,url:PORTALS.medical}];
}
export type LeavingInput={lastDay:string;mode:'voluntary'|'agreement'|'other'|'unknown';probation:'yes'|'no'|'unknown';move:'same'|'cross'|'unknown';relation:'labour'|'unknown';note:string};
export function leavingRoute(form:LeavingInput):RouteStep[]{
  const notice=form.relation==='unknown'?'先确认是否属于劳动关系，再核实解除方式，不直接套用通知期限。':form.mode==='unknown'?'先确认是主动通知、协商还是其他解除情形，不自动套用通知期限。':form.mode==='agreement'?'协商解除应核实双方实际确认的日期、交接与结算约定，不自动套用主动通知期限。':form.mode==='other'?'单位提出解除、争议等情况需结合具体事实核实通知及补偿等事项，本页不套用主动离职提示。':form.probation==='unknown'?'先核实是否仍在试用期及拟采用的解除方式。':'对劳动者主动通知解除的一般情形，'+(form.probation==='yes'?'试用期内有提前三日通知的规定。':'有提前三十日书面通知的规定。')+'法定特殊情形等需另核实，不自动生成具有法律效力的离职日。';
  const steps:RouteStep[]=[{id:'notice',title:'确认方式与日期',detail:notice+(form.lastDay?` 你记录的最后工作日为 ${form.lastDay}，尚需与实际流程核对。`:''),source:SOURCES.labour},{id:'handover',title:'留好工作交接记录',detail:'列明交接对象、事项、文件去向、设备和双方确认记录；个人台账不等于对方已签收。',source:SOURCES.labour},{id:'proof',title:'核实证明与最终结算',detail:'向单位确认解除/终止证明、工资及各项结算明细，保留原始沟通和付款记录。',source:SOURCES.labour}];
  steps.push({id:'insurance',title:form.move==='cross'?'分别确认保障转接':'核实保障记录与下一段衔接',detail:form.move==='unknown'?'去向未定，先查停缴/续缴月份和各险种办理要求，不擅自替你选转移地。':'根据新旧参保地与险种分别确认养老、医保和公积金业务，不把离职等同于已经完成全部转移。',source:SOURCES.transfer,url:PORTALS.social});
  steps.push({id:'archive',title:'核对档案去向与办理回执',detail:'确认档案接收单位与实际转接手续，保存证明和回执；具体机构及材料以当地受理要求为准。',source:SOURCES.labour});return steps;
}
