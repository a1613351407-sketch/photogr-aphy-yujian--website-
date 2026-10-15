'use client';
import {useState} from 'react';
import {LogIn,LogOut,UserRound,LoaderCircle} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export type AccountView={id:string;username:string}|null;
type Props={account:AccountView;disabled:boolean;hasBrowserMemories:boolean;onChange:(account:AccountView)=>void};

export default function AccountControl({account,disabled,hasBrowserMemories,onChange}:Props){
 const [open,setOpen]=useState(false),[mode,setMode]=useState<'login'|'register'>('login');
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const show=(next:'login'|'register')=>{setMode(next);setError('');setPassword('');setConfirmPassword('');setOpen(true)};
 const submit=async(event:React.FormEvent)=>{event.preventDefault();if(busy)return;if(mode==='register'&&password!==confirmPassword){setError('两次输入的密码不一致。');return}setBusy(true);setError('');try{
  const response=await fetch('/api/account/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,...(mode==='register'?{confirmPassword}:{})})});
  const data=await response.json() as {account?:AccountView;error?:string};
  if(!response.ok)throw new Error(data.error||'操作失败，请重试。');
  setOpen(false);setPassword('');setConfirmPassword('');onChange(data.account||null);
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const signOut=async()=>{if(busy)return;setBusy(true);setError('');try{
  const response=await fetch('/api/account',{method:'DELETE'});const data=await response.json() as {error?:string};
  if(!response.ok)throw new Error(data.error||'退出失败，请重试。');setOpen(false);onChange(null);
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 return <>
  {account?<button className="account-trigger" disabled={disabled} onClick={()=>setOpen(true)} aria-label={'账号：'+account.username}><UserRound size={16}/><span>{account.username}</span></button>:<button className="account-trigger" disabled={disabled} onClick={()=>show('login')}><LogIn size={16}/><span>登录 / 注册</span></button>}
  <Dialog open={open} onOpenChange={value=>{if(!busy){setOpen(value);if(!value){setPassword('');setConfirmPassword('');setError('')}}}}><DialogContent className="account-dialog"><DialogHeader><DialogTitle>{account?'我的星迹账号':mode==='login'?'登录星迹':'注册星迹'}</DialogTitle><DialogDescription>{account?'同一账号的回忆可在两处星迹网址查看。':mode==='register'?'创建账号后，这个浏览器的回忆会转入账号，并在两处星迹同步。':'登录后，查看同一账号的回忆星图。'}</DialogDescription></DialogHeader>
   {account?<div className="account-panel"><p>当前登录：<strong>{account.username}</strong></p><button type="button" className="account-submit" disabled={busy} onClick={()=>void signOut()}>{busy?<LoaderCircle className="spin" size={16}/>:<LogOut size={16}/>}退出登录</button></div>:<><div className="account-tabs" role="tablist" aria-label="账号操作"><button type="button" role="tab" aria-selected={mode==='login'} onClick={()=>{setMode('login');setError('');setConfirmPassword('')}}>登录</button><button type="button" role="tab" aria-selected={mode==='register'} onClick={()=>{setMode('register');setError('');setConfirmPassword('')}}>注册</button></div><form className="account-form" onSubmit={event=>void submit(event)}><label htmlFor="star-username">用户名</label><input id="star-username" name="username" autoComplete="username" required minLength={3} maxLength={24} value={username} onChange={e=>setUsername(e.target.value)} placeholder="3–24 个字符" disabled={busy}/><label htmlFor="star-password">密码</label><input id="star-password" name="password" type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='register'?6:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='register'?'至少 6 个字符':'输入密码'} disabled={busy}/>{mode==='register'&&<><label htmlFor="star-confirm-password">确认密码</label><input id="star-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="再次输入密码" disabled={busy}/><p className="account-tip">请妥善保存用户名和密码。当前未提供密码找回。</p></>}{mode==='login'&&hasBrowserMemories&&<p className="account-tip">登录时会尝试把当前浏览器的回忆并入账号；如同步失败，原记录仍会保留。</p>}{error&&<p className="account-error" role="alert">{error}</p>}<button className="account-submit" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:<LogIn size={16}/>} {mode==='login'?'登录并打开星图':'注册并同步星图'}</button></form></>}
   {account&&error&&<p className="account-error" role="alert">{error}</p>}
  </DialogContent></Dialog>
 </>
}
