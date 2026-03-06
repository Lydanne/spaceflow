import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { permissionGroups, teamPermissions } from "~~/server/db/schema/permission";
import { z } from "zod";

// ─── permissionGroups ────────────────────────────────────
export const insertPermissionGroupSchema = createInsertSchema(permissionGroups);
export const selectPermissionGroupSchema = createSelectSchema(permissionGroups);
export const updatePermissionGroupSchema = createUpdateSchema(permissionGroups);

export type InsertPermissionGroup = z.infer<typeof insertPermissionGroupSchema>;
export type SelectPermissionGroup = z.infer<typeof selectPermissionGroupSchema>;
export type UpdatePermissionGroup = z.infer<typeof updatePermissionGroupSchema>;

// ─── teamPermissions ─────────────────────────────────────
export const insertTeamPermissionSchema = createInsertSchema(teamPermissions);
export const selectTeamPermissionSchema = createSelectSchema(teamPermissions);
export const updateTeamPermissionSchema = createUpdateSchema(teamPermissions);

export type InsertTeamPermission = z.infer<typeof insertTeamPermissionSchema>;
export type SelectTeamPermission = z.infer<typeof selectTeamPermissionSchema>;
export type UpdateTeamPermission = z.infer<typeof updateTeamPermissionSchema>;

// ─── 权限组 CRUD request body ────────────────────────────
export const createPermissionGroupBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  repository_ids: z.array(z.string()).nullable().optional(),
});
export type CreatePermissionGroupBody = z.infer<typeof createPermissionGroupBodySchema>;

export const updatePermissionGroupBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  repository_ids: z.array(z.string()).nullable().optional(),
});
export type UpdatePermissionGroupBody = z.infer<typeof updatePermissionGroupBodySchema>;

// ─── 分配权限组 request body ─────────────────────────────
export const assignPermissionBodySchema = z.object({
  permission_group_id: z.string().uuid(),
});
export type AssignPermissionBody = z.infer<typeof assignPermissionBodySchema>;
