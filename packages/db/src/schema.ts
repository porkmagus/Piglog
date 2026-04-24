import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  json,
  jsonb,
  varchar,
  pgEnum,
  index,
  uniqueIndex,
  bigint,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================
// Enums
// ============================================================
export const workspaceRoleEnum = pgEnum('workspace_role', [
  'OWNER',
  'ADMIN',
  'MEMBER',
  'GUEST',
]);

export const inviteStatusEnum = pgEnum('invite_status', [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'WORKSPACE_INVITE',
  'BILLING',
  'LOG_SPIKE',
  'THRESHOLD_BREACH',
  'MENTION',
]);

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'PENDING',
  'DELIVERED',
  'FAILED',
  'RETRYING',
]);

export const logLevelEnum = pgEnum('log_level', [
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL',
]);

export const alertRuleOperatorEnum = pgEnum('alert_rule_operator', [
  'GREATER_THAN',
  'LESS_THAN',
  'EQUALS',
  'CONTAINS',
]);

export const alertRuleStatusEnum = pgEnum('alert_rule_status', [
  'ACTIVE',
  'PAUSED',
  'DISABLED',
]);

// ============================================================
// Better Auth Tables
// ============================================================
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  notificationPreferences: json('notification_preferences').default('{"emailNotifications":true}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('account_provider_account_idx').on(table.providerId, table.accountId),
  index('account_user_idx').on(table.userId),
]);

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('session_user_idx').on(table.userId),
]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull().unique(),
  expiresAt: timestamp('expires', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('verification_identifier_value_idx').on(table.identifier, table.value),
]);

// ============================================================
// Workspace / Tenancy
// ============================================================
export const workspace = pgTable('workspace', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  icon: text('icon'),
  color: text('color').notNull().default('#5E6AD2'),
  inviteCode: text('invite_code').notNull().unique(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id),
  plan: text('plan').notNull().default('FREE'),
  settings: json('settings').default('{}'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('workspace_slug_idx').on(table.slug),
  index('workspace_owner_idx').on(table.ownerId),
]);

export const workspaceMember = pgTable('workspace_member', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: workspaceRoleEnum('role').notNull().default('MEMBER'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('workspace_member_unique_idx').on(table.workspaceId, table.userId),
  index('workspace_member_workspace_idx').on(table.workspaceId),
  index('workspace_member_user_idx').on(table.userId),
]);

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: workspaceRoleEnum('role').notNull().default('MEMBER'),
  token: text('token').notNull().unique(),
  status: inviteStatusEnum('status').notNull().default('PENDING'),
  invitedById: text('invited_by_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('invitation_workspace_idx').on(table.workspaceId),
  index('invitation_email_idx').on(table.email),
  index('invitation_token_idx').on(table.token),
]);

export const groupTable = pgTable('group', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull().default('#5E6AD2'),
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('group_workspace_idx').on(table.workspaceId),
]);

export const groupMember = pgTable('group_member', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => groupTable.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  addedById: text('added_by_id').references(() => user.id),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('group_member_unique_idx').on(table.groupId, table.userId),
  index('group_member_group_idx').on(table.groupId),
  index('group_member_user_idx').on(table.userId),
]);

// ============================================================
// Billing
// ============================================================
export const billing = pgTable('billing', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .unique()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull().default('FREE'),
  status: text('status').notNull().default('ACTIVE'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  lastInvoiceId: text('last_invoice_id'),
  lastInvoiceUrl: text('last_invoice_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoice = pgTable('invoice', {
  id: text('id').primaryKey(),
  billingId: text('billing_id')
    .notNull()
    .references(() => billing.id, { onDelete: 'cascade' }),
  stripeInvoiceId: text('stripe_invoice_id').notNull().unique(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull(),
  pdfUrl: text('pdf_url'),
  hostedUrl: text('hosted_url'),
  periodStart: timestamp('period_start', { withTimezone: true }),
  periodEnd: timestamp('period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('invoice_billing_idx').on(table.billingId),
]);

// ============================================================
// Notifications
// ============================================================
export const notification = pgTable('notification', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'set null' }),
  metadata: json('metadata'),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('notification_user_read_idx').on(table.userId, table.isRead),
  index('notification_workspace_idx').on(table.workspaceId),
  index('notification_created_idx').on(table.createdAt),
]);

