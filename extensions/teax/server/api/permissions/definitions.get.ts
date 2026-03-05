import { PERMISSION_DEFINITIONS, PERMISSION_GROUPS } from "../../shared/permissions";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  return {
    data: {
      groups: PERMISSION_GROUPS,
      permissions: PERMISSION_DEFINITIONS,
    },
  };
});
