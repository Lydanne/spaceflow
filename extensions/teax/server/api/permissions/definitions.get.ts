import { PERMISSION_DEFINITIONS, PERMISSION_GROUPS } from "~~/server/shared/permissions";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  return {
    data: {
      groups: PERMISSION_GROUPS,
      permissions: PERMISSION_DEFINITIONS,
    },
  };
});