// ============================================================
// Webhooks (adapted for outbound + log ingestion)
// ============================================================
export const webhook = pgTable('webhook', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  failureCount: integer('failure_count').notNull().default(0),
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  disabledReason: text('disabled_reason'),
}, (table) => [
  index('webhook_workspace_idx').on(table.workspaceId),
  index('webhook_workspace_active_idx').on(table.workspaceId, table.isActive),
]);

export const webhookEvent = pgTable('webhook_event', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id')
    .notNull()
    .references(() => webhook.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdById: text('created_by_id').references(() => user.id),
}, (table) => [
  uniqueIndex('webhook_event_unique_idx').on(table.webhookId, table.event),
  index('webhook_event_webhook_idx').on(table.webhookId),
]);

export const webhookDelivery = pgTable('webhook_delivery', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id')
    .notNull()
    .references(() => webhook.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: json('payload').notNull(),
  status: deliveryStatusEnum('status').notNull().default('PENDING'),
  statusCode: integer('status_code'),
  response: text('response'),
  error: text('error'),
  attemptCount: integer('attempt_count').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdById: text('created_by_id').references(() => user.id),
}, (table) => [
  index('webhook_delivery_webhook_created_idx').on(table.webhookId, table.createdAt),
  index('webhook_delivery_webhook_status_idx').on(table.webhookId, table.status),
  index('webhook_delivery_status_retry_idx').on(table.status, table.nextRetryAt),
]);

// ============================================================
// Log Domain (NEW)
// ============================================================
export const logSource = pgTable('log_source', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // http, syslog, filebeat, vector
  apiKey: text('api_key').notNull().unique(),
  config: json('config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('log_source_workspace_idx').on(table.workspaceId),
]);

export const logStream = pgTable('log_stream', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  sourceId: text('source_id')
    .notNull()
    .references(() => logSource.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  filterConfig: json('filter_config').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('log_stream_workspace_idx').on(table.workspaceId),
  index('log_stream_source_idx').on(table.sourceId),
]);

// This table becomes a TimescaleDB hypertable via raw migration
export const logEntry = pgTable('log_entry', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  sourceId: text('source_id')
    .notNull()
    .references(() => logSource.id, { onDelete: 'cascade' }),
  level: logLevelEnum('level').notNull(),
  service: text('service').notNull(),
  host: text('host'),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  traceId: text('trace_id'),
}, (table) => [
  primaryKey({ columns: [table.id, table.timestamp] }),
  index('log_entry_timestamp_idx').on(table.timestamp),
  index('log_entry_workspace_service_level_idx').on(table.workspaceId, table.service, table.level),
  index('log_entry_trace_idx').on(table.traceId),
  index('log_entry_workspace_timestamp_idx').on(table.workspaceId, table.timestamp),
  index('log_entry_source_timestamp_idx').on(table.sourceId, table.timestamp),
]);

export const alertRule = pgTable('alert_rule', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  service: text('service').notNull(),
  level: logLevelEnum('level'),
  operator: alertRuleOperatorEnum('operator').notNull(),
  threshold: integer('threshold').notNull(),
  windowMinutes: integer('window_minutes').notNull().default(5),
  status: alertRuleStatusEnum('status').notNull().default('ACTIVE'),
  webhookUrl: text('webhook_url'),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('alert_rule_workspace_idx').on(table.workspaceId),
  index('alert_rule_status_idx').on(table.status),
]);

export const alertEvent = pgTable('alert_event', {
  id: text('id').primaryKey(),
  alertRuleId: text('alert_rule_id')
    .notNull()
    .references(() => alertRule.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  actualCount: integer('actual_count').notNull(),
  threshold: integer('threshold').notNull(),
  operator: alertRuleOperatorEnum('operator').notNull(),
  status: text('status').notNull().default('FIRED'), // FIRED | RESOLVED
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('alert_event_rule_idx').on(table.alertRuleId),
  index('alert_event_workspace_idx').on(table.workspaceId),
  index('alert_event_created_idx').on(table.createdAt),
]);

export const savedQuery = pgTable('saved_query', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  queryTokens: json('query_tokens').default('[]'),
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('saved_query_workspace_idx').on(table.workspaceId),
]);

