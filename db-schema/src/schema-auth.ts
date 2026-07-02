import { pgTable, varchar, timestamp, text, index, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const authMethods = pgTable("auth_methods", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerUserId: varchar("provider_user_id", { length: 320 }).notNull(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => {
  return {
    uqAuthMethodProviderUser: unique("uq_auth_method_provider_user").on(table.provider, table.providerUserId),
    idxAuthMethodsUserProvider: index("idx_auth_methods_user_provider").on(table.userId, table.provider),
  };
});

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => {
  return {
    idxSessionsUserStatus: index("idx_sessions_user_status").on(table.userId, table.status),
    idxSessionsExpiresAt: index("idx_sessions_expires_at").on(table.expiresAt),
  };
});
