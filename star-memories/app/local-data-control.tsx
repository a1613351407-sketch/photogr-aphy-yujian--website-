'use client';
import {useEffect,useRef,useState} from 'react';
import {Smartphone,Download,Upload,Share2,LoaderCircle,HardDrive,CloudDownload,ShieldCheck} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {exportLocalBackup,importLocalBackup,importLegacyMemories,localStorageInfo,keepLocalStorage} from '@/lib/local-memories';

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function LocalDataControl({disabled,onChange}:{disabled:boolean;onChange:()=>void}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [installEvent,setInstallEvent]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(false),[offlineReady,setOfflineReady]=useState(false);
  const [info,setInfo]=useState<Awaited<ReturnType<typeof localStorageInfo>>|null>(null),[online,setOnline]=useState(true);
  const backup=useRef<HTMLInputElement>(null);
  const refresh=()=>void localStorageInfo().then(setInfo).catch(e=>setError((e as Error).message));
  useEffect(()=>{
    const install=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallEvent)};
    const installDone=()=>{setInstalled(true);setInstallEvent(null)};
    const network=()=>setOnline(navigator.onLine);
    setInstalled(window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));network();
    window.addEventListener('beforeinstallprompt',install);window.addEventListener('appinstalled',installDone);window.addEventListener('online',network);window.addEventListener('offline',network);
    const received=(event:MessageEvent)=>{if(event.data?.type==='OFFLINE_READY')setOfflineReady(true)};
    const checkOffline=()=>void navigator.serviceWorker.ready.then(registration=>registration.active?.postMessage({type:'CHECK_OFFLINE_READY'})).catch(()=>{});
    if('serviceWorker' in navigator){
      navigator.serviceWorker.addEventListener('message',received);
      navigator.serviceWorker.addEventListener('controllerchange',checkOffline);
      // An existing registration stays usable even if an update check cannot
      // reach the network. This matters when the app is opened offline.
      void navigator.serviceWorker.getRegistration('/').then(registration=>{if(registration?.active)checkOffline()}).catch(()=>{});
      void navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'}).then(checkOffline).catch(()=>{});
    }
    return()=>{window.removeEventListener('beforeinstallprompt',install);window.removeEventListener('appinstalled',installDone);window.removeEventListener('online',network);window.removeEventListener('offline',network);navigator.serviceWorker?.removeEventListener('message',received);navigator.serviceWorker?.removeEventListener('controllerchange',checkOffline)};
  },[]);
  useEffect(()=>{if(open)refresh()},[open]);
  const run=async(label:string,action:()=>Promise<void>)=>{setBusy(label);setError('');setMessage('');try{await action();refresh()}catch(e){setError((e as Error).message)}finally{setBusy('')}};
  const exportBackup=()=>void run('正在导出备份…',async()=>{
    const file=await exportLocalBackup(),url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download='星迹备份-'+new Date().toLocaleDateString('sv-SE')+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);setMessage('备份已交给浏览器下载。请确认文件已保存到“文件”或“下载”中。');
  });
  const importBackup=(file:File)=>void run('正在导入回忆…',async()=>{const result=await importLocalBackup(file);onChange();setMessage(`已导入 ${result.imported} 段回忆${result.skipped?`，跳过 ${result.skipped} 段已有回忆`:''}。原有回忆没有被覆盖。`)});
  const legacy=()=>void run('正在下载旧版回忆…',async()=>{const result=await importLegacyMemories();onChange();setMessage(result.imported?`已把 ${result.imported} 段旧版回忆和照片保存到本机。`:result.skipped?'这些旧版回忆已经在本机，未重复导入。':'当前浏览器没有可导入的旧版回忆。请从以前记录时使用的浏览器和网址打开。')});
  return <>
    <button className="account-trigger local-data-trigger" disabled={disabled} onClick={()=>{setOpen(true);setError('');setMessage('')}}><Smartphone size={16}/><span>安装与备份</span></button>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value)}}><DialogContent className="account-dialog local-data-dialog"><DialogHeader><DialogTitle>把星迹，留在手机里</DialogTitle><DialogDescription>无需注册。新版照片、时间和文字直接保存在这台设备，不会上传到服务器。</DialogDescription></DialogHeader>
      <div className="local-state"><HardDrive size={18}/><div><strong>{info?`${info.count} 段本地回忆`:'正在读取本地存储…'}</strong><span>{offlineReady?'离线资源已准备好':'正在准备离线资源'} · {online?'当前在线':'当前离线'}</span></div></div>
      <section className="local-section"><h3><Smartphone size={16}/>添加到手机主屏幕</h3>{installed?<p>已在 App 模式中打开。</p>:<>{installEvent&&<button className="account-submit" onClick={()=>void run('正在打开安装窗口…',async()=>{await installEvent.prompt();const choice=await installEvent.userChoice;if(choice.outcome==='accepted')setMessage('请按系统提示完成安装。');setInstallEvent(null)})}><Download size={16}/>安装星迹 App</button>}<p><b>iPhone：</b>在 Safari 打开本站，点分享 <Share2 size={12}/> →「添加到主屏幕」，如有「作为网页 App 打开」请保持开启。<br/><b>安卓：</b>在 Chrome 打开本站，菜单 →「安装应用」或「添加到主屏幕」。</p></>}<p className="local-small">首次联网打开并准备好离线资源后，可断网记录与查看回忆。</p></section>
      <section className="local-section"><h3><ShieldCheck size={16}/>保存一份可带走的备份</h3><div className="local-backup-actions"><button onClick={exportBackup} disabled={Boolean(busy)||!info?.count}><Download size={16}/>导出全部回忆</button><button onClick={()=>backup.current?.click()} disabled={Boolean(busy)}><Upload size={16}/>导入备份</button></div><input ref={backup} className="sr-only" type="file" accept="application/json,.json" aria-label="选择星迹备份文件" disabled={Boolean(busy)} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)importBackup(file)}}/><p className="local-small">备份包含照片和文字。导入会合并回忆，不覆盖已有记录。换手机时可用备份转移。</p><button className="text-button local-persist" disabled={Boolean(busy)||Boolean(info?.persistent)} onClick={()=>void run('正在请求保留本地数据…',async()=>{const kept=await keepLocalStorage();setMessage(kept?'浏览器已允许长期保留本地数据。仍建议定期导出备份。':'浏览器未允许长期保留，请定期导出备份。')})}>{info?.persistent?'已允许长期保留本地数据':'请求长期保留本地数据'}</button></section>
      <section className="local-section"><button className="text-button" onClick={legacy} disabled={Boolean(busy)||!online}><CloudDownload size={15}/>找回当前浏览器的旧版回忆</button><p className="local-small">仅点击后联网下载旧记录，原服务器记录保留。不会上传新回忆。</p></section>
      <p className="local-storage-note">请固定使用同一个网址和浏览器。不同网址、手机与浏览器的本地数据各自独立；清除网站数据或设备丢失会失去未备份的回忆。不要使用无痕模式保存。</p>
      {busy&&<p className="processing" role="status"><LoaderCircle className="spin" size={14}/>{busy}</p>}{message&&<p className="local-message" role="status">{message}</p>}{error&&<p className="account-error" role="alert">{error}</p>}
    </DialogContent></Dialog>
  </>;
}
