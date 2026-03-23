import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

interface TeamMemberInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string | null;
}

interface PermissionGroupInfo {
  id: string;
  name: string;
  type: string;
  permissions: string[];
}

interface TeamInfo {
  id: string;
  name: string;
  organization: {
    id: string;
    name: string;
  };
  role: string | null;
  permissions: PermissionGroupInfo[];
  members: TeamMemberInfo[];
}

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  // 获取用户所在的所有团队
  const teamMemberships = await db
    .select({
      team_id: schema.teamMembers.team_id,
      role: schema.teamMembers.role,
      team_name: schema.teams.name,
      org_id: schema.teams.organization_id,
      org_name: schema.organizations.name,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
    .innerJoin(schema.organizations, eq(schema.teams.organization_id, schema.organizations.id))
    .where(eq(schema.teamMembers.user_id, session.user.id));

  const teams: TeamInfo[] = [];

  for (const membership of teamMemberships) {
    if (!membership.team_id) continue;

    // 获取团队的权限组
    const permissionGroups = await db
      .select({
        id: schema.permissionGroups.id,
        name: schema.permissionGroups.name,
        type: schema.permissionGroups.type,
        permissions: schema.permissionGroups.permissions,
      })
      .from(schema.teamPermissions)
      .innerJoin(
        schema.permissionGroups,
        eq(schema.teamPermissions.permission_group_id, schema.permissionGroups.id),
      )
      .where(eq(schema.teamPermissions.team_id, membership.team_id));

    // 获取团队成员
    const members = await db
      .select({
        id: schema.users.id,
        username: schema.users.gitea_username,
        avatar_url: schema.users.avatar_url,
        role: schema.teamMembers.role,
      })
      .from(schema.teamMembers)
      .innerJoin(schema.users, eq(schema.teamMembers.user_id, schema.users.id))
      .where(eq(schema.teamMembers.team_id, membership.team_id));

    teams.push({
      id: membership.team_id,
      name: membership.team_name ?? "",
      organization: {
        id: membership.org_id ?? "",
        name: membership.org_name ?? "",
      },
      role: membership.role,
      permissions: permissionGroups.map((pg) => ({
        id: pg.id,
        name: pg.name,
        type: pg.type,
        permissions: (pg.permissions as string[]) || [],
      })),
      members: members.map((m) => ({
        id: m.id,
        username: m.username,
        avatar_url: m.avatar_url,
        role: m.role,
      })),
    });
  }

  return { data: teams };
});
