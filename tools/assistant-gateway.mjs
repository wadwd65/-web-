import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {calculatePayslip} from '../src/lib/wages.ts';
import {analyzeContract} from '../src/lib/contracts.ts';

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
const tools=[
  {type:'function',function:{name:'open_tool',description:'用户希望打开工具，或问题需要某项工具时，提供站内入口。只能使用列出的模块。',parameters:{type:'object',properties:{module:{type:'string',enum:Object.keys(MODULES)}},required:['module'],additionalProperties:false}}},
  {type:'function',function:{name:'calculate_salary',description:'用用户明确提供的工资条金额做算术核对。所有前五项都必须已知，不能把缺失项当0。evidence必须逐字引用用户提供金额的文字。',parameters:{type:'object',properties:{gross:{type:'number'},insurance:{type:'number'},fund:{type:'number'},tax:{type:'number'},other:{type:'number'},received:{type:['number','null']},evidence:{type:'string'}},required:['gross','insurance','fund','tax','other','received','evidence'],additionalProperties:false}}},
  {type:'function',function:{name:'review_contract',description:'对用户提供的文字进行本地合同规则核对。仅在用户明确说是全日制劳动合同后使用；原文必须逐字来自用户消息，期限不清楚传null，不能擅自补全。',parameters:{type:'object',properties:{text:{type:'string'},contractMonths:{type:['number','null']},probationMonths:{type:['number','null']},fullTimeConfirmed:{type:'boolean'}},required:['text','contractMonths','probationMonths','fullTimeConfirmed'],additionalProperties:false}}},
  {type:'function',function:{name:'prepare_questions',description:'把要向HR、房东或经办人核实的问题整理成清单，用户点击后加入本机清单。最多5条，不替用户确认事实。',parameters:{type:'object',properties:{module:{type:'string',enum:Object.keys(MODULES)},questions:{type:'array',items:{type:'string'}}},required:['module','questions'],additionalProperties:false}}},
];
const SYSTEM=`你是“初程”的办事助手，面向刚毕业、第一次工作的人。用户觉得选项麻烦，所以你负责听懂问题、只补问当前必要的信息、调用工具，再告诉他下一步。用自然、简短的中文，不用营销口号、长开场、Markdown大标题或“赋能/闭环/全方位”式文案。
站内工具：Offer对比、合同核对、工资明细、个税限定试算、社保医保导航、租房核对、补贴匹配、离职交接，以及共享询问清单。用户不必知道模块名，你可用open_tool给出入口；界面会显示可点击按钮，不要声称已经替用户打开或修改。
回答先给直接有用的信息，不重述用户问题，不罗列八个模块。通常控制在2到3个短段落、约200字内；复杂风险可稍长，但详细原文和依据留给对应工具。缺材料时一次列清本次必需信息，不讲大段背景。工资关键数字和待加入清单的问题已由界面直接展示，你只需解释边界和下一步，不重复整张结果表。用户问具体字段就只回答该字段；不要把简单问题扩写成完整办事教程。
用户转去处理新问题时，专注当前问题，不追问上一事项的可选字段，也不每次催问实际到账等非必填信息。
工资金额必须调用calculate_salary；前五项缺一项就明确问还缺哪几项，不能默认为0，也不能只丢一个入口让用户自行找。只算用户明确提供的数据，不猜地方缴费率、到手工资或退税。合同在用户确认全日制及提供文字后可用review_contract；一年可按12个月理解，但未知仍传null。不可把“本次没定位”说成完整合同违法。
合同工具返回的是已核验日期的本地规则与来源，不是在线检索。你现在没有网页搜索、RAG、OCR、图片识别或官方办理权限，不可声称已经联网查过、识图或提交申请。补贴只维护一条广州求职创业补贴样例；其他地区说明需核实，不虚构金额、资格、政策或官方链接。
用户已经有表单材料也不会自动发送给你；只根据这次聊天的用户文字和当前模块名处理。引用不得编造，工具结果不能修改。对没法确定的事项，说明还缺什么，给1到2个明确问题。准备提问用prepare_questions。
你只能调用下列白名单工具，不执行代码、不访问文件、不操控音乐、账号、支付或外部服务。与毕业生活事项无关的请求简单说明服务范围。回复用短段落，不写Markdown加粗或大标题。只有prepare_questions成功后才有加入清单按钮；不要编造未生成的按钮，也不要声称用户已点击。给出结果后仅提到这次工具实际生成的操作。`;

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
function moneyProvided(value,evidence,key){
  if(!finite(value)||value<0)return false;
  const labels={gross:'(?:应发(?:工资)?|税前(?:工资)?)',insurance:'(?:个人)?社保(?:扣款)?',fund:'(?:个人)?公积金(?:扣款)?',tax:'(?:已扣)?(?:个人所得税|个税)',other:'(?:其他|其它)扣款',received:'(?:实际到账|到账|实发)(?:工资|金额)?'};
  const pattern=new RegExp(`${labels[key]}[^\\d，,。；;\\n]{0,10}(\\d+(?:\\.\\d{1,2})?)(?=元|[，,。；;\\n\\s]|$)`,'gu');
  const amounts=Array.from(evidence.replace(/[,，](?=\d{3}(?:\D|$))/g,'').matchAll(pattern),m=>Number(m[1]));
  return amounts.length>0&&Math.abs(amounts.at(-1)-value)<.00001;
}
function confirmedDuration(value,key,userText){
  if(value===null)return true;
  const labels=key==='contractMonths'?'(?:合同期限|合同期|合同[，, ]*期限|期限)':'(?:试用期)';
  const pattern=new RegExp(`${labels}[^。；;\\n\\d一二两三四五六七八九十零〇]{0,12}(\\d+(?:\\.\\d+)?|[一二两三四五六七八九十零〇]+)\\s*(个?月|年)`,'gu');
  const number=token=>{if(/^\d/.test(token))return Number(token);const digits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(token==='十')return 10;if(token.includes('十')){const [a,b]=token.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0);}return digits[token];};
  const match=Array.from(userText.matchAll(pattern)).at(-1);
  return Boolean(match&&number(match[1])*(match[2]==='年'?12:1)===value);
}
export function executeAssistantTool(name,args,userText){
  if(!object(args))throw new AssistantError('tool-input','工具参数不完整，请补充信息。');
  if(name==='open_tool'){
    if(!Object.hasOwn(MODULES,args.module))throw new AssistantError('tool-input','只能打开本站已有的办事工具。');
    return {result:{module:args.module,label:MODULES[args.module],next:'用户可点击界面按钮打开，不代表已经打开。'},action:{kind:'open-tool',module:args.module,label:'打开'+MODULES[args.module]},label:'找到对应工具',summary:MODULES[args.module]};
  }
  if(name==='calculate_salary'){
    if(!exactEvidence(args.evidence,userText))throw new AssistantError('tool-input','没有找到用户提供的金额原文，请先核对。');
    const keys=['gross','insurance','fund','tax','other'];
    const grounded=(value,key)=>moneyProvided(value,args.evidence,key)&&moneyProvided(value,userText,key);
    if(keys.some(key=>!grounded(args[key],key))||(args.received!==null&&!grounded(args.received,'received')))throw new AssistantError('tool-input','有金额尚未与对应项目在用户最新文字中确认，请逐项补问；没有的扣款也需用户明确填写0。');
    const input=Object.fromEntries([...keys,'received'].map(key=>[key,args[key]]));
    let value;try{value=calculatePayslip(input);}catch{throw new AssistantError('tool-input','工资金额未通过校验，请检查负数、小数精度和扣款合计。');}
    return {result:{input,...value,boundary:'仅核对这些已知金额的算术关系，不判断费率和缴费基数是否合法。'},action:{kind:'apply-salary',input,label:'在工资工具查看结果'},label:'核对工资金额',summary:`计算实发 ${value.net.toFixed(2)} 元`};
  }
  if(name==='review_contract'){
    if(!exactEvidence(args.text,userText))throw new AssistantError('tool-input','合同文字必须来自用户提供的原文，不能改写后当作引用。');
    const scope=Array.from(userText.matchAll(/非全日制|全日制|普通劳动合同/gu)).at(-1)?.[0];
    if(args.fullTimeConfirmed!==true||!scope||scope==='非全日制')throw new AssistantError('tool-input','请先问清楚是否为全日制劳动合同。');
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

export async function runAssistant(input,{config,fetcher=fetch,signal,timeoutMs=45000}={}){
  const conversation=validateConversation(input);
  if(!config?.apiKey)throw new AssistantError('not-configured','DeepSeek还没有连接。请配置服务端密钥，或先使用下方的办事工具。',503);
  if(signal?.aborted)throw new AssistantError('aborted','已停止这次回复。',499);
  const controller=new AbortController();
  const cancel=()=>controller.abort();if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  const messages=[{role:'system',content:SYSTEM+`\n当前所在模块：${MODULES[conversation.currentModule]||'首页'}。`},...conversation.messages];
  const actions=[],steps=[];let totalTools=0;
  try{
    for(let round=0;round<4;round++){
      let response;
      try{response=await fetcher(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.apiKey}`},body:JSON.stringify({model:config.model||'deepseek-flash',messages,tools,tool_choice:'auto',thinking:{type:'disabled'},stream:false,max_tokens:1600,temperature:.3}),signal:controller.signal});}
      catch{if(controller.signal.aborted)throw new AssistantError(timedOut?'timeout':'aborted',timedOut?'DeepSeek这次回复较慢，请稍后重试。':'已停止这次回复。',timedOut?504:499);throw new AssistantError('upstream-network','暂时联系不上DeepSeek，请稍后再试。',502);}
      if(!response.ok){
        if(response.status===401||response.status===403)throw new AssistantError('upstream-auth','DeepSeek密钥无效或没有访问权限，请检查本机配置。',503);
        if(response.status===402)throw new AssistantError('upstream-balance','DeepSeek账户额度不足，请检查服务商账户。',503);
        if(response.status===429)throw new AssistantError('upstream-rate','DeepSeek当前请求较多，请稍后重试。',429);
        throw new AssistantError('upstream-http','DeepSeek暂时没有完成请求，请稍后重试。',502);
      }
      let data;try{data=await response.json();}catch{if(controller.signal.aborted)throw new AssistantError(timedOut?'timeout':'aborted',timedOut?'DeepSeek这次回复较慢，请稍后重试。':'已停止这次回复。',timedOut?504:499);throw new AssistantError('invalid-response','AI回复格式不完整，请重试。',502);}
      const choice=data?.choices?.[0],message=choice?.message;
      if(!object(message)||choice.finish_reason==='length')throw new AssistantError('invalid-response','这次AI回复没有完成，请缩短问题后重试。',502);
      if(!message.tool_calls?.length){
        if(typeof message.content!=='string'||!message.content.trim()||message.content.length>16000)throw new AssistantError('invalid-response','AI没有给出可用回复，请重试。',502);
        return {reply:message.content.trim(),actions,steps,provider:'DeepSeek',model:config.model||'deepseek-flash'};
      }
      if(!Array.isArray(message.tool_calls)||message.tool_calls.length>3||totalTools+message.tool_calls.length>6)throw new AssistantError('tool-limit','这次问题涉及的步骤较多，请先选一件事处理。',502);
      const calls=message.tool_calls;
      if(calls.some(c=>!object(c)||typeof c.id!=='string'||c.id.length>100||!object(c.function)||typeof c.function.name!=='string'||typeof c.function.arguments!=='string'||c.function.arguments.length>24000))throw new AssistantError('invalid-response','AI的工具请求不完整，请重试。',502);
      messages.push({role:'assistant',content:typeof message.content==='string'?message.content:null,tool_calls:calls});
      for(const call of calls){
        totalTools++;let execution;
        try{execution=executeAssistantTool(call.function.name,JSON.parse(call.function.arguments),conversation.userText);}
        catch(error){execution={result:{error:'not-executed',message:error instanceof AssistantError?error.message:'参数无法核对，请补充信息。'},label:'需要补充信息',summary:'这一步没有执行'};}
        const ok=Boolean(execution.action);
        steps.push({id:String(totalTools),name:call.function.name,label:execution.label,ok,summary:execution.summary});
        if(ok&&!actions.some(a=>JSON.stringify(a)===JSON.stringify(execution.action)))actions.push(execution.action);
        messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(execution.result)});
      }
    }
    throw new AssistantError('tool-limit','AI这次没能完成处理，请换个问法，或直接打开对应工具。',502);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}

function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
function readBody(req){return new Promise((resolve,reject)=>{let size=0;const chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size<=98304)chunks.push(chunk);});req.on('end',()=>{if(size>98304){reject(new AssistantError('too-large','问题内容太长，请分次发送。',413));return;}try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new AssistantError('invalid-input','请求内容无法读取，请重新发送。'));}});req.on('error',()=>reject(new AssistantError('aborted','请求已停止。',499)));});}
export function createAssistantMiddleware({directory,config,fetcher,timeoutMs}={}){
  let busy=0;const starts=[];
  return (req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(!path.startsWith('/api/v1/assistant/'))return false;
    const requestId=randomUUID();
    const fail=error=>{if(res.destroyed||res.writableEnded)return;const e=error instanceof AssistantError?error:new AssistantError('internal','这次请求没有完成，请稍后重试。',500);json(res,e.status,{requestId,error:{code:e.code,message:e.message}});};
    try{
      const hostname=new URL(`http://${req.headers.host||''}`).hostname;
      if(!['127.0.0.1','localhost','[::1]'].includes(hostname))throw new AssistantError('host','AI助手目前只在本机服务中使用。',403);
      const origin=req.headers.origin;
      if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)throw new AssistantError('origin','请在本站页面中使用AI助手。',403);
      const current=config??readAssistantConfig(directory||process.cwd());
      if(path==='/api/v1/assistant/status'&&req.method==='GET'){json(res,200,{requestId,data:{configured:Boolean(current.apiKey),provider:'DeepSeek',model:current.model||'deepseek-flash'}});return true;}
      if(path!=='/api/v1/assistant/chat'){throw new AssistantError('not-found','没有找到这个AI接口。',404);}
      if(req.method!=='POST')throw new AssistantError('method','这个接口需要发送文字问题。',405);
      if(!req.headers['content-type']?.startsWith('application/json'))throw new AssistantError('content-type','请使用文字对话入口。',415);
      const now=Date.now();while(starts.length&&starts[0]<now-60000)starts.shift();
      if(busy>=2||starts.length>=12)throw new AssistantError('rate','当前请求较多，请等这次回复完成。',429);
      starts.push(now);busy++;
      const abort=new AbortController();const disconnected=()=>{if(!res.writableEnded)abort.abort();};res.on('close',disconnected);
      void readBody(req).then(input=>runAssistant(input,{config:current,fetcher,signal:abort.signal,timeoutMs})).then(data=>{if(!res.destroyed)json(res,200,{requestId,data});}).catch(fail).finally(()=>{busy--;res.removeListener('close',disconnected);});
    }catch(error){fail(error);}
    return true;
  };
}
