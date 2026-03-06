import { requireAuth } from "~~/server/utils/auth";
import { getUserPermissions } from "~~/server/utils/permission";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }

  const session = await requireAuth(event);

  // 管理员拥有所有权限
  if (session.user.is_admin) {
    return {
      data: {
        is_admin: true,
        permissions: ["*"],
      },
    };
  }

  const permissions = await getUserPermissions(session.user.id, orgId);

  return {
    data: {
      is_admin: false,
      permissions,
    },
  };
});
