import type { LlmStreamEvent } from "./interfaces";

export interface StreamLoggerState {
  isFirstText: boolean;
}

/**
 * 创建一个新的 StreamLogger 状态
 */
export function createStreamLoggerState(): StreamLoggerState {
  return { isFirstText: true };
}

/**
 * 记录 LLM 流式事件到终端
 * @param event LLM 流式事件
 * @param state 日志状态（用于跟踪是否是第一个文本块）
 */
export function logStreamEvent(event: LlmStreamEvent, state: StreamLoggerState): void {
  switch (event.type) {
    case "text":
      if (state.isFirstText) {
        process.stdout.write("\n🤖 AI: ");
        state.isFirstText = false;
      }
      process.stdout.write(event.content);
      break;
    case "tool_use":
      console.log(`\n🛠️  工具调用: ${event.name}`);
      if (event.title) {
        console.log(`   标题: ${event.title}`);
      }
      console.log(`   输入: ${JSON.stringify(event.input)}`);
      if (event.status) {
        console.log(`   状态: ${event.status}`);
      }
      if (event.output) {
        console.log(
          `   输出: ${event.output.substring(0, 200)}${event.output.length > 200 ? "..." : ""}`,
        );
      }
      state.isFirstText = true;
      break;
    case "thought":
      console.log(`\n💭 思考: ${event.content}`);
      state.isFirstText = true;
      break;
    case "result":
      console.log(`\n✅ 结果已返回`);
      state.isFirstText = true;
      break;
    case "error":
      console.error(`\n❌ 错误: ${event.message}`);
      state.isFirstText = true;
      break;
    case "agent":
      console.log(`\n🤖 子代理: ${event.name}`);
      if (event.source) {
        console.log(
          `   来源: ${event.source.substring(0, 100)}${event.source.length > 100 ? "..." : ""}`,
        );
      }
      state.isFirstText = true;
      break;
    case "subtask":
      console.log(`\n📋 子任务: ${event.description}`);
      console.log(`   代理: ${event.agent}`);
      console.log(
        `   提示: ${event.prompt.substring(0, 100)}${event.prompt.length > 100 ? "..." : ""}`,
      );
      state.isFirstText = true;
      break;
    case "step_start":
      console.log(`\n▶️  步骤开始`);
      state.isFirstText = true;
      break;
    case "step_finish":
      console.log(`\n⏹️  步骤结束: ${event.reason}`);
      if (event.tokens) {
        const tokens = event.tokens as any;
        console.log(
          `   Token: 输入=${tokens.input || 0}, 输出=${tokens.output || 0}, 推理=${tokens.reasoning || 0}`,
        );
      }
      if (event.cost !== undefined) {
        console.log(`   成本: $${event.cost.toFixed(6)}`);
      }
      state.isFirstText = true;
      break;
    case "reasoning":
      console.log(
        `\n🧠 推理: ${event.content.substring(0, 200)}${event.content.length > 200 ? "..." : ""}`,
      );
      state.isFirstText = true;
      break;
  }
}
