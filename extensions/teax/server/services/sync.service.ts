import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { createServiceGiteaClient } from "~~/server/utils/gitea";

const DEFAULT_GROUP_NAME = "默认权限";

const DEFAULT_PERMISSIONS = [
  "repo:view",
  "actions:view",
];

export async function syncUserOrgsAndTeams(username: string) {
  const gitea = await createServiceGiteaClient();
  const db = useDB();

  const orgs = await gitea.getUserOrgsByUsername(username);

  for (const org of orgs) {
    const [dbOrg] = await db
      .insert(schema.organizations)
      .values({
        gitea_org_id: org.id,
        name: org.name,
        full_name: org.full_name || org.name,
        avatar_url: org.avatar_url,
        synced_at: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.organizations.gitea_org_id,
        set: {
          name: org.name,
          full_name: org.full_name || org.name,
          avatar_url: org.avatar_url,
          synced_at: new Date(),
        },
      })
      .returning();

    if (!dbOrg) continue;

    // 确保组织有默认权限组（所有权限 + 全部项目可见）
    const defaultGroup = await ensureDefaultPermissionGroup(db, dbOrg.id);

    const teams = await gitea.getOrgTeams(org.name);

    for (const team of teams) {
      const [dbTeam] = await db
        .insert(schema.teams)
        .values({
          organization_id: dbOrg.id,
          gitea_team_id: team.id,
          name: team.name,
          description: team.description,
          synced_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.teams.organization_id, schema.teams.gitea_team_id],
          set: {
            name: team.name,
            description: team.description,
            synced_at: new Date(),
          },
        })
        .returning();

      if (!dbTeam) continue;

      // 将团队关联到默认权限组
      await db
        .insert(schema.teamPermissions)
        .values({
          team_id: dbTeam.id,
          permission_group_id: defaultGroup.id,
        })
        .onConflictDoNothing();

      const members = await gitea.getTeamMembers(team.id);

      for (const member of members) {
        const [memberUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.gitea_id, member.id))
          .limit(1);

        if (memberUser) {
          await db
            .insert(schema.teamMembers)
            .values({
              team_id: dbTeam.id,
              user_id: memberUser.id,
              role: "member",
            })
            .onConflictDoNothing();
        }
      }
    }
  }
}

/**
 * 确保组织有一个默认权限组。
 * repositoryIds=null 表示全部仓库可见，permissions 包含所有已定义的权限。
 */
async function ensureDefaultPermissionGroup(db: ReturnType<typeof useDB>, orgId: string) {
  const [existing] = await db
    .select()
    .from(schema.permissionGroups)
    .where(
      and(
        eq(schema.permissionGroups.organization_id, orgId),
        eq(schema.permissionGroups.name, DEFAULT_GROUP_NAME),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(schema.permissionGroups)
    .values({
      organization_id: orgId,
      type: "default",
      name: DEFAULT_GROUP_NAME,
      description: "默认权限组，仅含查看权限，对全部仓库可见",
      permissions: DEFAULT_PERMISSIONS,
      repository_ids: null,
    })
    .returning();

  return created!;
}
