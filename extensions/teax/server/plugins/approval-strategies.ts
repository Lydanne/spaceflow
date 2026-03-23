import { registerStrategy } from "~~/server/services/approval-flow/registry";
import { scenePermissionStrategy } from "~~/server/services/approval-flow/strategies/scene-permission";
import { presetUnlockStrategy } from "~~/server/services/approval-flow/strategies/preset-unlock";

export default defineNitroPlugin(() => {
  // 注册场景权限申请策略
  registerStrategy(scenePermissionStrategy);
  // 注册预设解锁申请策略
  registerStrategy(presetUnlockStrategy);

  console.log("[ApprovalFlow] Strategies registered");
});
