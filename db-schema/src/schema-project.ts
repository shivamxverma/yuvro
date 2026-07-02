import { pgTable, varchar, timestamp, index, unique, bigint } from "drizzle-orm/pg-core";
import { users } from "./schema-auth";

export const workspaces = pgTable("workspaces", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerUserId: varchar("owner_user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => {
  return {
    idxWorkspacesOwnerUserId: index("idx_workspaces_owner_user_id").on(table.ownerUserId),
  };
});

export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 })
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  type: varchar("type", { length: 40 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => {
  return {
    uqProjectWorkspaceName: unique("uq_project_workspace_name").on(table.workspaceId, table.name),
    idxProjectsWorkspaceId: index("idx_projects_workspace_id").on(table.workspaceId),
  };
});

export const nodes = pgTable("nodes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("project_id", { length: 36 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id", { length: 36 }).references((): any => nodes.id, { onDelete: "cascade" }), // references self
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 10 }).notNull(), // FILE or FOLDER
  contentHash: varchar("content_hash", { length: 64 }),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => {
  return {
    uqNodesProjectParentName: unique("uq_nodes_project_parent_name").on(table.projectId, table.parentId, table.name),
    idxNodesProjectParent: index("idx_nodes_project_parent").on(table.projectId, table.parentId),
    idxNodesProjectType: index("idx_nodes_project_type").on(table.projectId, table.type),
  };
});
