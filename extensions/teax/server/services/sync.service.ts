import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../db";
import { createServiceGiteaClient } from "../utils/gitea";

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
        giteaOrgId: org.id,
        name: org.name,
        fullName: org.full_name || org.name,
        avatarUrl: org.avatar_url,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.organizations.giteaOrgId,
        set: {
          name: org.name,
          fullName: org.full_name || org.name,
          avatarUrl: org.avatar_url,
          syncedAt: new Date(),
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
          organizationId: dbOrg.id,
          giteaTeamId: team.id,
          name: team.name,
          description: team.description,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.teams.organizationId, schema.teams.giteaTeamId],
          set: {
            name: team.name,
            description: team.description,
            syncedAt: new Date(),
          },
        })
        .returning();

      if (!dbTeam) continue;

      // 将团队关联到默认权限组
      await db
        .insert(schema.teamPermissions)
        .values({
          teamId: dbTeam.id,
          permissionGroupId: defaultGroup.id,
        })
        .onConflictDoNothing();

      const members = await gitea.getTeamMembers(team.id);

      for (const member of members) {
        const [memberUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.giteaId, member.id))
          .limit(1);

        if (memberUser) {
          await db
            .insert(schema.teamMembers)
            .values({
              teamId: dbTeam.id,
              userId: memberUser.id,
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
        eq(schema.permissionGroups.organizationId, orgId),
        eq(schema.permissionGroups.name, DEFAULT_GROUP_NAME),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(schema.permissionGroups)
    .values({
      organizationId: orgId,
      type: "default",
      name: DEFAULT_GROUP_NAME,
      description: "默认权限组，仅含查看权限，对全部仓库可见",
      permissions: DEFAULT_PERMISSIONS,
      repositoryIds: null,
    })
    .returning();

  return created!;
}
