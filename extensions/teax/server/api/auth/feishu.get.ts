import { buildFeishuAuthUrl } from "~~/server/utils/feishu";

export default defineEventHandler(async (event) => {
  const state = generateState();
  const authUrl = buildFeishuAuthUrl(state);
  return sendRedirect(event, authUrl);
});

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b: number) => b.toString(16).padStart(2, "0")).join("");
}
