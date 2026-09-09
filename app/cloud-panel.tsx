import {useEffect,useRef,useState} from 'react';
import {createClient, type Session} from '@supabase/supabase-js';
import {cloudUrl,cloudPublishableKey} from '../lib/cloud-config';
import {validateData,initialData,type Data} from '../lib/budget';
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
 const active=useRef<Session|null>(null),running=useRef(false);
 useEffect(()=>{void client.auth.getSession().then(({data})=>{active.current=data.session;setSession(data.session);});const {data}=client.auth.onAuthStateChange((_e,s)=>{active.current=s;setSession(s);});return()=>data.subscription.unsubscribe();},[]);
 async function sync(){
  if(running.current||!active.current)return;
  running.current=true;
  try{
   const raw=localStorage.getItem(LINK);if(!raw)return;
   const link:Link=JSON.parse(raw);if(link.user!==active.current.user.id)return;
   if(!navigator.onLine){setStatus('等待联网 · 记录已保存在本机');return;}
   setStatus('正在同步…');
   const remoteRaw=await rpc('lr_read');if(!remoteRaw)throw Error('云端账本不存在，请重新连接');
   const remote=snapshot(remoteRaw);if(remote.id!==link.snapshot.id)throw Error('账本身份不匹配，已停止同步');
   const captured=local(),m=mergeLedger(link.snapshot.data,captured,remote.data);
   if(!m.ok)throw Error('存在同时修改：'+m.conflicts.map(x=>x==='settings'?'预算设置':'同一笔流水').join('、')+'。已暂停同步并保留本机记录，请先导出备份。');
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
   if(!merged.ok)throw Error('同步过程中同一笔记录发生变化，已保留本机内容并暂停本次同步');
   if(same(latest)!==same(merged.data))publish(merged.data);
   localStorage.setItem(LINK,JSON.stringify({user:link.user,snapshot:next}));
   setInvite(next.invite);setLinked(true);setStatus(same(merged.data)===same(next.data)?'已同步 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'本机有新记录 · 等待同步');
  }catch(e){setStatus(e instanceof Error?e.message:'同步失败，记录仍保存在本机');}
  finally{running.current=false;}
 }
 useEffect(()=>{
  let cancelled=false;
  const run=()=>{if(cancelled)return;if(navigator.locks)void navigator.locks.request('liangren-cloud-sync',{ifAvailable:true},lock=>{if(lock)return sync();});else void sync();};
  let valid=false;try{const l=JSON.parse(localStorage.getItem(LINK)||'null') as Link|null;valid=!!session&&l?.user===session.user.id;setInvite(valid?l!.snapshot.invite:null);}catch{}
  setLinked(valid);setStatus(session?(valid?'等待同步':'已登录 · 请连接账本'):'本机保存 · 尚未登录云端');
  run();const timer=setInterval(run,15000);window.addEventListener('ledger-local-update',run);window.addEventListener('online',run);
  return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('ledger-local-update',run);window.removeEventListener('online',run);};
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
 return <><section className="cloud-strip"><div><b>夫妻共享账本</b><p role="status">{status}</p></div><button className="button outline" onClick={()=>setOpen(true)}>{session?'账户 / 同步':'登录云端'}</button></section>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="ledger-dialog"><DialogHeader><DialogTitle>夫妻共享与自动保存</DialogTitle><DialogDescription>云端同步与本机保存并用。未显示“已同步”时，请保留本机数据。</DialogDescription></DialogHeader>
 <p role="status" className="cloud-status">{status}</p>
 {!session?<form onSubmit={e=>{e.preventDefault();void auth(false);}} className="cloud-form"><label>邮箱<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>密码<input type="password" minLength={8} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary" disabled={busy}>登录</button><button type="button" className="button outline" disabled={busy||!email||password.length<8} onClick={()=>void auth(true)}>注册新账号</button><p>可使用管理员在 Supabase Authentication → Users 中创建的账号直接登录。自行注册需要邮件服务支持。</p></form>:<div className="cloud-form"><p>当前账号：{session.user.email}</p>{!linked?<><p>首次连接前会保留一份本机恢复副本。下方“连接已有”和“加入”会将界面切换为云端账本，不会自动合并两本独立账本。</p><button className="button primary" disabled={busy} onClick={()=>void attach('create')}>把本机账本保存为新的云端账本</button><button className="button outline" disabled={busy} onClick={()=>void attach('read')}>连接这个账号已有的云端账本</button><label>伴侣的邀请码<input value={code} onChange={e=>setCode(e.target.value)} autoComplete="off"/></label><button className="button outline" disabled={busy||!code} onClick={()=>void attach('join')}>加入伴侣账本</button></>:<><p>已开启自动同步，每 15 秒检查另一部手机的修改。</p>{invite&&<label>邀请码（仅给你的伴侣）<input readOnly value={invite} onFocus={e=>e.target.select()}/></label>}<button className="button outline" disabled={busy} onClick={()=>void sync()}>立即同步</button></>}
 <button className="button outline" disabled={busy||running.current} onClick={()=>void action(async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;setStatus('已退出，本机记录仍保留');})}>退出登录（保留本机记录）</button></div>}
 </DialogContent></Dialog></>;
}


