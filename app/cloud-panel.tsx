import {useEffect,useRef,useState} from 'react';
import {createClient, type Session} from '@supabase/supabase-js';
import {cloudUrl,cloudPublishableKey} from '../lib/cloud-config';
import {validateData,initialData,categories,type Data} from '../lib/budget';
import {saveRecovery} from '../lib/recovery';
import {mergeLedger} from '../lib/sync-merge';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ledger-dialog';

const client=createClient(cloudUrl,cloudPublishableKey);
const KEY='liangren-ledger-v1',LINK='liangren-cloud-link-v1';
type Snapshot={id:string;data:Data;revision:number;invite:string|null};
type Link={user:string;snapshot:Snapshot};
const local=()=>{const raw=localStorage.getItem(KEY);return raw?validateData(JSON.parse(raw)):initialData();};
function publish(d:Data){const next=validateData({...d,savedAt:new Date().toISOString()});localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new Event('ledger-cloud-update'));}
async function rpc(name:string,args?:Record<string,unknown>){const {data,error}=await client.rpc(name,args);if(error)throw Error(error.message);return data;}
function snapshot(raw:Snapshot):Snapshot{return {...raw,data:validateData(raw.data)};}
export default function CloudPanel(){
 const [session,setSession]=useState<Session|null>(null),[open,setOpen]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState('');
 const [status,setStatus]=useState('本机保存 · 尚未登录云端'),[busy,setBusy]=useState(false),[linked,setLinked]=useState(false),[invite,setInvite]=useState<string|null>(null);
 type Conflict={base:Data;local:Data;remote:Snapshot;keys:string[];user:string};
 const [conflict,setConflict]=useState<Conflict|null>(null),[choices,setChoices]=useState<Record<string,'local'|'remote'>>({});const conflictRef=useRef<Conflict|null>(null);
 function showConflict(c:Conflict){conflictRef.current=c;setConflict(c);setChoices({});setStatus('有同时修改的内容，请打开账户 / 同步，逐项选择保留哪一版。');}
 const active=useRef<Session|null>(null),running=useRef(false);
 useEffect(()=>{void client.auth.getSession().then(({data})=>{active.current=data.session;setSession(data.session);});const {data}=client.auth.onAuthStateChange((_e,s)=>{active.current=s;setSession(s);});return()=>data.subscription.unsubscribe();},[]);
 async function sync(){
  if(running.current||!active.current||conflictRef.current)return;
  running.current=true;
  try{
   const raw=localStorage.getItem(LINK);if(!raw)return;
   const link:Link=JSON.parse(raw);if(link.user!==active.current.user.id)return;
   if(!navigator.onLine){setStatus('等待联网 · 记录已保存在本机');return;}
   setStatus('正在同步…');
   const remoteRaw=await rpc('lr_read');if(!remoteRaw)throw Error('云端账本不存在，请重新连接');
   const remote=snapshot(remoteRaw);if(remote.id!==link.snapshot.id)throw Error('账本身份不匹配，已停止同步');
   const captured=local(),m=mergeLedger(link.snapshot.data,captured,remote.data);
   if(!m.ok){showConflict({base:link.snapshot.data,local:captured,remote,keys:m.conflicts,user:link.user});return;}
   let next=remote;
   const same=(d:Data)=>JSON.stringify({...d,savedAt:''});
   if(same(m.data)!==same(remote.data)){
    const result=await rpc('lr_save',{expected_revision:remote.revision,payload:m.data});
    if(result.conflict){setStatus('另一台手机刚保存，稍后自动重试');return;}
    next=snapshot(result.snapshot);
   }
   if(active.current?.user.id!==link.user)return;
   // A record may have been entered while the request was in flight.
   const latest=local(),merged=mergeLedger(captured,latest,next.data);
   if(!merged.ok){showConflict({base:captured,local:latest,remote:next,keys:merged.conflicts,user:link.user});return;}
   if(same(latest)!==same(merged.data))publish(merged.data);
   localStorage.setItem(LINK,JSON.stringify({user:link.user,snapshot:next}));
   setInvite(next.invite);setLinked(true);setStatus(same(merged.data)===same(next.data)?'已同步 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'本机有新记录 · 等待同步');
  }catch(e){setStatus(e instanceof Error?e.message:'同步失败，记录仍保存在本机');}
  finally{running.current=false;}
 }
 useEffect(()=>{
  let cancelled=false;conflictRef.current=null;setConflict(null);
  const run=()=>{if(cancelled)return;if(navigator.locks)void navigator.locks.request('liangren-cloud-sync',{ifAvailable:true},lock=>{if(lock)return sync();});else void sync();};
  let valid=false;try{const l=JSON.parse(localStorage.getItem(LINK)||'null') as Link|null;valid=!!session&&l?.user===session.user.id;setInvite(valid?l!.snapshot.invite:null);}catch{}
  setLinked(valid);setStatus(session?(valid?'等待同步':'已登录 · 请连接账本'):'本机保存 · 尚未登录云端');
  run();const timer=setInterval(run,15000);const dirty=()=>{if(!active.current){setStatus('本机已保存 · 尚未登录云端');return;}if(conflictRef.current){setStatus('本机有新修改，待处理同步冲突');return;}setStatus('本机有修改 · 等待同步');run();};window.addEventListener('ledger-local-update',dirty);window.addEventListener('online',run);
  return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('ledger-local-update',dirty);window.removeEventListener('online',run);};
 },[session?.user.id]);
 async function action(fn:()=>Promise<void>){setBusy(true);try{await fn();}catch(e){setStatus(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}}
 async function auth(signup:boolean){await action(async()=>{const credentials={email:email.trim(),password};const {data,error}=signup?await client.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+import.meta.env.BASE_URL}}):await client.auth.signInWithPassword(credentials);if(error)throw Error(error.message);setPassword('');setStatus(data.session?'登录成功，请连接账本':'请查收验证邮件，验证邮箱后回来登录');});}
 async function attach(mode:'create'|'read'|'join'){
  await action(async()=>{
   if(!session)throw Error('请先登录');
   const previous=localStorage.getItem(KEY);
   // Retain a local recovery copy before any attachment or replacement.
   if(previous)localStorage.setItem('liangren-before-cloud-'+Date.now(),previous);
   const raw=await rpc(mode==='create'?'lr_create':mode==='join'?'lr_join':'lr_read',mode==='create'?{payload:local()}:mode==='join'?{code:code.trim()}:undefined);
   if(!raw)throw Error('这个账号还没有云端账本，请创建或输入伴侣的邀请码');
   const next=snapshot(raw);if(localStorage.getItem(KEY)!==previous)throw Error('连接期间本机记录有更新，已保留本机内容。请再次连接前核对备份。');publish(next.data);localStorage.setItem(LINK,JSON.stringify({user:session.user.id,snapshot:next}));setLinked(true);setInvite(next.invite);setStatus('已连接 · 云端保存成功');
  });
 }
 async function resolveConflict(){
  const c=conflictRef.current;if(!c||running.current)return;
  await action(async()=>{running.current=true;try{
   if(active.current?.user.id!==c.user)throw Error('账号已变化，请重新登录后检查');
   const raw=localStorage.getItem(LINK),link:Link|null=raw?JSON.parse(raw):null;
   if(link?.snapshot.id!==c.remote.id||link.user!==c.user)throw Error('连接的账本已变化，请重新检查');
   const current=local();if(JSON.stringify(current)!==JSON.stringify(c.local))throw Error('本机有新修改，请点击重新检查冲突再选择');
   const merged=mergeLedger(c.base,c.local,c.remote.data,choices);if(!merged.ok)throw Error('请为每项冲突选择保留版本');
   const chosen=validateData(merged.data);saveRecovery(localStorage,current,'处理同步冲突前');
   const result=await rpc('lr_save',{expected_revision:c.remote.revision,payload:chosen});
   if(result.conflict)throw Error('云端又有新修改，请重新检查冲突；本次未覆盖');
   const next=snapshot(result.snapshot);
   if(active.current?.user.id!==c.user)return;
   const latest=local(),combined=mergeLedger(current,latest,next.data);
   if(!combined.ok){showConflict({base:current,local:latest,remote:next,keys:combined.conflicts,user:c.user});return;}
   publish(validateData(combined.data));localStorage.setItem(LINK,JSON.stringify({user:c.user,snapshot:next}));conflictRef.current=null;setConflict(null);setStatus(JSON.stringify({...combined.data,savedAt:''})===JSON.stringify({...next.data,savedAt:''})?'冲突已处理，选择已保存到云端':'冲突已处理，本机有新修改等待同步');
  }finally{running.current=false;}});
 }
 function describe(d:Data,key:string){
  const money=(n:number)=>'¥'+(n/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
  if(key==='settings')return <><p>开始：{d.startDate??d.start}；期初总金库：{d.openingTreasury==null?'未填':money(d.openingTreasury)}；期初目标存款：{d.openingSavings==null?'未填':money(d.openingSavings)}</p><p>年度目标：{Object.entries(d.goals).map(([y,n])=>y+'年 '+money(n)).join('；')||'采用默认目标'}</p>{d.plans.map(p=><details key={p.effective}><summary>{p.effective}起的预算 · 年收入{money(p.income)}</summary>{p.annual.map((n,i)=><p key={i}>{categories[i].name}：{money(n)}/年</p>)}</details>)}</>;
  const e=d.entries.find(e=>'entry:'+e.id===key);return e?<p>{e.date} {e.time??''} · {{expense:'消费',refund:'退款',income:'收入',saving:'转入目标',withdrawal:'取回目标'}[e.kind]} · {categories.find(c=>c.id===e.category)?.name} · {money(e.amount)}<br/>{e.who} · {e.note||'无备注'}</p>:<p>这笔记录已删除</p>;
 }
 return <><section className="cloud-strip"><div><b>夫妻共享账本</b><p role="status">{status}</p></div><button className="button outline" onClick={()=>setOpen(true)}>{session?'账户 / 同步':'登录云端'}</button></section>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="ledger-dialog"><DialogHeader><DialogTitle>夫妻共享与自动保存</DialogTitle><DialogDescription>云端同步与本机保存并用。未显示“已同步”时，请保留本机数据。</DialogDescription></DialogHeader>
 <p role="status" className="cloud-status">{status}</p>
 {conflict&&session?.user.id===conflict.user&&<section className="conflict-panel"><h3>选择冲突内容</h3><p>只替换你选择的冲突项，其余记录合并保留。保存会同步给伴侣，本机操作前副本会保留。</p>{conflict.keys.map(key=><fieldset key={key}><legend>{key==='settings'?'预算与期初设置':'同一笔流水'}</legend>{(['local','remote'] as const).map(side=><label className="conflict-choice" key={side}><input type="radio" name={key} checked={choices[key]===side} onChange={()=>setChoices({...choices,[key]:side})}/><b>保留{side==='local'?'本机':'云端'}</b>{describe(side==='local'?conflict.local:conflict.remote.data,key)}</label>)}</fieldset>)}<button className="button primary" disabled={busy||conflict.keys.some(k=>!choices[k])} onClick={()=>void resolveConflict()}>确认选择并同步</button><button className="button outline" disabled={busy} onClick={()=>{conflictRef.current=null;setConflict(null);void sync();}}>重新检查冲突</button></section>}

 {!session?<form onSubmit={e=>{e.preventDefault();void auth(false);}} className="cloud-form"><label>邮箱<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>密码<input type="password" minLength={8} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary" disabled={busy}>登录</button><button type="button" className="button outline" disabled={busy||!email||password.length<8} onClick={()=>void auth(true)}>注册新账号</button><p>可使用管理员在 Supabase Authentication → Users 中创建的账号直接登录。自行注册需要邮件服务支持。</p></form>:<div className="cloud-form"><p>当前账号：{session.user.email}</p>{!linked?<><p>首次连接前会保留一份本机恢复副本。下方“连接已有”和“加入”会将界面切换为云端账本，不会自动合并两本独立账本。</p><button className="button primary" disabled={busy} onClick={()=>void attach('create')}>把本机账本保存为新的云端账本</button><button className="button outline" disabled={busy} onClick={()=>void attach('read')}>连接这个账号已有的云端账本</button><label>伴侣的邀请码<input value={code} onChange={e=>setCode(e.target.value)} autoComplete="off"/></label><button className="button outline" disabled={busy||!code} onClick={()=>void attach('join')}>加入伴侣账本</button></>:<><p>已开启自动同步，每 15 秒检查另一部手机的修改。</p>{invite&&<label>邀请码（仅给你的伴侣）<input readOnly value={invite} onFocus={e=>e.target.select()}/></label>}<button className="button outline" disabled={busy} onClick={()=>void sync()}>立即同步</button></>}
 <button className="button outline" disabled={busy||running.current} onClick={()=>void action(async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;setStatus('已退出，本机记录仍保留');})}>退出登录（保留本机记录）</button></div>}
 </DialogContent></Dialog></>;
}


