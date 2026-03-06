import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { organizations, teams, teamMembers } from "../../db/schema/organization";
import type { z } from "zod";

// ─── organizations ───────────────────────────────────────
export const insertOrganizationSchema = createInsertSchema(organizations);
export const selectOrganizationSchema = createSelectSchema(organizations);
export const updateOrganizationSchema = createUpdateSchema(organizations);

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type SelectOrganization = z.infer<typeof selectOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;

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
