'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,LoaderCircle,Sparkles} from 'lucide-react';

type Memory={id:string;slot:number;occurredAt:string;content:string;photos:string[]};
type Props={memories:Memory[];loading:boolean;loadError:string;onOpen:(slot:number)=>void;onRetry:()=>void;onCreate:()=>void;scrollPosition:{current:number}};

export default function MemoryTimeline({memories,loading,loadError,onOpen,onRetry,onCreate,scrollPosition}:Props){
  const records=useMemo(()=>[...memories].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.slot-b.slot),[memories]);
  const rail=useRef<HTMLDivElement>(null);
  const [active,setActive]=useState<string|null>(null);
  useEffect(()=>{if(rail.current)rail.current.scrollLeft=scrollPosition.current},[loading,records.length,scrollPosition]);
  const move=(direction:number)=>rail.current?.scrollBy({left:direction*320,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});

  if(loading)return <section className="timeline-status" role="status"><LoaderCircle className="spin" size={22}/><p>正在展开你的时光…</p></section>;
  if(loadError)return <section className="timeline-status" role="alert"><p>{loadError}</p><button className="new-star" onClick={onRetry}>重新加载</button></section>;
  if(!records.length)return <section className="timeline-status"><Sparkles size={36} strokeWidth={1}/><h2>第一段时光，等你点亮。</h2><p>记录一张照片、一句话，它们会在这里连成你的时间线。</p><button className="new-star" onClick={onCreate}>点亮第一颗星 <ArrowRight size={16}/></button></section>;

  return <section className="memory-timeline" aria-label="按时间排列的全部回忆">
    <div className="timeline-intro"><p><span>从 {records[0].occurredAt.slice(0,4)}</span><span className="timeline-intro-line"/><span>到 {records.at(-1)!.occurredAt.slice(0,4)}</span></p><span>所有星域 · {records.length} 段回忆</span></div>
    <div className="timeline-scroll" ref={rail} onScroll={event=>{scrollPosition.current=event.currentTarget.scrollLeft}} tabIndex={0} aria-label="回忆时间线，可左右滚动" onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1)}}}>
      <ol className="timeline-rail">
        {records.map((memory,index)=>{
          const label=memory.occurredAt.slice(0,10).replaceAll('-','.');
          const above=index%2===0;
          return <li key={memory.id} className={'timeline-item '+(above?'photo-above':'photo-below')+(active===memory.id?' is-active':'')}>
            <div className="timeline-photo-area">
              {memory.photos.length>0?<button className="timeline-photos" onClick={()=>onOpen(memory.slot)} aria-label={'打开 '+label+' 的回忆照片'}>
                <img className="timeline-main-photo" src={memory.photos[0]} alt={label+' 的回忆照片 1'} loading="lazy" onError={e=>{e.currentTarget.alt='照片暂时无法加载，打开回忆重试'}}/>
                {memory.photos.length>1&&<span className="timeline-photo-strip">{memory.photos.slice(1).map((url,i)=><img key={url} src={url} alt={label+' 的回忆照片 '+(i+2)} loading="lazy"/>)}</span>}
                <span className="timeline-photo-caption">{String(index+1).padStart(2,'0')} <span>{memory.photos.length} 张照片</span></span>
              </button>:<div className="timeline-without-photo"><span>✧</span><p>有些时光，留在字里。</p></div>}
            </div>
            <div className="timeline-node">
              <button className="timeline-star" aria-label={label+' '+memory.occurredAt.slice(11,16)+'，查看回忆'} aria-describedby={'words-'+memory.id} onClick={event=>{if(event.detail>0&&window.matchMedia('(hover: none)').matches){setActive(active===memory.id?null:memory.id)}else onOpen(memory.slot)}}>
                <span className="star-light" aria-hidden="true"><span className="star-core"/></span>
              </button>
              <time dateTime={memory.occurredAt}>{label}<small>{memory.occurredAt.slice(11,16)}</small></time>
              <div className="timeline-words" id={'words-'+memory.id}>
                <span className="timeline-quote" aria-hidden="true">“</span>
                <p>{memory.content||'有些瞬间，一张照片就足够。'}</p>
                <button onClick={()=>onOpen(memory.slot)}>打开这段回忆 <ArrowRight size={13}/></button>
              </div>
            </div>
          </li>;
        })}
      </ol>
    </div>
    <div className="timeline-navigation"><span>从过去，走向现在</span><div><button onClick={()=>move(-1)} aria-label="向前浏览回忆"><ChevronLeft size={18}/></button><span>左右滑动 · 触碰星芒读留言</span><button onClick={()=>move(1)} aria-label="向后浏览回忆"><ChevronRight size={18}/></button></div></div>
  </section>;
}
