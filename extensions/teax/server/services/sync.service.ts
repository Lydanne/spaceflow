import { eq } from 'drizzle-orm'
import { useDB, schema } from '../db'
import { createGiteaService } from '../utils/gitea'

export async function syncUserOrgsAndTeams(accessToken: string, _userId: string) {
  const gitea = createGiteaService(accessToken)
  const db = useDB()

  const orgs = await gitea.getUserOrgs()

  for (const org of orgs) {
    const [dbOrg] = await db
      .insert(schema.organizations)
      .values({
        giteaOrgId: org.id,
        name: org.name,
        displayName: org.full_name || org.name,
        avatarUrl: org.avatar_url,
        syncedAt: new Date()
      })
      .onConflictDoUpdate({
        target: schema.organizations.giteaOrgId,
        set: {
          name: org.name,
          displayName: org.full_name || org.name,
          avatarUrl: org.avatar_url,
          syncedAt: new Date()
        }
      })
      .returning()

    const teams = await gitea.getOrgTeams(org.name)

    for (const team of teams) {
      const [dbTeam] = await db
        .insert(schema.teams)
        .values({
          organizationId: dbOrg.id,
          giteaTeamId: team.id,
          name: team.name,
          description: team.description,
          syncedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [schema.teams.organizationId, schema.teams.giteaTeamId],
          set: {
            name: team.name,
            description: team.description,
            syncedAt: new Date()
          }
        })
        .returning()

      const members = await gitea.getTeamMembers(team.id)

      for (const member of members) {
        const [memberUser] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.giteaId, member.id))
          .limit(1)

        if (memberUser) {
          await db
            .insert(schema.teamMembers)
            .values({
              teamId: dbTeam.id,
              userId: memberUser.id,
              role: 'member'
            })
            .onConflictDoNothing()
        }
      }
    }
  }
}
