import { pgTable, varchar, timestamp, text, index, unique, bigint, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["ADMIN", "AUTHOR", "USER"]);

// ─────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => createId()),
  name: varchar("name", { length: 120 }),
  displayName: varchar("display_name", { length: 120 }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  avatarUrl: text("avatar_url"),
  username: varchar("username", { length: 120 }).unique(),
  role: roleEnum("role").notNull().default("USER"),
  is2FaAuthEnabled: boolean("is2fa_auth_enabled").default(false).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  verificationToken: text("verification_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────
// Auth Methods
// ─────────────────────────────────────────────

export const authMethods = pgTable("auth_methods", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerUserId: varchar("provider_user_id", { length: 320 }).notNull(),
  passwordHash: text("password_hash"),
  googleSub: text("google_sub"),
  googleEmail: text("google_email"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    uqAuthMethodProviderUser: unique("uq_auth_method_provider_user").on(table.provider, table.providerUserId),
    uqAuthMethodGoogleSub: unique("uq_auth_method_google_sub").on(table.googleSub),
    uqAuthMethodGoogleEmail: unique("uq_auth_method_google_email").on(table.googleEmail),
    idxAuthMethodsUserProvider: index("idx_auth_methods_user_provider").on(table.userId, table.provider),
  };
});

// ─────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 64 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    idxSessionsUserStatus: index("idx_sessions_user_status").on(table.userId, table.status),
    idxSessionsExpiresAt: index("idx_sessions_expires_at").on(table.expiresAt),
  };
});

// ─────────────────────────────────────────────
// Workspaces
// ─────────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => createId()),
  ownerUserId: varchar("owner_user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    idxWorkspacesOwnerUserId: index("idx_workspaces_owner_user_id").on(table.ownerUserId),
  };
});

// ─────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => createId()),
  workspaceId: varchar("workspace_id", { length: 36 })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  type: varchar("type", { length: 40 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    uqProjectWorkspaceName: unique("uq_project_workspace_name").on(table.workspaceId, table.name),
    idxProjectsWorkspaceId: index("idx_projects_workspace_id").on(table.workspaceId),
  };
});

// ─────────────────────────────────────────────
// Nodes
// ─────────────────────────────────────────────

export const nodes = pgTable("nodes", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => createId()),
  projectId: varchar("project_id", { length: 36 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id", { length: 36 }).references((): any => nodes.id, { onDelete: "cascade" }), // references self
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 10 }).notNull(), // FILE or FOLDER
  contentHash: varchar("content_hash", { length: 64 }),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    uqNodesProjectParentName: unique("uq_nodes_project_parent_name").on(table.projectId, table.parentId, table.name),
    idxNodesProjectParent: index("idx_nodes_project_parent").on(table.projectId, table.parentId),
    idxNodesProjectType: index("idx_nodes_project_type").on(table.projectId, table.type),
  };
});
