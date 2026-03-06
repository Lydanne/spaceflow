import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { resolveOrgId } from "~~/server/utils/resolve-org";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { z } from "zod";

const updateOrgSettingsBodySchema = z.object({
  feishuChatId: z.string().max(255).optional(),
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

  const currentSettings = (org.settings || {}) as Record<string, unknown>;
  const newSettings = { ...currentSettings };

  if (body.feishuChatId !== undefined) newSettings.feishuChatId = body.feishuChatId;

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
