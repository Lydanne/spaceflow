import type { CardPageDef } from "~~/server/card-kit/types";
import { cardRouter, registerCommand } from "~~/server/card-kit/register";
import { parseBooleanFlag } from "~~/server/utils/parseRuntimeConfig";

export default defineNitroPlugin(async () => {
  // ━━━ 注册 Card Pages ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const pages = await Promise.all([
    import("~~/server/card-pages/cp-home.page"),
    import("~~/server/card-pages/cp-repos.page"),
    import("~~/server/card-pages/cp-repo-menu.page"),
    import("~~/server/card-pages/cp-actions.page"),
    import("~~/server/card-pages/cp-trigger-wf.page"),
    import("~~/server/card-pages/cp-feature.page"),
    import("~~/server/card-pages/account-home.page"),
    import("~~/server/card-pages/account-guide.page"),
    import("~~/server/card-pages/account-unbound.page"),
    import("~~/server/card-pages/binding-required.page"),
    import("~~/server/card-pages/test-form.page"),
    import("~~/server/card-pages/test-result.page"),
    import("~~/server/card-pages/preset-console.page"),
    import("~~/server/card-pages/preset-list.page"),
    import("~~/server/card-pages/preset-group.page"),
    import("~~/server/card-pages/wf-select.page"),
    import("~~/server/card-pages/wf-params.page"),
    import("~~/server/card-pages/approval-pending.page"),
    import("~~/server/card-pages/help.page"),
    import("~~/server/card-pages/status.page"),
    import("~~/server/card-pages/repos.page"),
    import("~~/server/card-pages/orgs.page"),
    import("~~/server/card-pages/notify.page"),
    import("~~/server/card-pages/approvals.page"),
  ]);
  for (const mod of pages) {
    const def = mod.default;
    if (def?.name) {
      cardRouter.register(def as CardPageDef);
    }
  }

  // ━━━ 注册 Card Commands ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const commands = await Promise.all([
    import("~~/server/card-commands/help.cmd"),
    import("~~/server/card-commands/account.cmd"),
    import("~~/server/card-commands/status.cmd"),
    import("~~/server/card-commands/actions.cmd"),
    import("~~/server/card-commands/repos.cmd"),
    import("~~/server/card-commands/orgs.cmd"),
    import("~~/server/card-commands/notify.cmd"),
    import("~~/server/card-commands/approvals.cmd"),
    import("~~/server/card-commands/presets.cmd"),
    import("~~/server/card-commands/run.cmd"),
    import("~~/server/card-commands/test-form.cmd"),
    import("~~/server/card-commands/preset-link.cmd"),
    import("~~/server/card-commands/preset-group-link.cmd"),
  ]);
  for (const mod of commands) {
    const def = mod.default;
    if (def?.name) {
      registerCommand(def);
    }
  }

  // ━━━ 同步运行时配置 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const config = useRuntimeConfig();
  cardRouter.debug = parseBooleanFlag(config.debug.cardKitDebug, false);

  console.log(
    `[CardKit] Registered ${cardRouter.pageCount} pages, ${commands.length} commands`,
  );
});
