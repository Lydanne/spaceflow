import { eq, and, notInArray } from "drizzle-orm";
import { useDB, schema } from "../../../db";
import { requireOrgOwnerOrAdmin } from "../../../utils/org-owner";
import { createServiceGiteaClient } from "../../../utils/gitea";

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
          organizationId: org.id,
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
      syncedTeamIds.push(dbTeam.id);

      const members = await gitea.getTeamMembersAll(team.id);
      const syncedMemberUserIds: string[] = [];

      for (const member of members) {
        const [memberUser] = await db
          .insert(schema.users)
          .values({
            giteaId: member.id,
            giteaUsername: member.login,
            email: member.email || `${member.login}@placeholder`,
            avatarUrl: member.avatar_url,
          })
          .onConflictDoUpdate({
            target: schema.users.giteaId,
            set: {
              giteaUsername: member.login,
              avatarUrl: member.avatar_url,
              ...(member.email ? { email: member.email } : {}),
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.users.id });

        if (memberUser) {
          await db
            .insert(schema.teamMembers)
            .values({
              teamId: dbTeam.id,
              userId: memberUser.id,
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
              eq(schema.teamMembers.teamId, dbTeam.id),
              notInArray(schema.teamMembers.userId, syncedMemberUserIds),
            ),
          );
      } else {
        await db.delete(schema.teamMembers).where(eq(schema.teamMembers.teamId, dbTeam.id));
      }
    }

    if (syncedTeamIds.length > 0) {
      await db
        .delete(schema.teams)
        .where(
          and(eq(schema.teams.organizationId, org.id), notInArray(schema.teams.id, syncedTeamIds)),
        );
    } else {
      await db.delete(schema.teams).where(eq(schema.teams.organizationId, org.id));
    }

    await db
      .update(schema.organizations)
      .set({ syncedAt: new Date() })
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
