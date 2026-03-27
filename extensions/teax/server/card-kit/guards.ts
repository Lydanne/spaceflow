import { EnhancedCardBuilder } from "./builder";
import { navigateTo, type BeforeEnterGuard } from "./shared";

/**
 * 守卫：要求用户已绑定飞书账号。
 * 未绑定时跳转到统一提示页面。
 */
export function requireBinding(): BeforeEnterGuard {
  return async (ctx) => {
    const { getActiveAccount } = await import("~~/server/services/account.service");
    const user = await getActiveAccount(ctx.openId);
    if (!user) {
      return navigateTo("binding-required", {
        from: ctx.to.page,
      }, {
        mode: "replace",
      });
    }

    ctx.provide(requireBinding, user);
  };
}

/**
 * 守卫：要求用户对仓库拥有指定权限。
 * 从 params 中读取 owner/repo（或 repoFullName）定位仓库。
 * @param permission - 权限标识，如 "actions:trigger"
 */
export function requireRepoPermission(permission: string): BeforeEnterGuard {
  return async ({ openId, to }) => {
    const { getActiveAccount } = await import("~~/server/services/account.service");
    const { queryUserPermissionGroups, rowGrantsPermission } = await import("~~/server/utils/permission");
    const { useDB, schema } = await import("~~/server/db");
    const { eq } = await import("drizzle-orm");

    const user = await getActiveAccount(openId);
    if (!user) return;

    let fullName: string;
    if (to.params.owner && to.params.repo) {
      fullName = `${to.params.owner}/${to.params.repo}`;
    } else if (to.params.repoFullName) {
      fullName = to.params.repoFullName as string;
    } else {
      return;
    }

    const db = useDB();
    const [repoRecord] = await db
      .select({ id: schema.repositories.id, organization_id: schema.repositories.organization_id })
      .from(schema.repositories)
      .where(eq(schema.repositories.full_name, fullName))
      .limit(1);

    if (!repoRecord) {
      return new EnhancedCardBuilder({ title: "❌ 仓库不存在", theme: "red" }, "")
        .text("该仓库未在系统中注册", true)
        .build();
    }

    const groups = await queryUserPermissionGroups(user.id, repoRecord.organization_id);
    const hasPermission = groups.some((g) => rowGrantsPermission(g, permission, repoRecord.id));
    if (!hasPermission) {
      return new EnhancedCardBuilder({ title: "❌ 无权限", theme: "red" }, "")
        .text(`您没有执行此操作的权限 (${permission})`, true)
        .build();
    }
  };
}
