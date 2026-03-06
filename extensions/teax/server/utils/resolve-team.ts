import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { H3Event } from "h3";
import { resolveOrgId } from "./resolve-org";

/**
 * 从路由参数 orgName + teamName 解析出 teamId 和 orgId。
 * 路由目录为 /api/orgs/[orgName]/teams/[teamName]/...
 * 找不到时抛 404。
 */
export async function resolveTeamId(event: H3Event): Promise<{
  teamId: string;
  orgId: string;
  orgName: string;
  teamName: string;
}> {
  const { orgId, orgName } = await resolveOrgId(event);

  const teamName = getRouterParam(event, "teamName");
  if (!teamName) {
    throw createError({ statusCode: 400, message: "Missing teamName" });
  }

  const db = useDB();
  const [team] = await db
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(
      and(
        eq(schema.teams.organization_id, orgId),
        eq(schema.teams.name, teamName),
      ),
    )
    .limit(1);

  if (!team) {
    throw createError({ statusCode: 404, message: "Team not found" });
  }

  return { teamId: team.id, orgId, orgName, teamName };
}
