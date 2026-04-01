import { presetWorkflowQueue } from "~~/server/queue-services/preset-workflow";

export default defineNitroPlugin(() => {
  presetWorkflowQueue.register();
  console.log("[Queue] Consumers registered");
});
