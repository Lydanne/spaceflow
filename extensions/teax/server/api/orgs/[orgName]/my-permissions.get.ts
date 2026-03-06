import { requireAuth } from "~~/server/utils/auth";
import { getUserPermissions } from "~~/server/utils/permission";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);

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
