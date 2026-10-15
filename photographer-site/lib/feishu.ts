import {env, waitUntil} from 'cloudflare:workers';
import {getDatabase, getFiles} from '@/db';
import {emailBrief} from './email-content';
import type {Answers} from './options';
import {FeishuError, getFeishuToken, uploadFeishuFile, sendFeishuFile, type FeishuRecipientType} from './feishu-provider';

const RETRY_WINDOW = 55 * 60 * 1000; // Feishu deduplicates a message UUID for one hour.
export function feishuConfigured() {
  return !!env.FEISHU_APP_ID && !!env.FEISHU_APP_SECRET && !!env.FEISHU_RECEIVE_ID &&
    ['open_id', 'user_id', 'union_id'].includes(env.FEISHU_RECEIVE_ID_TYPE || 'open_id');
}
export type FeishuItem = {
  id: string; survey_id: string; filename: string; content_type: string; source_key: string | null;
  state: string; file_key: string | null; message_id: string | null; first_attempt_at: number | null;
  updated_at: number; target: string | null; error: string | null;
};
export function startFeishu(id: string) {
  try { waitUntil(deliverFeishu(id).catch(() => {})); } catch { /* Durable records remain available for retry. */ }
}
export async function feishuSummary(id: string) {
  const {results} = await getDatabase().prepare('SELECT id,filename,state,error FROM feishu_deliveries WHERE survey_id=? ORDER BY filename').bind(id).all();
  return {configured: feishuConfigured(), items: results, sent: results.filter(item => item.state === 'sent').length, total: results.length};
}
export async function deliverFeishu(surveyId: string) {
  if (!feishuConfigured()) return;
  const db = getDatabase();
  const survey = await db.prepare('SELECT payload,photos FROM surveys WHERE id=?').bind(surveyId).first<{payload: string; photos: string}>();
  if (!survey) return;
  const {results} = await db.prepare("SELECT * FROM feishu_deliveries WHERE survey_id=? AND state!='sent'").bind(surveyId).all<FeishuItem>();
  if (!results.length) return;
  let token: string;
  try { token = await getFeishuToken(env.FEISHU_APP_ID!, env.FEISHU_APP_SECRET!); }
  catch { await db.prepare("UPDATE feishu_deliveries SET state='failed',error=?,updated_at=? WHERE survey_id=? AND state IN ('pending','failed')").bind('飞书机器人授权失败，请检查应用配置。', Date.now(), surveyId).run(); return; }
  const type = (env.FEISHU_RECEIVE_ID_TYPE || 'open_id') as FeishuRecipientType;
  const target = JSON.stringify([env.FEISHU_APP_ID, type, env.FEISHU_RECEIVE_ID]);
  const brief = emailBrief(surveyId, JSON.parse(survey.payload) as Answers, JSON.parse(survey.photos).length);
  async function deliverOne(item: FeishuItem) {
    const now = Date.now();
    if (item.target && item.target !== target) {
      await db.prepare("UPDATE feishu_deliveries SET error=? WHERE id=? AND state!='sent'").bind('接收账户或机器人配置发生变化，请先核对此前发送记录。', item.id).run(); return;
    }
    if (item.first_attempt_at && item.first_attempt_at < now - RETRY_WINDOW) {
      await db.prepare("UPDATE feishu_deliveries SET state='uncertain',error=? WHERE id=? AND state!='sent'").bind('已超过安全去重时限，请先核对飞书私聊，避免重复发送。', item.id).run(); return;
    }
    const claimed = await db.prepare("UPDATE feishu_deliveries SET state='sending',attempts=attempts+1,updated_at=?,target=COALESCE(target,?),error=NULL WHERE id=? AND state!='sent' AND (state!='sending' OR updated_at<?) RETURNING *").bind(now, target, item.id, now - 60000).first<FeishuItem>();
    if (!claimed) return;
    let uncertain = claimed.first_attempt_at !== null;
    try {
      let fileKey = claimed.file_key;
      if (!fileKey) {
        let bytes: ArrayBuffer | string = brief;
        if (claimed.source_key) {
          const source = await getFiles().get(claimed.source_key);
          if (!source) throw new FeishuError('参考文件读取失败，问卷仍保存在工作台。');
          bytes = await source.arrayBuffer();
        }
        fileKey = await uploadFeishuFile(token, claimed.filename, new Blob([bytes], {type: claimed.content_type}));
        await db.prepare('UPDATE feishu_deliveries SET file_key=?,updated_at=? WHERE id=?').bind(fileKey, Date.now(), claimed.id).run();
      }
      await db.prepare('UPDATE feishu_deliveries SET first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=?').bind(Date.now(), claimed.id).run();
      const messageId = await sendFeishuFile(token, type, env.FEISHU_RECEIVE_ID!, fileKey, claimed.id);
      uncertain = true;
      await db.prepare("UPDATE feishu_deliveries SET state='sent',message_id=?,error=NULL,updated_at=? WHERE id=?").bind(messageId, Date.now(), claimed.id).run();
    } catch (error) {
      uncertain ||= error instanceof FeishuError && error.uncertain;
      await db.prepare('UPDATE feishu_deliveries SET state=?,error=?,first_attempt_at=CASE WHEN ? THEN first_attempt_at ELSE NULL END,updated_at=? WHERE id=?')
        .bind(uncertain ? 'uncertain' : 'failed', uncertain ? '发送结果待确认，请在 55 分钟内重试或核对飞书私聊。' : error instanceof FeishuError ? error.message : '飞书文件处理失败，请稍后重试。', uncertain ? 1 : 0, Date.now(), claimed.id).run();
    }
  }
  // Bound buffered file uploads and leave connections available for email.
  const queue = [...results];
  await Promise.allSettled(Array.from({length: Math.min(4, queue.length)}, async () => {
    while (queue.length) { const item = queue.shift(); if (item) await deliverOne(item); }
  }));
}
