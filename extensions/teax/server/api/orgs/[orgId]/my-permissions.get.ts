import { requireAuth } from "../../../utils/auth";
import { getUserPermissions } from "../../../utils/permission";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }

  const session = await requireAuth(event);

  // 管理员拥有所有权限
  if (session.user.isAdmin) {
    return {
      data: {
        isAdmin: true,
        permissions: ["*"],
      },
    };
  }

  const permissions = await getUserPermissions(session.user.id, orgId);

  return {
    data: {
      isAdmin: false,
      permissions,
    },
  };
});
