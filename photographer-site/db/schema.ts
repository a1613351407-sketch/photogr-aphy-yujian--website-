import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const surveys = sqliteTable('surveys', {
 id: text('id').primaryKey(), name: text('name').notNull(), contact: text('contact').notNull(),
 payload: text('payload').notNull(), photos: text('photos').notNull(),
 createdAt: text('created_at').notNull(), status: text('status').notNull().default('new'),
}, table => [index('idx_surveys_created_at').on(table.createdAt)]);
export const rateLimits = sqliteTable('rate_limits', {
 key: text('key').primaryKey(), count: integer('count').notNull(), resetAt: integer('reset_at').notNull(),
});
export const emailDeliveries = sqliteTable('email_deliveries', {
 surveyId: text('survey_id').primaryKey().references(()=>surveys.id),
 state: text('state').notNull().default('pending'), providerId: text('provider_id'), error: text('error'),
 attempts: integer('attempts').notNull().default(0), firstAttemptAt: integer('first_attempt_at'), updatedAt: integer('updated_at').notNull(),
});
export const feishuDeliveries = sqliteTable('feishu_deliveries', {
 id: text('id').primaryKey(), surveyId: text('survey_id').notNull().references(()=>surveys.id),
 filename: text('filename').notNull(), contentType: text('content_type').notNull(), sourceKey: text('source_key'),
 state: text('state').notNull().default('pending'), fileKey: text('file_key'), messageId: text('message_id'),
 error: text('error'), target: text('target'), attempts: integer('attempts').notNull().default(0),
 firstAttemptAt: integer('first_attempt_at'), updatedAt: integer('updated_at').notNull(),
}, table=>[index('idx_feishu_deliveries_survey_id').on(table.surveyId)]);
