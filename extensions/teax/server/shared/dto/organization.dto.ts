import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { organizations, teams, teamMembers } from "~~/server/db/schema/organization";
import { z } from "zod";
import { paginatedResponseSchema } from "./common.dto";

// ─── organizations ───────────────────────────────────────
export const insertOrganizationSchema = createInsertSchema(organizations);
export const selectOrganizationSchema = createSelectSchema(organizations);
export const updateOrganizationSchema = createUpdateSchema(organizations);

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type SelectOrganization = z.infer<typeof selectOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;

export const orgSummarySchema = selectOrganizationSchema.pick({
  id: true,
  name: true,
  full_name: true,
  avatar_url: true,
}).extend({
  repoCount: z.number(),
});
export type OrgSummaryDto = z.infer<typeof orgSummarySchema>;

export const orgListResponseSchema = z.object({
  data: z.array(orgSummarySchema),
});
export type OrgListResponseDto = z.infer<typeof orgListResponseSchema>;

export const adminOrgListItemSchema = selectOrganizationSchema.pick({
  id: true,
  gitea_org_id: true,
  name: true,
  full_name: true,
  avatar_url: true,
}).extend({
  synced_at: z.string().nullable(),
  created_at: z.string(),
  teamCount: z.number(),
  member_count: z.number(),
});
export type AdminOrgListItemDto = z.infer<typeof adminOrgListItemSchema>;

export const adminOrgsResponseSchema = paginatedResponseSchema(adminOrgListItemSchema);
export type AdminOrgsResponseDto = z.infer<typeof adminOrgsResponseSchema>;

export const orgRepoItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable().optional(),
  default_branch: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type OrgRepoItemDto = z.infer<typeof orgRepoItemSchema>;

export const orgReposResponseSchema = z.object({
  data: z.array(orgRepoItemSchema),
});
export type OrgReposResponseDto = z.infer<typeof orgReposResponseSchema>;

// ─── teams ───────────────────────────────────────────────
export const insertTeamSchema = createInsertSchema(teams);
export const selectTeamSchema = createSelectSchema(teams);
export const updateTeamSchema = createUpdateSchema(teams);

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type SelectTeam = z.infer<typeof selectTeamSchema>;
export type UpdateTeam = z.infer<typeof updateTeamSchema>;

// ─── teamMembers ─────────────────────────────────────────
export const insertTeamMemberSchema = createInsertSchema(teamMembers);
export const selectTeamMemberSchema = createSelectSchema(teamMembers);
export const updateTeamMemberSchema = createUpdateSchema(teamMembers);

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type SelectTeamMember = z.infer<typeof selectTeamMemberSchema>;
export type UpdateTeamMember = z.infer<typeof updateTeamMemberSchema>;
