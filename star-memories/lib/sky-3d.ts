export type View3D = {yaw:number;pitch:number;roll:number;zoom:number};
export type Point3D = {x:number;y:number;z:number};
export const HOME_VIEW:View3D={yaw:0,pitch:0,roll:0,zoom:1};
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function rotatePoint(p:Point3D,v:View3D):Point3D{
 const cy=Math.cos(v.yaw),sy=Math.sin(v.yaw),cx=Math.cos(v.pitch),sx=Math.sin(v.pitch),cz=Math.cos(v.roll),sz=Math.sin(v.roll);
 const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy,y=p.y*cx-z*sx,z2=p.y*sx+z*cx;
 return {x:x*cz-y*sz,y:x*sz+y*cz,z:z2};
}
export function projectPoint(p:Point3D,v:View3D,width:number,height:number){
 const r=rotatePoint(p,v),f=Math.max(width,height)*1.12,d=f-r.z,scale=f/Math.max(40,d)*v.zoom;
 return {x:width/2+r.x*scale,y:height*.47+r.y*scale,scale,depth:r.z,visible:d>40};
}
export function memoryPoint(position:[number,number],index:number,width:number,height:number):Point3D{
 const f=Math.max(width,height)*1.12,z=Math.sin(index*2.399)*Math.min(width,height)*.19;
 return {x:(position[0]/100-.5)*width*(1-z/f),y:(position[1]/100-.47)*height*(1-z/f),z};
}
export function rotationMatrix(v:View3D){return new Float32Array([{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}].flatMap(p=>{const r=rotatePoint(p,v);return[r.x,r.y,r.z]}))}
export function spaceDust(count=420){let seed=713;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};return Array.from({length:count},()=>{const theta=rand()*Math.PI*2,z=rand()*2-1,r=1.3+rand()*2.8,s=Math.sqrt(1-z*z);return{x:Math.cos(theta)*s*r,y:Math.sin(theta)*s*r,z:z*r,brightness:.3+rand()*.7,size:.45+rand()*.95}})}
// The same state machine serves mouse, pen and multi-touch; it is DOM-independent.
export class SkyGestures{
 view:View3D={...HOME_VIEW};
 pointers=new Map<number,{x:number;y:number;sx:number;sy:number}>();
 moved=false;
 down(id:number,x:number,y:number){if(this.pointers.size===0)this.moved=false;this.pointers.set(id,{x,y,sx:x,sy:y});if(this.pointers.size>1)this.moved=true;}
 move(id:number,x:number,y:number){
  const prior=this.pointers.get(id);if(!prior)return false;
  const before=[...this.pointers.values()];const dx=x-prior.x,dy=y-prior.y;
  if(Math.hypot(x-prior.sx,y-prior.sy)>6)this.moved=true;
  this.pointers.set(id,{...prior,x,y});
  if(!this.moved)return false;
  if(this.pointers.size===1){this.view.yaw+=dx*.005;this.view.pitch=clamp(this.view.pitch-dy*.005,-1.3,1.3)}
  else if(this.pointers.size===2){
   const after=[...this.pointers.values()],distance=(p:typeof before)=>Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),angle=(p:typeof before)=>Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x);
   const oldDistance=distance(before);if(oldDistance>8)this.zoom(distance(after)/oldDistance);
   const difference=angle(after)-angle(before);this.view.roll+=Math.atan2(Math.sin(difference),Math.cos(difference));
   this.view.yaw+=dx*.0016;this.view.pitch=clamp(this.view.pitch-dy*.0016,-1.3,1.3);
  }
  return true;
 }
 up(id:number){this.pointers.delete(id);return this.moved}
 zoom(factor:number){if(Number.isFinite(factor)&&factor>0)this.view.zoom=clamp(this.view.zoom*factor,.6,2.6)}
 reset(){this.view={...HOME_VIEW}}
}
