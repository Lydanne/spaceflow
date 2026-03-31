import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { resolveOrgId } from "~~/server/utils/resolve-org";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { z } from "zod";
import { notifyRuleSchema } from "~~/server/shared/dto/repository.dto";
import type { OrgNotifySettings } from "~~/shared/notify-rules";

// 组织级默认通知规则（仅影响未配置仓库规则的仓库）
const updateOrgSettingsBodySchema = z.object({
  notifyRules: z.array(notifyRuleSchema).max(20).optional(),
});

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  const body = await readValidatedBody(event, updateOrgSettingsBodySchema.parse);

  const [org] = await db
    .select({ settings: schema.organizations.settings })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1);

  if (!org) {
    throw createError({ statusCode: 404, message: "Organization not found" });
  }

  const currentSettings = (org.settings || {}) as OrgNotifySettings;
  // 仅覆盖请求体显式传入的字段，避免误清空其他设置项。
  const newSettings: OrgNotifySettings = { ...currentSettings };

  if (body.notifyRules !== undefined) newSettings.notifyRules = body.notifyRules;

  const [updated] = await db
    .update(schema.organizations)
    .set({ settings: newSettings, updated_at: new Date() })
    .where(eq(schema.organizations.id, orgId))
    .returning({
      id: schema.organizations.id,
      settings: schema.organizations.settings,
      updated_at: schema.organizations.updated_at,
    });

  return { data: updated };
});
