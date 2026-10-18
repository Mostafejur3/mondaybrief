import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

const ts = () => ({ createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), email: text("email").notNull(), passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // user | support | admin | super_admin
  status: text("status").notNull().default("active"), // active | suspended
  company: text("company").default(""), jobTitle: text("job_title").default(""),
  language: text("language").default("en"), timezone: text("timezone").default("UTC"),
  theme: text("theme").default("light"), preferences: jsonb("preferences").default({}),
  emailVerified: boolean("email_verified").default(false), lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  isSeed: boolean("is_seed").default(false), ...ts(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ip: text("ip").default(""), userAgent: text("user_agent").default(""),
  revokedAt: timestamp("revoked_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sessions_user_idx").on(t.userId), index("sessions_token_idx").on(t.tokenHash)]);

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plans = pgTable("plans", {
  id: text("id").primaryKey(), name: text("name").notNull(), tagline: text("tagline").default(""),
  priceMonthly: integer("price_monthly").notNull().default(0), priceYearly: integer("price_yearly").notNull().default(0),
  currency: text("currency").default("USD"), limits: jsonb("limits").default({}), features: jsonb("features").default([]),
  isActive: boolean("is_active").default(true), sort: integer("sort").default(0), ...ts(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.id), planId: text("plan_id").default("free"),
  isDemo: boolean("is_demo").default(false), ...ts(),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), invitedEmail: text("invited_email").default(""),
  role: text("role").notNull().default("editor"), status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("memberships_ws_idx").on(t.workspaceId), index("memberships_user_idx").on(t.userId)]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id), planId: text("plan_id").notNull(),
  status: text("status").notNull().default("active"), provider: text("provider").default("development"),
  billingCycle: text("billing_cycle").default("monthly"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }), currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false), ...ts(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(), number: text("number").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id), workspaceId: uuid("workspace_id"),
  subscriptionId: uuid("subscription_id"), amount: integer("amount").notNull().default(0), currency: text("currency").default("USD"),
  status: text("status").notNull().default("paid"), provider: text("provider").default("development"),
  lines: jsonb("lines").default([]), periodStart: timestamp("period_start", { withTimezone: true }), periodEnd: timestamp("period_end", { withTimezone: true }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(), paidAt: timestamp("paid_at", { withTimezone: true }),
}, (t) => [uniqueIndex("invoices_number_idx").on(t.number)]);

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by"), name: text("name").notNull(), type: text("type").default("csv"),
  sizeBytes: integer("size_bytes").default(0), status: text("status").default("imported"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const datasets = pgTable("datasets", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  fileId: uuid("file_id"), name: text("name").notNull(), description: text("description").default(""),
  columns: jsonb("columns").notNull().default([]), rowCount: integer("row_count").default(0),
  qualityScore: integer("quality_score").default(0), isDemo: boolean("is_demo").default(false),
  sheetName: text("sheet_name").default(""), tags: jsonb("tags").default([]), status: text("status").default("active"),
  source: text("source").default("upload"), createdBy: uuid("created_by"), ...ts(),
}, (t) => [index("datasets_ws_idx").on(t.workspaceId)]);

export const datasetRows = pgTable("dataset_rows", {
  id: uuid("id").primaryKey().defaultRandom(), datasetId: uuid("dataset_id").notNull().references(() => datasets.id, { onDelete: "cascade" }),
  rowIndex: integer("row_index").notNull(), data: jsonb("data").notNull(),
}, (t) => [index("dataset_rows_ds_idx").on(t.datasetId, t.rowIndex)]);

export const cleaningOps = pgTable("cleaning_ops", {
  id: uuid("id").primaryKey().defaultRandom(), datasetId: uuid("dataset_id").notNull().references(() => datasets.id, { onDelete: "cascade" }),
  userId: uuid("user_id"), operation: text("operation").notNull(), params: jsonb("params").default({}),
  affectedRows: integer("affected_rows").default(0), affectedCells: integer("affected_cells").default(0),
  beforeScore: integer("before_score").default(0), afterScore: integer("after_score").default(0),
  snapshot: jsonb("snapshot"), status: text("status").default("applied"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull(), datasetId: uuid("dataset_id"),
  name: text("name").notNull(), steps: jsonb("steps").notNull().default([]), createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dashboards = pgTable("dashboards", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  datasetId: uuid("dataset_id"), name: text("name").notNull(), description: text("description").default(""),
  config: jsonb("config").notNull().default({ widgets: [], theme: "emerald" }), isTemplate: boolean("is_template").default(false),
  version: integer("version").default(1), createdBy: uuid("created_by"), ...ts(),
});

export const dashboardVersions = pgTable("dashboard_versions", {
  id: uuid("id").primaryKey().defaultRandom(), dashboardId: uuid("dashboard_id").notNull().references(() => dashboards.id, { onDelete: "cascade" }),
  version: integer("version").notNull(), config: jsonb("config").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedQuestions = pgTable("saved_questions", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull(), datasetId: uuid("dataset_id"),
  question: text("question").notNull(), category: text("category").default("General"), collection: text("collection").default(""),
  isFavorite: boolean("is_favorite").default(false), lastAnswer: jsonb("last_answer"), createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id"), workspaceId: uuid("workspace_id"),
  kind: text("kind").default("question"), detail: text("detail").default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull(), datasetId: uuid("dataset_id"),
  dashboardId: uuid("dashboard_id"), name: text("name").notNull(), type: text("type").default("executive"),
  content: jsonb("content").default({}), createdBy: uuid("created_by"), ...ts(),
});

export const automations = pgTable("automations", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull(), datasetId: uuid("dataset_id"),
  name: text("name").notNull(), steps: jsonb("steps").notNull().default([]), schedule: text("schedule").default("manual"),
  enabled: boolean("enabled").default(true), recipeId: uuid("recipe_id"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }), createdBy: uuid("created_by"), ...ts(),
});

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().defaultRandom(), automationId: uuid("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  status: text("status").default("running"), log: jsonb("log").default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(), finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull(), datasetId: uuid("dataset_id"),
  name: text("name").notNull(), metric: text("metric").default(""), agg: text("agg").default("sum"),
  operator: text("operator").default("<"), threshold: integer("threshold").default(0), severity: text("severity").default("medium"),
  enabled: boolean("enabled").default(true), lastValue: text("last_value").default(""), lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  ...ts(),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull(), type: text("type").notNull(),
  name: text("name").notNull(), config: jsonb("config").default({}), secretEnc: text("secret_enc").default(""),
  status: text("status").default("not_tested"), lastTestAt: timestamp("last_test_at", { withTimezone: true }), lastTest: jsonb("last_test").default({}),
  createdBy: uuid("created_by"), ...ts(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id"), type: text("type").default("info"), title: text("title").notNull(),
  body: text("body").default(""), link: text("link").default(""), readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(), topic: text("topic").default("General"), status: text("status").default("Open"),
  priority: text("priority").default("Normal"), assignedTo: uuid("assigned_to"), ...ts(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(), conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id"), senderName: text("sender_name").default(""), senderRole: text("sender_role").default("user"),
  body: text("body").notNull(), isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(), value: jsonb("value").notNull(), updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id"), actorEmail: text("actor_email").default(""),
  action: text("action").notNull(), entity: text("entity").default(""), entityId: text("entity_id").default(""),
  metadata: jsonb("metadata").default({}), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id"), type: text("type").notNull(),
  status: text("status").default("completed"), progress: integer("progress").default(100), error: text("error").default(""),
  result: jsonb("result").default({}), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id"), workspaceId: uuid("workspace_id"),
  event: text("event").notNull(), metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
