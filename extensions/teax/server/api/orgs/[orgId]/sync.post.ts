import { eq, and, notInArray } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { createServiceGiteaClient } from "~~/server/utils/gitea";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }

  await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1);

  if (!org) {
    throw createError({ statusCode: 404, message: "Organization not found" });
  }

  const gitea = await createServiceGiteaClient();

  try {
    const teams = await gitea.getOrgTeamsAll(org.name);
    const syncedTeamIds: string[] = [];

    for (const team of teams) {
      const [dbTeam] = await db
        .insert(schema.teams)
        .values({
          organization_id: org.id,
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
      syncedTeamIds.push(dbTeam.id);

      const members = await gitea.getTeamMembersAll(team.id);
      const syncedMemberUserIds: string[] = [];

      for (const member of members) {
        const [memberUser] = await db
          .insert(schema.users)
          .values({
            gitea_id: member.id,
            gitea_username: member.login,
            email: member.email || `${member.login}@placeholder`,
            avatar_url: member.avatar_url,
          })
          .onConflictDoUpdate({
            target: schema.users.gitea_id,
            set: {
              gitea_username: member.login,
              avatar_url: member.avatar_url,
              ...(member.email ? { email: member.email } : {}),
              updated_at: new Date(),
            },
          })
          .returning({ id: schema.users.id });

        if (memberUser) {
          await db
            .insert(schema.teamMembers)
            .values({
              team_id: dbTeam.id,
              user_id: memberUser.id,
              role: "member",
            })
            .onConflictDoNothing();
          syncedMemberUserIds.push(memberUser.id);
        }
      }

      if (syncedMemberUserIds.length > 0) {
        await db
          .delete(schema.teamMembers)
          .where(
            and(
              eq(schema.teamMembers.team_id, dbTeam.id),
              notInArray(schema.teamMembers.user_id, syncedMemberUserIds),
            ),
          );
      } else {
        await db.delete(schema.teamMembers).where(eq(schema.teamMembers.team_id, dbTeam.id));
      }
    }

    if (syncedTeamIds.length > 0) {
      await db
        .delete(schema.teams)
        .where(
          and(eq(schema.teams.organization_id, org.id), notInArray(schema.teams.id, syncedTeamIds)),
        );
    } else {
      await db.delete(schema.teams).where(eq(schema.teams.organization_id, org.id));
    }

    await db
      .update(schema.organizations)
      .set({ synced_at: new Date() })
      .where(eq(schema.organizations.id, orgId));

    return { success: true, message: `Synced ${teams.length} teams` };
  } catch (err: unknown) {
    console.error("Org sync error:", err);
    throw createError({
      statusCode: 500,
      message: "Failed to sync organization",
    });
  }
});
