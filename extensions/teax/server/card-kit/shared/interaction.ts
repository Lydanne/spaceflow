import type { CardInteractionContext } from "../types";

export async function handleCardInteraction(
  ctx: CardInteractionContext,
): Promise<Record<string, unknown> | undefined> {
  const { getRouter } = await import("../register");
  const cardRouter = await getRouter();
  const formVal = (ctx.action.form_value ?? ctx.action.form_values) as
    | Record<string, string>
    | undefined;
  const noop = async () => {};

  const cardResult = await cardRouter.dispatch({
    openId: ctx.openId,
    actionValue: ctx.action.value,
    formValue: formVal,
    token: ctx.token,
    updateCard: ctx.updateCard || noop,
    sendCard: ctx.sendCard,
  });

  if (cardResult) {
    if (ctx.updateCard) {
      await ctx.updateCard(cardResult);
    }
  }

  return undefined;
}
