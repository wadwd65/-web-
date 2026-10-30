export const EXPERIENCE_MODULES = [
  {id:'offer',code:'01',label:'Offer 对比',english:'CHOICE',phase:'签约之前',headline:['第一份选择，','看清再出发。'],description:'把几份机会的薪资结构、试用约定与生活预算放到一起，找到需要继续问清楚的差异。',outputs:['同口径对比','未知条件','询问清单'],input:'2–3 份机会的已知条件',ready:true},
  {id:'contract',code:'02',label:'合同核对',english:'AGREEMENT',phase:'签约之前',headline:['把约定，','留在明处。'],description:'从劳动合同原文出发，核对关键约定，把需要向 HR 确认的问题带走。',outputs:['原文定位','依据入口','询问清单'],input:'合同文字 / TXT / MD',ready:true},
  {id:'salary',code:'03',label:'工资明细',english:'EARNINGS',phase:'开始工作',headline:['每一笔钱，','都清清楚楚。'],description:'把应发、个人扣款与实际到账逐项对齐，看清一份工资是怎样组成的。',outputs:['扣款拆分','计算过程','到账核对'],input:'工资条上的已知金额',ready:true},
  {id:'tax',code:'04',label:'个税指引',english:'TAXATION',phase:'开始工作',headline:['申报之前，','先理解规则。'],description:'确认适用范围，用全年工资薪金与已知扣除展开税额公式，再核实官方申报记录。',outputs:['公式试算','扣除核实','官方入口'],input:'全年工资、扣除与预缴税额',ready:true},
  {id:'social',code:'05',label:'社保医保',english:'SECURITY',phase:'日常生活',headline:['看懂保障，','安心走得更远。'],description:'从参保、异地就医、关系转移和卡片中选一件事，建立可记录的办理路线。',outputs:['办理路线','个人进度','官方入口'],input:'办理情形 / 地区 / 参保险种',ready:true},
  {id:'rent',code:'06',label:'租房核对',english:'SETTLEMENT',phase:'日常生活',headline:['落脚之前，','问清每项约定。'],description:'围绕租金、押金、维修与退租，定位原文、核对首次费用，把需要问的约定带走。',outputs:['原文定位','首次费用','询问清单'],input:'租房文字 / 手工确认的费用',ready:true},
  {id:'subsidy',code:'07',label:'补贴匹配',english:'SUPPORT',phase:'日常生活',headline:['让支持，','有迹可循。'],description:'对照自己的实际条件，再带着需要确认的资料，找到官方办理入口。',outputs:['条件对照','缺失信息','官方入口'],input:'地区 / 毕业及申领情况',ready:true},
  {id:'leaving',code:'08',label:'离职转接',english:'TRANSITION',phase:'走向下一站',headline:['告别一站，','接好下一程。'],description:'把日期、交接、证明与保障衔接变成可勾选和备注的个人台账。',outputs:['交接台账','个人备注','转接导航'],input:'关系 / 试用期 / 日期与去向',ready:true},
] as const;
export type ExperienceModule=(typeof EXPERIENCE_MODULES)[number];
export type WorkspacePage=ExperienceModule['id']|'home'|'list';
export type ExperiencePage=WorkspacePage|'music';
export function parseExperiencePage(hash:string):ExperiencePage{const route=hash.replace(/^#\/?/,'');return route==='music'||route==='home'||route==='list'||EXPERIENCE_MODULES.some(item=>item.id===route)?route as ExperiencePage:'home';}
