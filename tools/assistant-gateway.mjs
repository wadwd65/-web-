import {UsageError} from './usage-service.mjs';
import {cityPolicyService} from './city-policy-service.mjs';
import {policyCity,assertPolicyCityEvidence,isCityPolicyResult} from '../src/lib/city-policies.ts';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {createRequestPolicy} from './request-policy.mjs';
import {validateAssistantGuide} from '../src/services/assistant-guide.ts';
import {calculatePayslip} from '../src/lib/wages.ts';
import {SALARY_LABELS,SALARY_REQUIRED,SALARY_FIELD_NAMES,salaryFact,salaryFacts,salaryValueGrounded,asksSalaryFirstStep} from '../src/lib/salary-evidence.ts';
import {analyzeContract,CONTRACT_REFERENCE} from '../src/lib/contracts.ts';
import {searchContractKnowledge,contractQueryFromMessages,CONTRACT_KNOWLEDGE} from '../src/lib/contract-knowledge.ts';

const ENDPOINT='https://api.deepseek.com/chat/completions';
const MODULES={offer:'Offer对比',contract:'合同核对',salary:'工资明细',tax:'个税指引',social:'社保医保',rent:'租房核对',subsidy:'补贴匹配',leaving:'离职转接',list:'询问清单'};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export class AssistantError extends Error {
  constructor(code,message,status=400){super(message);this.name='AssistantError';this.code=code;this.status=status;}
}
export function readAssistantConfig(directory){
  let values={};
  const local=resolve(directory,'.env.local'),shared=resolve(homedir(),'.config/first-step/.env.local');
  try {values=parseEnv(readFileSync(process.env.FIRST_STEP_AI_ENV_FILE||(existsSync(local)?local:shared),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw new AssistantError('configuration','AI配置文件无法读取，请检查本机配置。',503);}
  return {apiKey:(process.env.DEEPSEEK_API_KEY||values.DEEPSEEK_API_KEY||'').trim(),model:(process.env.FIRST_STEP_AI_MODEL||values.FIRST_STEP_AI_MODEL||'deepseek-flash').trim()};
}
const planner={type:'function',function:{name:'plan_tasks',description:'每条新问题先识别当前事项、是否多事项及必需补问。只做计划，不修改表单。必须以最新用户意图和更正为准。',parameters:{type:'object',properties:{status:{type:'string',enum:['choose','needs-info','ready','clarify','out-of-scope']},intent:{type:'string',enum:['calculate','review','guidance','questions'],description:'用户当前要计算、逐条核对、了解说明，还是整理问题。只问去哪查/一般先看什么时用guidance，不能强迫补金额。'},tasks:{type:'array',maxItems:3,items:{type:'object',properties:{module:{type:'string',enum:Object.keys(MODULES).filter(id=>id!=='list')},reason:{type:'string',description:'针对用户原话的一句短理由，不声称联网或已办理。'}},required:['module','reason'],additionalProperties:false}},activeModule:{type:['string','null'],enum:[...Object.keys(MODULES).filter(id=>id!=='list'),null]},questions:{type:'array',maxItems:3,items:{type:'object',properties:{label:{type:'string',description:'当前必须补充的问题，尽量简短；金额须带应发工资/个人社保/公积金/个税/其他扣款等准确项目名'},hint:{type:'string',description:'可选的简短填写提示，不提供虚构默认值'}},required:['label','hint'],additionalProperties:false}}},required:['status','intent','tasks','activeModule','questions'],additionalProperties:false}}};
const tools=[planner,
  {type:'function',function:{name:'search_city_policies',description:'按用户明确的城市查官方政策。已核验城市资料加实时官方青年驿站目录；不是全网搜索，不自动认定资格。未知现金补贴返回未覆盖，不能套其他城市。',parameters:{type:'object',properties:{city:{type:'string',description:'用户明确说出的城市，不猜默认广州。'},topic:{type:'string',enum:['support','stay'],description:'现金补贴用support，求职住宿/青年驿站用stay。'}},required:['city','topic'],additionalProperties:false}}},
  {type:'function',function:{name:'open_tool',description:'用户希望打开工具，或问题需要某项工具时，提供站内入口。只能使用列出的模块。',parameters:{type:'object',properties:{module:{type:'string',enum:Object.keys(MODULES)}},required:['module'],additionalProperties:false}}},
  {type:'function',function:{name:'calculate_salary',description:'用用户明确提供的工资条金额做算术核对。所有前五项都必须已知，不能把缺失项当0。用户明确说某项扣款没有/没扣时该项可传0，不能要求改成数字句式；不知道或没有明细仍未知。evidence必须是逐段引用原话的数组。金额分多次提供就分别引用每次用户消息，不要合成改写的一段文字。',parameters:{type:'object',properties:{gross:{type:'number'},insurance:{type:'number'},fund:{type:'number'},tax:{type:'number'},other:{type:'number'},received:{type:['number','null']},evidence:{type:'array',items:{type:'string'},maxItems:10}},required:['gross','insurance','fund','tax','other','received','evidence'],additionalProperties:false}}},
  {type:'function',function:{name:'review_contract',description:'对用户提供的文字进行本地合同规则核对。仅在用户明确说是全日制劳动合同后使用；原文必须逐字来自用户消息，期限不清楚传null，不能擅自补全。',parameters:{type:'object',properties:{text:{type:'string'},contractMonths:{type:['number','null']},probationMonths:{type:['number','null']},fullTimeConfirmed:{type:'boolean'}},required:['text','contractMonths','probationMonths','fullTimeConfirmed'],additionalProperties:false}}},
  {type:'function',function:{name:'prepare_questions',description:'把要向HR、房东或经办人核实的问题整理成清单，用户点击后加入本机清单。最多5条，不替用户确认事实。',parameters:{type:'object',properties:{module:{type:'string',enum:Object.keys(MODULES)},questions:{type:'array',items:{type:'string'}}},required:['module','questions'],additionalProperties:false}}},
];
const SYSTEM=`你是“初程”的办事助手，面向刚毕业、第一次工作的人。用户觉得选项麻烦，所以你负责听懂问题、只补问当前必要的信息、调用工具，再告诉他下一步。用自然、简短的中文，不用营销口号、长开场、Markdown大标题或“赋能/闭环/全方位”式文案。
站内工具：Offer对比、合同核对、工资明细、个税限定试算、社保医保导航、租房核对、补贴匹配、离职交接，以及共享询问清单。用户不必知道模块名。用户问解释或做法时先直接回答，只有明确想打开工具时才用open_tool提供入口。界面会显示可点击按钮，不要声称已经替用户打开或修改。
回答先给直接有用的信息，不重述用户问题，不罗列八个模块。通常控制在2到3个短段落、约200字内；复杂风险可稍长，但详细原文和依据留给对应工具。缺材料时一次列清本次必需信息，不讲大段背景。工资关键数字和待加入清单的问题已由界面直接展示，你只需解释边界和下一步，不重复整张结果表。用户问具体字段就只回答该字段；不要把简单问题扩写成完整办事教程。建议把重要约定写清以便核实，不要一概声称口头约定无效、口头说的不算或口头承诺不算数。
用户随时可以直接打字补充、纠正、换问题，也可以一口气说明几件事。不要要求按预设格式回答、先填完表单或先选中某模块才能继续聊。工具参数仅在实际计算/核对时需要。问解释和做法时不要索取计算字段。
用户转去处理新问题时，专注当前问题，不追问上一事项的可选字段，也不每次催问实际到账等非必填信息。
工资金额必须调用calculate_salary；前五项缺一项就明确问还缺哪几项，不能默认为0，也不能只丢一个入口让用户自行找。只算用户明确提供的数据，不猜地方缴费率、到手工资或退税。合同在用户确认全日制及提供文字后可用review_contract；一年可按12个月理解，但未知仍传null。不可把“本次没定位”说成完整合同违法。
合同工具返回本地规则。合同计划ready后，程序会检索已核验的官方资料，把contractKnowledge及source交给你；这是本地资料检索，不是实时网页搜索。只有status=matched的excerpts才是本次命中依据，用这些原文解释，不能靠旧referenceNotes冒充检索。引用的适用范围、区间含/不含边界和核验日必须准确。资料之外的金额、期限或法律结论不要凭记忆补充。只解释与当前问题直接相关的一点，不额外扩展未命中的其他规定。这个聊天入口仅接收文字，不能声称你已读取照片；本站合同工具另有单张图片明确发送、识别和人工校对入口。用户问怎样上传照片时以guidance计划并用open_tool打开contract，不先要求粘贴整份原文。资料库仅收录中国内地劳动合同法第17、19、22、23、25条，未覆盖的问题说明需另查。合同没有实时网页搜索或官方办理权限，不可声称提交申请。检索依据由界面单独展示，不自行生成URL、虚构条文或声称逐句审核通过。地方政策使用search_city_policies。已核验目录目前有广州、深圳的有限补贴资料，杭州/上海求职住宿条目；未收录城市的求职住宿可从国家大学生就业服务平台实时发现并读取正文，现金补贴未覆盖时明确说明。先问清城市，再查询；用户说求职住宿/驿站用stay，现金补贴用support。不虚构金额、资格或链接；官方目录公开时间不代表当前申报期。杭州条目正文限西湖区，不能说杭州所有区都适用。
用户已经有表单材料也不会自动发送给你；只根据这次聊天的用户文字和当前模块名处理。引用不得编造，工具结果不能修改。对没法确定的事项，说明还缺什么，给1到2个明确问题。准备提问用prepare_questions。
你只能调用下列白名单工具，不执行代码、不访问文件、不操控音乐、账号、支付或外部服务。与毕业生活事项无关的请求简单说明服务范围。回复用短段落，不写Markdown加粗或大标题。只有prepare_questions成功后才有加入清单按钮；不要编造未生成的按钮，也不要声称用户已点击。给出结果后仅提到这次工具实际生成的操作。`;

const GUIDANCE=`
每条最新用户消息的第一步必须调用plan_tasks。政策/补贴/求职住宿按subsidy处理；城市明确则ready+guidance，用search_city_policies查询，不索要申领资格才需的隐私材料。城市未明确时必须status=clarify、tasks=[]、activeModule=null、questions仅问城市；不要用guidance+needs-info。不得从之前助手文字获取城市。先判断intent，用户只想了解或查找信息（包括“只知道应发，应该从哪一步开始”）时用guidance并ready，不追问计算才需要的数据。先给取得本期工资条、个人扣款与到账记录的方法，不能以索要数字开头。不要通过每天/每周工时自行认定全日制，须核实合同及实际用工关系。
- 只处理用户现在要办的事，最新更正优先；用户明确转到租房，就不再追问之前工资的字段。
- 两件或三件事都需要处理、用户没有说先办哪件：status=choose，tasks列出2–3件，activeModule=null，questions=[]。请用户用自己的话或可选按钮说明想先聊哪件，允许继续补充情况；不能自行决定或先算钱。用户说“先工资/先合同”时只聚焦该项，其他可保留为后续候选。
- 缺少当前必需信息：status=needs-info，activeModule必须在tasks中，questions一次最多3项。工资要计算时前五项均需明确，缺哪项问哪项，不问已经明确的；实际到账可选，不为它阻塞计算。问句只写“应发工资/个人社保/公积金/个税/其他扣款”等短项目名，提示写单位。
- 用户明确说“其他扣款没有”“个税没扣”等，按该项0元处理并引用这句原话；不能再次要求用户说0。没有账户、没有明细、可能没有、还不知道都不等于0。已有五项确认值时必须ready并调用calculate_salary，不能反复问已知字段。
- 用户不确定的数不能填0。用户已明确“不知道”时，不要重复索要同一数字，解释可以到哪里查，必要时给手动工具入口；暂时只做说明时用ready且不执行计算。
- 合同逐条核对需要用户提供合同文字并确认全日制；若用户只问一般试用期规则，可以先解释范围，不强迫上传完整合同。缺少期限可传null但明确未知。不得声称已检查照片/PDF。
- 现在足够给出有限说明或执行对应受限工具：status=ready，聚焦一个activeModule，questions=[]。需要工资计算仍必须实际调用calculate_salary；需要原文核对仍必须调用review_contract。计划本身不是计算或核对。
- 看不出具体事项：status=clarify，tasks=[]，activeModule=null，最多2个具体问题。无关/超范围请求用out-of-scope，空tasks/activeModule/questions；不把每个问题硬归类。
- 填写提示已由程序统一为确认值/不知道，不许建议未知填0或先填估计数。用户问去哪里查，至少给出工资条或向HR索取明细等直接方法，不要只返回工具入口。不要编造地方的申报/到账周期。
- 合同数字只能依据本次工具返回的contractKnowledge.excerpts或实际核对结果。信息不明时不由试用期倒推合同期，不凭记忆编造上限。引用时区间的含/不含边界不能省略；未获得文本不宣称已核对。资料为本地核验，不是联网检索。
- 不要从assistant旧回复获得金额、身份或期限。表单不存在隐式上下文。若用户否定了旧事实且没给新值，先问清楚，旧值不能继续使用。
- 租房只问一般退押金流程或解释时仍用guidance+ready、questions=[]，先给有限说明，可在回答末尾邀请补充阶段。只有要判断个人合同或具体争议且阶段不明确时，才用review+needs-info询问签约前、居住中、准备退租或已发生争议。用户只说“租房押金”不代表房东不退，不要预设争议、拒退或违约已经发生。
- plan_tasks的questions会成为自然语言补问和可选填写，tasks只作内部路由与可选快捷回复；不向用户解释内部状态，不要求用户完成表单才继续。纠正事项不会自动执行操作；按钮需用户点击。不要输出没有生成的导航按钮。
`;

export function validateConversation(input){
  if(!object(input)||!Array.isArray(input.messages)||input.messages.length<1||input.messages.length>16)throw new AssistantError('invalid-input','这次对话太长了，请新建一段对话后继续。');
  const messages=input.messages.map(item=>{
    if(!object(item)||!['user','assistant'].includes(item.role)||typeof item.content!=='string'||!item.content.trim()||item.content.length>6000)throw new AssistantError('invalid-input','请用文字说明问题，每条最多6000字。');
    return {role:item.role,content:item.content};
  });
  if(messages.at(-1).role!=='user'||messages.reduce((sum,m)=>sum+m.content.length,0)>24000)throw new AssistantError('invalid-input','请缩短问题，或新建一段对话。');
  const currentModule=Object.hasOwn(MODULES,input.module)?input.module:'home';
  return {messages,currentModule,userText:messages.filter(m=>m.role==='user').map(m=>m.content).join('\n')};
}
function exactEvidence(value,userText){return typeof value==='string'&&value.trim().length>0&&value.length<=12000&&userText.includes(value);}
const MONEY_LABELS=SALARY_LABELS;
const moneyProvided=salaryValueGrounded;
function reconcileSalaryPlan(guide,userText,latest){
  if(guide.activeModule!=='salary'||!['ready','needs-info'].includes(guide.status))return guide;
  if(asksSalaryFirstStep(latest))return {...guide,intent:'guidance',status:'ready',questions:[]};
  if(guide.intent!=='calculate')return guide;
  const facts=salaryFacts(userText),missing=SALARY_REQUIRED.filter(key=>facts[key].state!=='confirmed');
  if(!missing.length)return {...guide,status:'ready',questions:[]};
  return {...guide,status:'needs-info',questions:missing.slice(0,3).map(key=>({label:SALARY_FIELD_NAMES[key],hint:'填写已确认金额（元）；不清楚就写“不知道”。'}))};
}
function confirmedDuration(value,key,userText){
  if(value===null)return true;
  const labels=key==='contractMonths'?'(?:合同期限|合同期|合同[，, ]*期限|期限)':'(?:试用期)';
  const pattern=new RegExp(`${labels}[^。；;\\n\\d一二两三四五六七八九十零〇]{0,12}(\\d+(?:\\.\\d+)?|[一二两三四五六七八九十零〇]+)\\s*(个?月|年)`,'gu');
  const number=token=>{if(/^\d/.test(token))return Number(token);const digits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(token==='十')return 10;if(token.includes('十')){const [a,b]=token.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0);}return digits[token];};
  const last=Array.from(userText.matchAll(new RegExp(labels,'gu'))).at(-1),latest=last?userText.slice(last.index).split(/[。；;\n]/u)[0]:'';
  if(/不是|不对|不确定|不知道|不清楚|待确认|撤回/u.test(latest))return false;
  const match=Array.from(latest.matchAll(pattern)).at(-1);
  return Boolean(match&&number(match[1])*(match[2]==='年'?12:1)===value);
}
export function executeAssistantTool(name,args,userText,{latestUserMessage=userText.split("\n").at(-1)??userText}={}){
  if(!object(args))throw new AssistantError('tool-input','工具参数不完整，请补充信息。');
  if(name==='plan_tasks'){
    if(args.activeModule==='subsidy'&&args.status==='needs-info'&&Array.isArray(args.questions)&&args.questions.some(q=>/城市|地区/u.test(q?.label||''))){args={...args,intent:'guidance',status:'clarify',tasks:[],activeModule:null,questions:[{label:'你想查哪个城市',hint:''}]};}
    if(args.intent==='guidance'&&args.status==='needs-info')throw new AssistantError('tool-input','一般解释请用intent=guidance、status=ready、questions=[]，先回答已有范围。只有个人计算或材料核对确实缺少信息时才用calculate/review与needs-info。');
    let guide;try{guide=validateAssistantGuide(args);}catch{throw new AssistantError('tool-input','事项计划不完整，请重新确认当前事项和必要补问。');}
    guide=reconcileSalaryPlan(guide,userText,latestUserMessage);
    if(guide.activeModule==='rent'&&guide.questions.some(q=>/不退|拒退|扣押|已退租/u.test(q.label))&&!/不退|拒退|扣押|已退租/u.test(userText))throw new AssistantError('tool-input','租房阶段尚未确认，先问签约前、居住中、准备退租还是已有争议，不能预设房东拒退。');
    return {guide,result:{guide,referenceNotes:guide.activeModule==='contract'?CONTRACT_REFERENCE:undefined,next:'请直接回答用户当前想了解的问题，不要只推荐工具或要求先进入模块。补问可直接用自然语言回复。'},label:'确认当前事项',summary:guide.activeModule?MODULES[guide.activeModule]:guide.status==='choose'?'等待选择先处理的事项':guide.status==='out-of-scope'?'不在工具范围内':'需要说明具体情况'};
  }
  if(name==='open_tool'){
    if(!Object.hasOwn(MODULES,args.module))throw new AssistantError('tool-input','只能打开本站已有的办事工具。');
    return {result:{module:args.module,label:MODULES[args.module],next:'用户可点击界面按钮打开，不代表已经打开。'},action:{kind:'open-tool',module:args.module,label:'打开'+MODULES[args.module]},label:'找到对应工具',summary:MODULES[args.module]};
  }
  if(name==='calculate_salary'){
    const quotes=Array.isArray(args.evidence)?args.evidence:[args.evidence];
    if(!quotes.length||quotes.length>10||quotes.some(quote=>!exactEvidence(quote,userText)))throw new AssistantError('tool-input','金额证据需逐段引用用户原话；分次提供的金额请分别引用，不要拼成改写后的文字。');
    const evidence=quotes.join('\n');
    const keys=['gross','insurance','fund','tax','other'];
    const grounded=(value,key)=>moneyProvided(value,evidence,key)&&moneyProvided(value,userText,key);
    if(keys.some(key=>!grounded(args[key],key))||(args.received!==null&&!grounded(args.received,'received')))throw new AssistantError('tool-input','有金额尚未与对应项目在用户最新文字中确认，请逐项补问；明确没有该项扣款可按0核对，但不知道或没有明细不能当0。');
    const input=Object.fromEntries([...keys,'received'].map(key=>[key,args[key]]));
    let value;try{value=calculatePayslip(input);}catch{throw new AssistantError('tool-input','工资金额未通过校验，请检查负数、小数精度和扣款合计。');}
    return {result:{input,...value,next:'界面已显示金额、算式和到账差额。只用两句解释先核实本期明细/计薪期间，再说明只核对算术；不要重复算式，不猜餐费、工会费等未提供的扣款项目。',boundary:'仅核对这些已知金额的算术关系，不判断费率和缴费基数是否合法。'},action:{kind:'apply-salary',input,label:'在工资工具查看结果'},label:'核对工资金额',summary:`计算实发 ${value.net.toFixed(2)} 元`};
  }
  if(name==='review_contract'){
    if(!exactEvidence(args.text,userText))throw new AssistantError('tool-input','合同文字必须来自用户提供的原文，不能改写后当作引用。');
    const scopeMatch=Array.from(userText.matchAll(/不是全日制|非全日制|全日制|普通劳动合同/gu)).at(-1),scope=scopeMatch?.[0];
    const aroundScope=scopeMatch?(userText.slice(0,scopeMatch.index).split(/[。；;\n]/u).at(-1)||'').slice(-12)+userText.slice(scopeMatch.index).split(/[。；;\n]/u)[0].slice(0,22):'';
    if(args.fullTimeConfirmed!==true||!scope||scope==='非全日制'||scope==='不是全日制'||/不确定|不知道|不能确认|不清楚|可能|[:：]\s*(?:不是|否|不属于)/u.test(aroundScope))throw new AssistantError('tool-input','请先问清楚是否为全日制劳动合同。');
    for(const key of ['contractMonths','probationMonths'])if(args[key]!==null&&(!finite(args[key])||args[key]<0||args[key]>1200||!confirmedDuration(args[key],key,userText)))throw new AssistantError('tool-input','期限还不能在用户文字中确认，请先补问或保留未知。');
    const input={text:args.text,contractMonths:args.contractMonths,probationMonths:args.probationMonths,fullTimeConfirmed:true};
    const findings=analyzeContract(input);
    return {result:{findings,boundary:'本地文字规则核对，未定位不等于条款不存在；非完整法律判断。'},action:{kind:'apply-contract',input,label:'在合同工具查看结果'},label:'核对合同文字',summary:`核对 ${findings.length} 项，${findings.filter(f=>f.status!=='noted').length} 项待确认`};
  }
  if(name==='prepare_questions'){
    if(!Object.hasOwn(MODULES,args.module)||!Array.isArray(args.questions)||args.questions.length<1||args.questions.length>5||args.questions.some(q=>typeof q!=='string'||!q.trim()||q.length>500))throw new AssistantError('tool-input','一次最多整理5个简短的问题。');
    const items=Array.from(new Set(args.questions.map(q=>q.trim()))).map(text=>({text,category:MODULES[args.module]}));
    return {result:{items,next:'用户点击后才加入本机询问清单。'},action:{kind:'add-questions',items,label:`加入 ${items.length} 个询问问题`},label:'整理询问清单',summary:`整理了 ${items.length} 个问题`};
  }
  throw new AssistantError('unknown-tool','这个操作不在可用工具范围内。');
}

export function guideReply(guide,userText=''){
  if(guide.status==='choose')return `${guide.tasks.map(task=>MODULES[task.module]).join('、')}都可以聊。你想先说哪件？也可以继续把情况讲完。`;
  if(guide.status==='needs-info'||guide.status==='clarify'){
    const labels=guide.questions.map(question=>question.label.replace(/[？?。]+$/u,''));
    const salary=guide.activeModule==='salary'&&guide.status==='needs-info';
    const unknown=salary?labels.filter(label=>Object.entries(MONEY_LABELS).some(([key,pattern])=>new RegExp(pattern,'u').test(label)&&salaryFact(userText,key).state==='unknown')):[];
    const remaining=labels.filter(label=>!unknown.includes(label));
    const questions=remaining.length?(salary?`还需要工资条上的${remaining.join('、')}。`:remaining.map(label=>label+'？').join('\n')):'';
    const note=unknown.length?`${unknown.join('、')}还没确认，先保留未知，不用猜。`:'可以直接回复，不确定就说“不知道”。';
    return [unknown.length?'先向HR要一份本期工资明细，或在工资条中找个人扣款。':questions,note,unknown.length?questions:''].filter(Boolean).join('\n\n');
  }
  return '这件事目前超出本站工具和资料的覆盖范围。你可以继续说明与入职、工资或租房有关的情况。';
}

/** Keep navigation in real controls. Fall back to exact excerpts if generated file capabilities conflict. */
export function finalizeContractExplanation(content,references){
  const reply=content.trim().split(/\n\s*\n/u).filter(paragraph=>!(/^(?:想|需要|如果你|你可以|也可以|有合同)/u.test(paragraph)&&/发我|发来|合同文字|照片|图片|PDF|工具|入口/iu.test(paragraph))).join('\n\n');
  const unsupportedAdvice=/考核|考察|降薪|降低工资|培训期|培训安排/u.test(reply)
    ||references.excerpts[0]?.id==='LC19-2'&&/实际.{0,4}(?:履行|经历)|履行过.{0,6}试用/u.test(reply)
    ||!references.excerpts.some(excerpt=>excerpt.id==='LC19-4')&&/试用期.{0,8}(?:包含|计入)|(?:包含|计入).{0,8}合同期限/u.test(reply)
    ||/这决定.{0,12}试用期|决定试用期是否/u.test(reply);
  if(!reply||unsupportedAdvice||/PDF.{0,40}(?:识别|OCR)|(?:识别|OCR).{0,40}PDF/iu.test(reply)){
    const first=references.excerpts[0];
    return {reply:`本次检索到的相关原文如下。\n\n${first.article}\n${first.text}${first.id==='LC19-2'?'\n\n请先确认你在同一单位此前是否已约定过试用期，签过合同本身不能证明这一点。':''}`,replyOrigin:'guide'};
  }
  return {reply,replyOrigin:'model'};
}

export async function runAssistant(input,{config,fetcher=fetch,signal,timeoutMs=45000,onProgress,policySearch=cityPolicyService.search}={}){
  const conversation=validateConversation(input);
  if(!config?.apiKey)throw new AssistantError('not-configured','助手暂时没有连接，可以先打开工具列表自行核对。',503);
  if(signal?.aborted)throw new AssistantError('aborted','已停止这次回复。',499);
  const controller=new AbortController();
  const cancel=()=>controller.abort();if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  const messages=[{role:'system',content:SYSTEM+GUIDANCE+`\n当前所在模块仅作导航背景，不能替代用户的新意图：${MODULES[conversation.currentModule]||'首页'}。`},...conversation.messages];
  const actions=[],steps=[];let totalTools=0,guide=null,references,policyReferences;
  const latestUserMessage=conversation.messages.at(-1).content.trim();
  const asksToOpen=/^(?:请|麻烦|帮我|带我|我想|我要|先|直接|现在|那就|可以|\s)*(?:打开|进入|跳转|去看看)/u.test(latestUserMessage);
  const namesAnEntry=Object.values(MODULES).some(name=>latestUserMessage.includes(name))||/工具|入口|页面|界面/u.test(latestUserMessage);
  const wantsEntry=asksToOpen&&namesAnEntry||/(?:工具|入口)(?:在|去)哪|(?:哪里|在哪).{0,6}(?:工具|入口)/u.test(latestUserMessage);
  const completedReply=()=>({reply:actions.some(a=>a.kind==='add-questions')?'要核实的问题已整理好。点下方按钮才会加入清单，加入后仍可修改。':actions.some(a=>a.kind==='apply-salary'||a.kind==='apply-contract')?'本次核对已完成，可以在下方打开工具查看结果，或继续补充信息。':'点下方入口打开工具后，可以继续填写和核对。',replyOrigin:'guide',actions,steps,guide,references,policyReferences,provider:'DeepSeek',model:config.model||'deepseek-flash'});
  try{
    for(let round=0;round<4;round++){
      onProgress?.(guide?'responding':'planning');
      const explainingContract=guide?.activeModule==='contract'&&guide.intent==='guidance'&&references?.status==='matched';
      const policyLookup=guide?.activeModule==='subsidy'&&guide.status==='ready'&&guide.intent!=='questions'&&!wantsEntry;
      const explainingGuidance=guide?.intent==='guidance'&&!wantsEntry&&!policyLookup;
      const allowTools=guide?.status==='ready'&&!explainingGuidance&&actions.length===0;
      const requiredTool=allowTools&&policyLookup?'search_city_policies':allowTools&&guide.intent==='questions'?'prepare_questions':allowTools&&guide.activeModule==='salary'&&guide.intent==='calculate'?'calculate_salary':null;
      let response;
      try{response=await fetcher(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.apiKey}`},body:JSON.stringify({model:config.model||'deepseek-flash',messages,tools:guide?(allowTools?tools.filter(tool=>tool!==planner):[]):[planner],tool_choice:guide?(requiredTool?{type:'function',function:{name:requiredTool}}:allowTools?'auto':'none'):{type:'function',function:{name:'plan_tasks'}},thinking:{type:'disabled'},stream:false,max_tokens:1600,temperature:.3}),signal:controller.signal});}
      catch{if(controller.signal.aborted)throw new AssistantError(timedOut?'timeout':'aborted',timedOut?'DeepSeek这次回复较慢，请稍后重试。':'已停止这次回复。',timedOut?504:499);throw new AssistantError('upstream-network','暂时联系不上DeepSeek，请稍后再试。',502);}
      if(!response.ok){
        if(response.status===401||response.status===403)throw new AssistantError('upstream-auth','助手的模型服务暂不可用，请联系网站维护者，或先使用工具列表。',503);
        if(response.status===402)throw new AssistantError('upstream-balance','助手当前额度暂不可用，请联系网站维护者，或先使用工具列表。',503);
        if(response.status===429)throw new AssistantError('upstream-rate','DeepSeek当前请求较多，请稍后重试。',429);
        throw new AssistantError('upstream-http','DeepSeek暂时没有完成请求，请稍后重试。',502);
      }
      let data;try{data=await response.json();}catch{if(controller.signal.aborted)throw new AssistantError(timedOut?'timeout':'aborted',timedOut?'DeepSeek这次回复较慢，请稍后重试。':'已停止这次回复。',timedOut?504:499);throw new AssistantError('invalid-response','AI回复格式不完整，请重试。',502);}
      const choice=data?.choices?.[0],message=choice?.message;
      if(!object(message)||choice.finish_reason==='length')throw new AssistantError('invalid-response','这次AI回复没有完成，请缩短问题后重试。',502);
      if(actions.length&&message.tool_calls?.length)return completedReply();
      if(!message.tool_calls?.length){
        if(typeof message.content!=='string'||!message.content.trim()||message.content.length>16000)throw new AssistantError('invalid-response','AI没有给出可用回复，请重试。',502);
        if(!guide)throw new AssistantError('invalid-response','这次没有确认要处理的事项，请重试或自行选择工具。',502);
        if(guide.activeModule==='contract'&&references?.status==='matched'&&guide.intent!=='questions'&&!actions.some(action=>action.kind==='apply-contract'||action.kind==='open-tool'&&action.module==='contract')){
          const entry=executeAssistantTool('open_tool',{module:'contract'},conversation.userText);
          actions.push(entry.action);
          steps.push({id:'contract-entry',name:'open_tool',label:entry.label,ok:true,summary:entry.summary});
        }
        if(policyLookup){
          if(!policyReferences||policyReferences.status!=='matched')return {reply:policyReferences?.message||'这次没有取得可核对的官方资料，可以换个城市或到政策工具重试。',replyOrigin:'guide',actions,steps,guide,policyReferences,provider:'DeepSeek',model:config.model||'deepseek-flash'};
          const evidence=policyReferences.sources.map(s=>s.text+' '+s.scope+' '+s.publishedOn+' '+s.checkedOn).join(' ');
          const numberedProse=message.content.replace(/^\s*\d+[、.)．]\s*/gmu,'');
          const invented=(numberedProse.match(/\d+(?:\.\d+)?/gu)||[]).some(number=>!evidence.includes(number));
          if(invented||/一定能领|肯定符合|保证(?:通过|获批)|所有毕业生都|已经(?:申请|提交)/u.test(message.content))return {reply:'官方资料已列在下方，请先核对所在区县、毕业阶段和当期办理要求。资料中的标准不代表你已符合或已获批。',replyOrigin:'guide',actions,steps,guide,policyReferences,provider:'DeepSeek',model:config.model||'deepseek-flash'};
        }
        const explanation=explainingContract?finalizeContractExplanation(message.content,references):{reply:message.content.trim(),replyOrigin:'model'};
        return {...explanation,actions,steps,guide,references,policyReferences,provider:'DeepSeek',model:config.model||'deepseek-flash'};
      }
      if(!Array.isArray(message.tool_calls)||message.tool_calls.length>3||totalTools+message.tool_calls.length>6)throw new AssistantError('tool-limit','这次问题涉及的步骤较多，请先选一件事处理。',502);
      const calls=message.tool_calls;
      if(calls.some(c=>!object(c)||typeof c.id!=='string'||c.id.length>100||!object(c.function)||typeof c.function.name!=='string'||typeof c.function.arguments!=='string'||c.function.arguments.length>24000))throw new AssistantError('invalid-response','AI的工具请求不完整，请重试。',502);
      messages.push({role:'assistant',content:typeof message.content==='string'?message.content:null,tool_calls:calls});
      for(const call of calls){
        totalTools++;let execution;
        try{
          const args=JSON.parse(call.function.arguments),name=call.function.name;
          if(guide&&name==='plan_tasks')throw new AssistantError('tool-input','本次事项已经确认，请按当前计划调用工具或说明结果，不要重复规划。');
          if(!guide&&name!=='plan_tasks')throw new AssistantError('tool-input','先确认当前事项，不能跳过补问和用户选择。');
          if(name!=='plan_tasks'){
            onProgress?.('checking');
            if(guide.status!=='ready')throw new AssistantError('tool-input','当前还需要用户选择或补充信息，这一步未执行。');
            const target=name==='search_city_policies'?'subsidy':name==='calculate_salary'?'salary':name==='review_contract'?'contract':args.module;
            if(target!==guide.activeModule&&!(name==='open_tool'&&target==='list'))throw new AssistantError('tool-input','不能把其他事项的数据应用到当前事项。请先切换事项。');
          }
          if(name==='search_city_policies'){
            const city=policyCity(args.city);
            assertPolicyCityEvidence(city,conversation.messages.filter(m=>m.role==='user').map(m=>m.content));
            onProgress?.('retrieving');policyReferences=await policySearch(city,args.topic,{signal:controller.signal});
            if(!isCityPolicyResult(policyReferences)||policyReferences.city!==city||policyReferences.topic!==args.topic){policyReferences=undefined;throw new AssistantError('tool-input','来源城市或格式未能核对，本次不解释。');}
            execution={result:{policyReferences,next:'只解释本次sources里的资料，保留区县、毕业学年等限制。不要额外给金额、资格保证、当前开放结论或自编链接。来源卡已展示原文和日期，简短说明下一步核实哪项。mode=live的checkedOn仅是读取日期，不是政策生效或专业审核日期；不要把旧目录说成当期开放。'},action:{kind:'open-city-policy',city,topic:args.topic,label:'在政策工具查看'+city},label:'查找官方城市政策',summary:policyReferences.status==='matched'?city+' · '+policyReferences.sources.length+'项资料':policyReferences.message};
          }else execution=executeAssistantTool(name,args,conversation.userText,{latestUserMessage});
          if(execution.guide){guide=execution.guide;actions.length=0;references=undefined;}
        }
        catch(error){execution={result:{error:'not-executed',message:error instanceof AssistantError?error.message:'参数无法核对，请补充信息。'},label:'需要补充信息',summary:'这一步没有执行'};}
        const ok=Boolean(execution.action||execution.guide);
        steps.push({id:String(totalTools),name:call.function.name,label:execution.label,ok,summary:execution.summary});
        const latestQuestion=conversation.messages.at(-1).content;
        const asksContract=guide?.activeModule==='contract'||(!guide?.activeModule&&/合同|试用/u.test(latestQuestion));
        const photoGuidance=guide?.intent==='guidance'&&/照片|图片|拍照|PDF/iu.test(latestQuestion);
        if(execution.guide&&guide.status!=='choose'&&asksContract&&!photoGuidance){
          const retrieved=searchContractKnowledge(contractQueryFromMessages(conversation.messages),{context:conversation.userText});
          if(retrieved.status==='out-of-scope'){
            guide={...guide,status:'out-of-scope',tasks:[],activeModule:null,questions:[]};
            execution.result.guide=guide;
          }
          if(guide.status==='ready'||retrieved.status==='out-of-scope'){
            onProgress?.('retrieving');
            references=retrieved;
            delete execution.result.referenceNotes;
            execution.result.contractKnowledge=references;
            execution.result.source=CONTRACT_KNOWLEDGE;
            execution.result.next='请直接用命中原文回答当前问题，先给简短解释。不要只让用户打开工具，也不要重复完整条文。本次最终解释不提材料上传、图片、PDF或工具入口，界面会单独展示原文和真实入口。不要提出条文之外的考核期、培训期或工资处理建议。重复试用的原文用词为“约定”，不能另加“实际经历/履行过”这一条件；是否此前已约定不明时用条件句，单纯签过合同不等于已约定试用期。若合同总期限尚不明确，只说明包含关系并提示核实总期限，不直接认定这份合同总共12或15个月。';
            steps.push({id:'references-'+totalTools,name:'search_contract_knowledge',label:'检索官方合同资料',ok:references.status==='matched',summary:references.status==='matched'?`命中 ${references.excerpts.length} 段 · ${CONTRACT_KNOWLEDGE.version}`:references.message});
          }
        }
        if(execution.action&&!actions.some(a=>JSON.stringify(a)===JSON.stringify(execution.action))){const old=actions.findIndex(a=>a.kind===execution.action.kind&&['apply-salary','apply-contract','open-tool'].includes(a.kind));if(old>=0)actions.splice(old,1);actions.push(execution.action);}
        messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(execution.result)});
      }
      if(guide?.status==='ready'&&guide.intent==='guidance'&&wantsEntry&&actions.some(action=>action.kind==='open-tool')){
        return {reply:'点下方入口就能打开，你也可以继续在这里提问。',replyOrigin:'guide',actions,steps,guide,references,policyReferences,provider:'DeepSeek',model:config.model||'deepseek-flash'};
      }
      if(references&&references.status!=='matched'){
        return {reply:references.message,replyOrigin:'guide',actions:[],steps,guide,references,policyReferences,provider:'DeepSeek',model:config.model||'deepseek-flash'};
      }
      if(guide&&guide.status!=='ready'){
        return {reply:guideReply(guide,conversation.userText),replyOrigin:'guide',actions:[],steps,guide,provider:'DeepSeek',model:config.model||'deepseek-flash'};
      }
      if(guide?.status==='ready'&&guide.activeModule==='contract'&&guide.intent==='guidance'&&/照片|图片|拍照|PDF/iu.test(conversation.messages.at(-1).content)){
        const entry=executeAssistantTool('open_tool',{module:'contract'},conversation.userText);
        return {reply:/PDF/iu.test(conversation.messages.at(-1).content)?'PDF目前只能在合同工具里预览。请粘贴其中的文字，或把需要核对的一页另存为PNG/JPEG图片，再用“从合同照片开始”识别并人工校对。':'在合同工具顶部打开“从合同照片开始”。选图只会预览，点击发送识别后，再对照原图校对文字。校对完成后确认用工类型与期限，再进行规则核对。',replyOrigin:'guide',actions:[entry.action],steps:[...steps,{id:String(steps.length+1),name:'open_tool',label:'提供图片校对入口',ok:true,summary:'合同工具 · 单页图片'}],guide,provider:'DeepSeek',model:config.model||'deepseek-flash'};
      }
    }
    if(actions.length)return completedReply();
    throw new AssistantError('tool-limit','AI这次没能完成处理，请换个问法，或直接打开对应工具。',502);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}

function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
function readBody(req){return new Promise((resolve,reject)=>{let size=0;const chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size<=98304)chunks.push(chunk);});req.on('end',()=>{if(size>98304){reject(new AssistantError('too-large','问题内容太长，请分次发送。',413));return;}try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new AssistantError('invalid-input','请求内容无法读取，请重新发送。'));}});req.on('error',()=>reject(new AssistantError('aborted','请求已停止。',499)));req.on('aborted',()=>reject(new AssistantError('aborted','请求已停止。',499)));});}
export function createAssistantMiddleware({directory,config,fetcher,timeoutMs,usage,credentials,policy=createRequestPolicy()}={}){
  let busy=0;const starts=[];
  return (req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(!path.startsWith('/api/v1/assistant/'))return false;
    const requestId=randomUUID();
    const fail=error=>{if(res.destroyed||res.writableEnded)return;if(error instanceof UsageError&&!res.headersSent)res.setHeader('Retry-After',String(error.retryAfter));const e=error instanceof AssistantError?error:error instanceof UsageError||error?.code==='settings-expired'?new AssistantError(error.code,error.message,error.status||503):new AssistantError('internal','这次请求没有完成，请稍后重试。',500);if(res.headersSent){res.end(JSON.stringify({type:'error',error:{code:e.code,message:e.message}})+'\n');}else json(res,e.status,{requestId,error:{code:e.code,message:e.message}});};
    try{
      if(!policy.allows(req))throw new AssistantError('origin','请在本站页面中使用AI助手。',403);
      const base=config??readAssistantConfig(directory||process.cwd());
      if(path==='/api/v1/assistant/status'&&req.method==='GET'){const state=credentials?.describe(req,res);json(res,200,{requestId,data:{configured:state?.configured??Boolean(base.apiKey),provider:'DeepSeek',model:state?.model||base.model||'deepseek-flash',...(state?{connection:state.mode}:{})}});return true;}
      const current=credentials?credentials.configuration(req,res,base):base;
      if(path!=='/api/v1/assistant/chat'){throw new AssistantError('not-found','没有找到这个AI接口。',404);}
      if(req.method!=='POST')throw new AssistantError('method','这个接口需要发送文字问题。',405);
      if(!req.headers['content-type']?.startsWith('application/json'))throw new AssistantError('content-type','请使用文字对话入口。',415);
      const now=Date.now();while(starts.length&&starts[0]<now-60000)starts.shift();
      if(busy>=2||starts.length>=12)throw new AssistantError('rate','现在使用的人较多，请稍后重试，也可以先使用工具列表。',429);
      starts.push(now);busy++;
      const abort=new AbortController();const disconnected=()=>{if(!res.writableEnded)abort.abort();};res.on('close',disconnected);
      const streaming=req.headers.accept?.includes('application/x-ndjson');
      const progress=stage=>{if(!streaming||res.destroyed||res.writableEnded)return;if(!res.headersSent){res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.flushHeaders();}res.write(JSON.stringify({type:'progress',stage})+'\n');};
      let lease;
      void readBody(req).then(input=>{validateConversation(input);if(abort.signal.aborted)throw new AssistantError('aborted','已停止回复。',499);if(!current.apiKey)throw new AssistantError('not-configured','助手暂时没有连接，可以先使用工具列表。',503);if(policy.secure&&!usage)throw new AssistantError('usage-unavailable','试用计数暂不可用，请稍后再试。',503);lease=usage?.reserve(req,res,'chat',policy.secure);return runAssistant(input,{config:current,fetcher,signal:abort.signal,timeoutMs,onProgress:progress});}).then(data=>{if(res.destroyed)return;if(res.headersSent)res.end(JSON.stringify({type:'result',data})+'\n');else json(res,200,{requestId,data});}).catch(fail).finally(()=>{lease?.release();busy--;res.removeListener('close',disconnected);});
    }catch(error){fail(error);}
    return true;
  };
}
