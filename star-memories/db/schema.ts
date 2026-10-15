import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const memories = sqliteTable('memories', {
 id:text('id').primaryKey(), userId:text('user_id').notNull(), slot:integer('slot').notNull(),
 occurredAt:text('occurred_at').notNull(), content:text('content').notNull(), createdAt:text('created_at').notNull()
},table=>[uniqueIndex('memories_user_slot').on(table.userId,table.slot)]);
export const photos = sqliteTable('photos',{
 id:text('id').primaryKey(), memoryId:text('memory_id').notNull().references(()=>memories.id),
 userId:text('user_id').notNull(), objectKey:text('object_key').notNull(), mime:text('mime').notNull(), position:integer('position').notNull()
},table=>[index('photos_memory').on(table.memoryId),index('photos_user').on(table.userId)]);
export const accounts = sqliteTable('accounts',{
 id:text('id').primaryKey(), username:text('username').notNull(), usernameKey:text('username_key').notNull().unique(),
 passwordHash:text('password_hash').notNull(), createdAt:text('created_at').notNull()
});
export const accountSessions = sqliteTable('account_sessions',{
 tokenHash:text('token_hash').primaryKey(), accountId:text('account_id').notNull().references(()=>accounts.id),
 createdAt:text('created_at').notNull(), expiresAt:text('expires_at').notNull()
},table=>[index('account_sessions_account').on(table.accountId)]);
export const authAttempts = sqliteTable('auth_attempts',{
 key:text('key').primaryKey(), count:integer('count').notNull(), windowStart:text('window_start').notNull()
});
