import { encodeStackEntry } from "../stack";
import type { CardJSON } from "../types";

export async function renderCardPage(
  ctx: { openId: string },
  page: string,
  params?: Record<string, unknown>,
): Promise<CardJSON | undefined> {
  const { getRouter } = await import("../register");
  const cardRouter = await getRouter();

  return cardRouter.dispatch({
    openId: ctx.openId,
    actionValue: JSON.stringify({
      __stack: [encodeStackEntry(page, params ?? {})],
    }),
    token: "",
    updateCard: async () => {},
  });
}
