export type FeishuRecipientType = 'open_id' | 'user_id' | 'union_id';
export class FeishuError extends Error {
  constructor(message: string, public uncertain = false) { super(message); }
}
const ORIGIN = 'https://open.feishu.cn';
async function api(path: string, init: RequestInit, maySend: boolean, transport: typeof fetch) {
  let response: Response;
  try { response = await transport(ORIGIN + path, {...init, signal: AbortSignal.timeout(7000)}); }
  catch { throw new FeishuError(maySend ? '飞书发送超时，结果待确认。' : '飞书暂时无法连接，请稍后重试。', maySend); }
  const result = await response.json().catch(() => null) as {code?: number; data?: Record<string, unknown>; tenant_access_token?: string} | null;
  if (!response.ok || !result || result.code !== 0) {
    throw new FeishuError(
      maySend ? '飞书未确认发送，请核对机器人权限和接收人。' : '飞书授权或文件上传失败，请检查机器人配置与权限。',
      maySend && (response.status >= 500 || !result),
    );
  }
  return result;
}
export async function getFeishuToken(appId: string, appSecret: string, transport: typeof fetch = fetch) {
  const result = await api('/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({app_id: appId, app_secret: appSecret}),
  }, false, transport);
  if (!result.tenant_access_token) throw new FeishuError('飞书未返回有效的机器人授权。');
  return result.tenant_access_token;
}
export async function uploadFeishuFile(token: string, filename: string, file: Blob, transport: typeof fetch = fetch) {
  const body = new FormData(); body.append('file_type', 'stream'); body.append('file_name', filename); body.append('file', file, filename);
  const result = await api('/open-apis/im/v1/files', {method: 'POST', headers: {Authorization: 'Bearer ' + token}, body}, false, transport);
  const key = result.data?.file_key;
  if (typeof key !== 'string' || !key) throw new FeishuError('飞书未确认文件上传。');
  return key;
}
export async function sendFeishuFile(token: string, recipientType: FeishuRecipientType, recipient: string, fileKey: string, uuid: string, transport: typeof fetch = fetch) {
  const result = await api('/open-apis/im/v1/messages?receive_id_type=' + recipientType, {
    method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: JSON.stringify({receive_id: recipient, msg_type: 'file', content: JSON.stringify({file_key: fileKey}), uuid}),
  }, true, transport);
  const id = result.data?.message_id;
  if (typeof id !== 'string' || !id) throw new FeishuError('飞书未返回消息编号，结果待确认。', true);
  return id;
}
