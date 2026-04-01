import { registerPresetWorkflowConsumer } from "~~/server/queue-services/preset-workflow";

export default defineNitroPlugin(() => {
  registerPresetWorkflowConsumer();
  console.log("[Queue] Consumers registered");
});
