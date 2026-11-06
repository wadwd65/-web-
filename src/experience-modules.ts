export const EXPERIENCE_MODULES = [
  {id:'offer',code:'01',label:'Offer 对比',english:'CHOICE',phase:'签约之前',headline:['第一份选择，','看清再出发。'],description:'把两三份 Offer 的工资、试用期和开销列在一起，看看差别在哪。',outputs:['同口径对比','未知条件','询问清单'],input:'2–3 份机会的已知条件',ready:true},
  {id:'contract',code:'02',label:'合同核对',english:'AGREEMENT',phase:'签约之前',headline:['把约定，','留在明处。'],description:'签字前先看合同：试用期多久、在哪上班，哪些地方还要问清楚。',outputs:['原文定位','依据入口','询问清单'],input:'合同文字 / TXT / MD',ready:true},
  {id:'salary',code:'03',label:'工资明细',english:'EARNINGS',phase:'开始工作',headline:['每一笔钱，','都清清楚楚。'],description:'填上工资条里的金额，核对每项扣款和实际到账。',outputs:['扣款拆分','计算过程','到账核对'],input:'工资条上的已知金额',ready:true},
  {id:'tax',code:'04',label:'个税指引',english:'TAXATION',phase:'开始工作',headline:['申报之前，','先理解规则。'],description:'按全年工资和已确认的扣除额试算，再去官方平台核实。',outputs:['公式试算','扣除核实','官方入口'],input:'全年工资、扣除与预缴税额',ready:true},
  {id:'social',code:'05',label:'社保医保',english:'SECURITY',phase:'日常生活',headline:['看懂保障，','安心走得更远。'],description:'选你要办的事，看看去哪办、需要准备什么。',outputs:['办理路线','个人进度','官方入口'],input:'办理情形 / 地区 / 参保险种',ready:true},
  {id:'rent',code:'06',label:'租房核对',english:'SETTLEMENT',phase:'日常生活',headline:['落脚之前，','问清每项约定。'],description:'看看押金、维修和退租怎么约定，再算第一次要交多少钱。',outputs:['原文定位','首次费用','询问清单'],input:'租房文字 / 手工确认的费用',ready:true},
  {id:'subsidy',code:'07',label:'城市政策',english:'SUPPORT',phase:'日常生活',headline:['让支持，','有迹可循。'],description:'按城市查官方补贴与求职住宿资料，再核实范围、条件和办理入口。',outputs:['城市资料','适用范围','官方入口'],input:'城市 / 补贴或求职住宿',ready:true},
  {id:'leaving',code:'08',label:'离职转接',english:'TRANSITION',phase:'走向下一站',headline:['告别一站，','接好下一程。'],description:'记下交接、工资结算和社保转接，办完一项记一项。',outputs:['交接台账','个人备注','转接导航'],input:'关系 / 试用期 / 日期与去向',ready:true},
] as const;
export type ExperienceModule=(typeof EXPERIENCE_MODULES)[number];
export type WorkspacePage=ExperienceModule['id']|'home'|'list'|'tools';
export type ExperiencePage=WorkspacePage|'music';
export function parseExperiencePage(hash:string):ExperiencePage{const route=hash.replace(/^#\/?/,'');return route==='music'||route==='home'||route==='list'||route==='tools'||EXPERIENCE_MODULES.some(item=>item.id===route)?route as ExperiencePage:'home';}
