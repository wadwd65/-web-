import {createContext,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {ArrowRight,ArrowUpRight,Check,LogOut,MapPin,Save,UserRound,X} from 'lucide-react';
import RhineMark from './RhineMark.tsx';
export type {Question as SavedQuestion} from './lib/checklist.ts';
import type {Question as SavedQuestion} from './lib/checklist.ts';
type Memory={city:string;stage:string;notes:string;questions:SavedQuestion[]};
type User={id:string;username:string;memory:Memory;updatedAt:number};
const empty=():Memory=>({city:'',stage:'',notes:'',questions:[]});
async function request(action:string,body?:unknown){const response=await fetch('/api/v1/account/'+action,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'账号操作暂未完成。');return data.user as User|null;}
const AccountContext=createContext<{user:User|null;refresh:()=>Promise<void>;update:(user:User|null)=>void}>({user:null,refresh:async()=>{},update:()=>{}});
export function AccountProvider({children}:{children:ReactNode}){const [user,setUser]=useState<User|null>(null);async function refresh(){try{setUser(await request('me'));}catch{setUser(null);}}useEffect(()=>{void refresh();},[]);return <AccountContext.Provider value={{user,refresh,update:setUser}}>{children}</AccountContext.Provider>;}
export const useAccount=()=>useContext(AccountContext);
export function AccountEntry({questions,onRestore,onUse,onVisibility}:{onVisibility:(open:boolean)=>void;questions:SavedQuestion[];onRestore:(items:SavedQuestion[])=>void;onUse:(text:string)=>void}){
 const {user,update}=useAccount(),dialog=useRef<HTMLDialogElement>(null);
 const [open,setOpen]=useState(false),[register,setRegister]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[memory,setMemory]=useState<Memory>(empty),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmClear,setConfirmClear]=useState(false);
 useEffect(()=>{setMemory(user?.memory??empty());setPassword('');setError('');setNotice('');setConfirmClear(false);},[user?.id]);
 useEffect(()=>{onVisibility(open);return()=>onVisibility(false);},[open,onVisibility]);
 useEffect(()=>{if(open&&!dialog.current?.open){dialog.current?.showModal();dialog.current?.querySelector<HTMLInputElement>('input')?.focus();}else if(!open&&dialog.current?.open)dialog.current.close();},[open]);
 async function authenticate(){setBusy(true);setError('');try{const next=await request(register?'register':'login',{username,password});update(next);setPassword('');setNotice(register?'账号已建立，可以选择记住哪些情况。':'欢迎回来，保存的情况已经找回。');}catch(cause){setError(cause instanceof Error?cause.message:'暂时无法登录。');}finally{setBusy(false);}}
 async function save(value:Memory,keepDraft=false){setBusy(true);setError('');setNotice('');try{const next=await request('memory',value);update(next);if(!keepDraft)setMemory(next?.memory??empty());setNotice('已保存到当前服务端的个人空间。');setConfirmClear(false);}catch(cause){setError(cause instanceof Error?cause.message:'保存失败，请重试。');}finally{setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{await request('logout',{});update(null);setOpen(false);}catch{setError('退出未完成，请重试。');}finally{setBusy(false);}}
 const context=[memory.city&&`所在地区：${memory.city}`,memory.stage&&`目前阶段：${memory.stage}`,memory.notes&&`我补充的情况：${memory.notes}`].filter(Boolean).join('\n');
 return <><button className="account-entry" onClick={()=>{setOpen(true);setError('');}} aria-label={user?'打开个人空间':'登录，可选'}><UserRound size={16}/><span>{user?user.username:'登录'}</span>{!user&&<small>可选</small>}</button>
 <dialog ref={dialog} className="account-dialog" aria-labelledby="account-title" onCancel={event=>{event.preventDefault();setOpen(false);}} onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
  <button className="account-close" aria-label="关闭个人空间" onClick={()=>setOpen(false)}><X size={20}/></button>
  <aside className="account-intro"><RhineMark/><span>FIRST STEP / PERSONAL SPACE</span><h2>把眼前的事，<br/>接着办下去。</h2><p>记下自己的情况，<br/>下次回来少说一遍。</p><div className="account-orbit" aria-hidden="true"><i/><i/><i/><b>＋</b></div><small>游客也能使用全部办事工具。</small></aside>
  <section className="account-content">
   {!user?<><header><small>YOUR NEXT STEP</small><h1 id="account-title">{register?'建立个人空间':'欢迎回来'}</h1><p>登录后，由你决定保存哪些情况。</p></header><div className="account-tabs"><button aria-pressed={!register} onClick={()=>{setRegister(false);setError('');}}>登录</button><button aria-pressed={register} onClick={()=>{setRegister(true);setError('');}}>创建账号</button></div>
    <form onSubmit={event=>{event.preventDefault();void authenticate();}}><label>账号<input aria-label="账号" autoComplete="username" value={username} minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" onChange={event=>setUsername(event.target.value)} placeholder="3–24位字母、数字或下划线" required disabled={busy}/></label><label>密码<input aria-label="密码" type="password" autoComplete={register?'new-password':'current-password'} minLength={8} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} placeholder="至少8位，可用一段好记的短语" required disabled={busy}/></label><button className="account-primary" type="submit" disabled={busy}>{busy?'正在处理…':register?'创建并进入':'登录个人空间'}<ArrowRight size={17}/></button></form>
    <button className="account-guest" onClick={()=>setOpen(false)}>先以游客使用<ArrowUpRight size={14}/></button><p className="account-footnote">这是当前服务端的账号。资料保存在该服务端，当前不支持找回密码；请妥善保管。</p>
   </>:<><header><small>PERSONAL SPACE / {user.username}</small><h1 id="account-title">我的情况</h1><p>只记你愿意留下的内容。合同原图与聊天不会自动保存。</p></header>
    <form onSubmit={event=>{event.preventDefault();void save({...memory,questions:user.memory.questions});}}><div className="account-profile-row"><label><MapPin size={12}/>所在地区<input aria-label="所在地区" value={memory.city} maxLength={60} placeholder="例如：广州" onChange={event=>setMemory(v=>({...v,city:event.target.value}))}/></label><label>目前阶段<select aria-label="目前阶段" value={memory.stage} onChange={event=>setMemory(v=>({...v,stage:event.target.value}))}><option value="">暂不填写</option>{['正在找工作','准备签约','刚刚入职','试用期中','已经转正','准备换工作'].map(value=><option key={value}>{value}</option>)}</select></label></div><label>希望记住的情况<textarea aria-label="希望记住的情况" rows={4} maxLength={2000} value={memory.notes} onChange={event=>setMemory(v=>({...v,notes:event.target.value}))} placeholder="例如：今年毕业、第一次租房、正在确认试用期。别填写身份证号、银行卡或密码。"/></label><button className="account-primary" type="submit" disabled={busy}>{busy?'正在保存…':'保存这些情况'}<Save size={15}/></button></form>
    <button className="account-use" disabled={!context||busy} onClick={()=>{onUse(context);setOpen(false);}}>把这些情况带入提问<span>发送前可以修改</span><ArrowUpRight size={14}/></button>
    <div className="account-checklist"><div><strong>询问清单</strong><small>已保存 {user.memory.questions.length} 项 · 本次 {questions.length} 项（含主动加入的原文片段和答复）</small></div><button disabled={busy} onClick={()=>void save({...user.memory,questions},true)}>保存本次清单</button><button disabled={busy||!user.memory.questions.length} onClick={()=>{onRestore(user.memory.questions);setNotice('已恢复到本次询问清单；退出账号后回到原游客清单。');}}>恢复已存清单</button></div>
    <p className="account-footnote">退出后会清除本次账号的填写与对话，已保存的情况和清单仍在。</p><footer className="account-data-actions"><button disabled={busy} onClick={()=>void logout()}><LogOut size={13}/>退出账号</button><button disabled={busy} onClick={()=>{if(confirmClear)void save(empty());else setConfirmClear(true);}}>{confirmClear?'确认清空已保存资料':'清空已保存资料'}</button></footer>
   </>}
   {error&&<p className="account-error" role="alert">{error}</p>}{notice&&<p className="account-notice" role="status"><Check size={13}/>{notice}</p>}
  </section>
 </dialog></>;
}
