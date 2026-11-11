import {useEffect,useState} from 'react';
import {ArrowRight,ClipboardPaste,MessageCircle} from 'lucide-react';
import {OFFER_BENEFIT_LABELS} from './lib/eight-tools.ts';
import type {OfferInput,OfferBenefitStatus} from './lib/eight-tools.ts';
import {applyOfferText,OFFER_TEXT_LABELS,parseOfferText} from './lib/offer-text.ts';
import type {OfferTextField,OfferTextItem} from './lib/offer-text.ts';

function valueLabel(item:OfferTextItem){
 if(item.key==='socialInsurance'||item.key==='housingFund')return OFFER_BENEFIT_LABELS[item.value as OfferBenefitStatus];
 if(item.key==='employer')return item.value==='direct'?'与用人单位直签':item.value==='dispatch'?'劳务派遣':'未确认';
 if(['monthly','probation','rent','commute'].includes(item.key))return `¥ ${Number(item.value).toLocaleString('zh-CN',{minimumFractionDigits:2})}`;
 return item.key==='months'?`${item.value} 薪`:item.key==='hours'?`${item.value} 小时 / 周`:item.value;
}
export default function OfferTextEntry({offers,onApply,onAsk}:{offers:OfferInput[];onApply:(id:string,value:OfferInput)=>void;onAsk?:(text:string)=>void}){
 const [text,setText]=useState(''),[target,setTarget]=useState(offers[0].id),[preview,setPreview]=useState<ReturnType<typeof parseOfferText>|null>(null),[chosen,setChosen]=useState<OfferTextField[]>([]),[confirmed,setConfirmed]=useState(false),[message,setMessage]=useState('');
 const current=offers.find(item=>item.id===target)??offers[0],name=current.name||`机会 ${offers.indexOf(current)+1}`;
 useEffect(()=>{if(!offers.some(item=>item.id===target)){setTarget(offers[0].id);setPreview(null);}setConfirmed(false);},[offers,target]);
 function changeText(value:string){setText(value);setPreview(null);setChosen([]);setConfirmed(false);setMessage('');}
 async function paste(){try{const value=await navigator.clipboard.readText();if(!value.trim()){setMessage('剪贴板里没有文字，可以直接在下面输入。');return;}changeText(value.slice(0,6000));if(value.length>6000)setMessage('已粘贴前6000字，请确认是同一份工作的说明。');}catch{setMessage('浏览器没有允许读取剪贴板。点下面的输入框，按 Ctrl + V 粘贴即可。');}}
 function read(){try{const result=parseOfferText(text);setPreview(result);setConfirmed(false);setMessage('');setChosen(result.items.filter(item=>item.value!=='unknown'&&(!current[item.key]||current[item.key]==='unknown'||current[item.key]===item.value)).map(item=>item.key));}catch(error){setPreview(null);setMessage((error as Error).message);}}
 function apply(){if(!preview||!confirmed||!chosen.length)return;onApply(current.id,applyOfferText(current,preview.items.filter(item=>chosen.includes(item.key))));setPreview(null);setChosen([]);setConfirmed(false);setMessage(`已填入${name}，仍可在下方修改。其他信息保留原样。`);}
 return <details className="offer-text-entry"><summary><ClipboardPaste size={18}/><span><strong>不想逐项填？粘贴一段话</strong><small>招聘说明、HR的话，或自己一次说清楚</small></span><ArrowRight size={17}/></summary><div>
  <div className="offer-text-target"><label>填到哪一份？<select aria-label="整段输入的目标机会" value={current.id} onChange={event=>{setTarget(event.target.value);setPreview(null);setChosen([]);setConfirmed(false);setMessage('');}}>{offers.map((offer,index)=><option value={offer.id} key={offer.id}>{offer.name||`机会 ${index+1}`}</option>)}</select></label><button type="button" onClick={paste}><ClipboardPaste size={15}/>从剪贴板粘贴</button></div>
  <label className="offer-text-label" htmlFor="offer-description">一次粘贴一份工作的条件<textarea id="offer-description" value={text} maxLength={6000} rows={4} onChange={event=>changeText(event.target.value)} placeholder="例如：税前月薪8000，13薪，五险入职就交，公积金转正后才交，有餐补、双休。也可以直接按 Ctrl + V 粘贴。"/></label>
  <div className="offer-text-actions"><button type="button" className="button secondary" onClick={()=>changeText('税前月薪8000元，固定13薪，试用期工资7000元，五险入职就缴纳，公积金转正后才缴，餐补每月300元，双休。')}>试一段示例</button><button type="button" className="button primary" disabled={!text.trim()} onClick={read}>整理这段话<ArrowRight size={16}/></button>{onAsk&&<button type="button" disabled={!text.trim()} onClick={()=>onAsk(`请帮我理解这份工作的待遇，先按原文整理已知和待确认的条件，不猜月薪口径、缴费基数或比例：\n${text}`)}><MessageCircle size={15}/>发给 AI 继续聊</button>}</div>
  <p className="offer-text-hint">先在本机整理，核对后才填入。只有点击“发给 AI”才会发送这段文字。</p>
  {message&&<p className="offer-text-message" role="status">{message}</p>}
  {preview&&<section className="offer-text-review" aria-label="整段输入核对"><h2>先核对，再填入{name}</h2>{preview.warnings.map(warning=><p className="offer-text-warning" key={warning}>{warning}</p>)}{!!preview.items.length&&<><ul>{preview.items.map(item=>{const old=current[item.key],replacing=!!old&&old!=='unknown'&&old!==item.value;return <li key={item.key}><label><input type="checkbox" checked={chosen.includes(item.key)} onChange={event=>{setChosen(previous=>event.target.checked?[...previous,item.key]:previous.filter(key=>key!==item.key));setConfirmed(false);}}/><span><strong>{OFFER_TEXT_LABELS[item.key]}</strong><span>{valueLabel(item)}</span>{replacing&&<small>已有内容，默认保留；勾选此项才会替换</small>}</span></label><details><summary>对应原文</summary><p>{item.quote}</p></details></li>;})}</ul><label className="offer-text-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>我已核对勾选的内容{chosen.includes('monthly')?'，月薪为正常税前金额':''}{chosen.includes('months')?'，发薪月数为书面明确的固定部分':''}</label><button type="button" className="button primary" disabled={!confirmed||!chosen.length} onClick={apply}>确认填入{name}<ArrowRight size={16}/></button></>}</section>}
 </div></details>;
}
