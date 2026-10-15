export type MailAttachment={filename:string;content:string;content_type:string};
export type EmailPayload={from:string;to:string[];subject:string;text:string;attachments:MailAttachment[]};
export class MailError extends Error {
 constructor(message:string,public retryable=false,public uncertain=false){super(message);}
}
export async function sendMail(apiKey:string,idempotencyKey:string,payload:EmailPayload,transport:typeof fetch=fetch):Promise<string>{
 let response:Response;
 try{response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});}catch{throw new MailError('网络超时，发送结果待确认，可在 24 小时内安全重试。',true,true);}
 if(!response.ok){
  if(response.status===401||response.status===403)throw new MailError('邮件发送授权或发件地址未通过验证。');
  if(response.status===409){const data=await response.json().catch(()=>null) as {name?:string}|null;if(data?.name==='concurrent_idempotent_requests')throw new MailError('上一次发送仍在处理，结果待确认。',true,true);throw new MailError('邮件内容与此前的重试不一致，请核对发送记录。',false,true);}
  if(response.status===429)throw new MailError('邮件服务暂时限流，请稍后重试。',true);
  if(response.status>=500)throw new MailError('邮件服务暂时不可用，发送结果待确认。',true,true);
  throw new MailError('邮件服务拒绝发送，请检查发件地址、附件和发送额度。');
 }
 const data=await response.json().catch(()=>null) as {id?:string}|null;
 if(!data?.id)throw new MailError('邮件服务未返回发送编号，结果待确认。',true,true);
 return data.id;
}
