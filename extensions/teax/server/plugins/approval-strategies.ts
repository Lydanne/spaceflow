import { registerStrategy } from "~~/server/services/approval-flow/registry";
import { scenePermissionStrategy } from "~~/server/services/approval-flow/strategies/scene-permission";

export default defineNitroPlugin(() => {
  // 注册场景权限申请策略
  registerStrategy(scenePermissionStrategy);

  console.log("[ApprovalFlow] Strategies registered");
});
