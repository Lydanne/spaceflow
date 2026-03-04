import { pgTable, uuid, integer, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  giteaId: integer('gitea_id').unique().notNull(),
  giteaUsername: varchar('gitea_username', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
})

export const userFeishu = pgTable('user_feishu', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  feishuOpenId: varchar('feishu_open_id', { length: 255 }).unique().notNull(),
  feishuUnionId: varchar('feishu_union_id', { length: 255 }),
  feishuName: varchar('feishu_name', { length: 255 }).notNull(),
  feishuAvatar: text('feishu_avatar'),
  accessToken: text('access_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  notifyPublish: boolean('notify_publish').default(true),
  notifyApproval: boolean('notify_approval').default(true),
  notifyAgent: boolean('notify_agent').default(true),
  notifySystem: boolean('notify_system').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
})