export const dashboard = pgTable('dashboard', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  config: json('config').default('[]'),
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('dashboard_workspace_idx').on(table.workspaceId),
]);

// ============================================================
// Relations
// ============================================================
export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
  workspaceMemberships: many(workspaceMember),
  ownedWorkspaces: many(workspace),
  notifications: many(notification),
  createdWebhooks: many(webhook),
}));

export const workspaceRelations = relations(workspace, ({ one, many }) => ({
  owner: one(user, { fields: [workspace.ownerId], references: [user.id] }),
  members: many(workspaceMember),
  invitations: many(invitation),
  billings: one(billing),
  notifications: many(notification),
  webhooks: many(webhook),
  logSources: many(logSource),
  logStreams: many(logStream),
  logEntries: many(logEntry),
  alertRules: many(alertRule),
  alertEvents: many(alertEvent),
  savedQueries: many(savedQuery),
  dashboards: many(dashboard),
}));

export const workspaceMemberRelations = relations(workspaceMember, ({ one }) => ({
  workspace: one(workspace, { fields: [workspaceMember.workspaceId], references: [workspace.id] }),
  user: one(user, { fields: [workspaceMember.userId], references: [user.id] }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  workspace: one(workspace, { fields: [invitation.workspaceId], references: [workspace.id] }),
  invitedBy: one(user, { fields: [invitation.invitedById], references: [user.id] }),
}));

export const logSourceRelations = relations(logSource, ({ one, many }) => ({
  workspace: one(workspace, { fields: [logSource.workspaceId], references: [workspace.id] }),
  entries: many(logEntry),
  streams: many(logStream),
}));

export const logEntryRelations = relations(logEntry, ({ one }) => ({
  workspace: one(workspace, { fields: [logEntry.workspaceId], references: [workspace.id] }),
  source: one(logSource, { fields: [logEntry.sourceId], references: [logSource.id] }),
}));

export const alertRuleRelations = relations(alertRule, ({ one, many }) => ({
  workspace: one(workspace, { fields: [alertRule.workspaceId], references: [workspace.id] }),
  events: many(alertEvent),
}));

export const alertEventRelations = relations(alertEvent, ({ one }) => ({
  rule: one(alertRule, { fields: [alertEvent.alertRuleId], references: [alertRule.id] }),
  workspace: one(workspace, { fields: [alertEvent.workspaceId], references: [workspace.id] }),
}));

// ============================================================
// Integrations
// ============================================================
export const integrationProviderEnum = pgEnum('integration_provider', ['nextdns']);
export const integrationStatusEnum = pgEnum('integration_status', ['PENDING', 'CONNECTED', 'SYNCING', 'ERROR', 'DISABLED']);

export const integration = pgTable('integration', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  provider: integrationProviderEnum('provider').notNull(),
  name: text('name').notNull(),
  status: integrationStatusEnum('status').notNull().default('PENDING'),
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
  secret: text('secret'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const integrationSource = pgTable('integration_source', {
  id: text('id').primaryKey(),
  integrationId: text('integration_id').notNull().references(() => integration.id, { onDelete: 'cascade' }),
  sourceId: text('source_id').notNull().references(() => logSource.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  externalName: text('external_name').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  status: integrationStatusEnum('status').notNull().default('CONNECTED'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('integration_source_external_unique_idx').on(table.integrationId, table.externalId),
]);

export const integrationRelations = relations(integration, ({ one, many }) => ({
  workspace: one(workspace, { fields: [integration.workspaceId], references: [workspace.id] }),
  sources: many(integrationSource),
}));

export const integrationSourceRelations = relations(integrationSource, ({ one }) => ({
  integration: one(integration, { fields: [integrationSource.integrationId], references: [integration.id] }),
  source: one(logSource, { fields: [integrationSource.sourceId], references: [logSource.id] }),
}));
