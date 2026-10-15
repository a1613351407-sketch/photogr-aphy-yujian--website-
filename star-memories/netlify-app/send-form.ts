export const sendForm:typeof fetch = async (input,init) => {
 if(!(init?.body instanceof FormData))return fetch(input,init);
 const original=init.body,files=original.getAll('photos').filter((value):value is File=>value instanceof File);
 if(!files.length)return fetch(input,init);
 const check=async(response:Response)=>{if(!response.ok)throw new Error('照片上传未完成，输入已保留，请重试。')};
 await check(await fetch('/api/upload-session',{method:'POST'}));
 const id=Date.now()+'-'+crypto.randomUUID(),chunkSize=2*1024*1024;
 for(const [index,file] of files.entries())for(let part=0;part<Math.ceil(file.size/chunkSize);part++){
  await check(await fetch(`/api/upload-parts/${id}/${index}/${part}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file.slice(part*chunkSize,(part+1)*chunkSize)}));
 }
 const form=new FormData();
 for(const [key,value] of original.entries())if(key!=='photos')form.append(key,value);
 form.set('netlifyUpload',id);form.set('netlifyPhotos',JSON.stringify(files.map(file=>({name:file.name,type:file.type,size:file.size}))));
 const headers=new Headers(init.headers);headers.set('x-netlify-chunked','1');
 return fetch(input,{...init,headers,body:form});
};
