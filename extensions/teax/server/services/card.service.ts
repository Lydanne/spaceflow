import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import {
  sendFeishuChatCardMessage,
  updateCardMessage,
  type FeishuInteractiveCard,
} from "~~/server/services/messaging";

export async function sendCard(params: {
  chatId: string;
  card: FeishuInteractiveCard;
  cardType: string;
  businessId?: string;
  organizationId?: string;
  userId?: string;
  cardData?: Record<string, unknown>;
}) {
  const db = useDB();

  const result = await sendFeishuChatCardMessage(params.chatId, params.card);

  if (!result.message_id) {
    throw new Error("Failed to send card message");
  }

  const [interaction] = await db
    .insert(schema.cardInteractions)
    .values({
      message_id: result.message_id,
      chat_id: params.chatId,
      card_type: params.cardType,
      business_id: params.businessId,
      organization_id: params.organizationId,
      user_id: params.userId,
      card_data: params.cardData || {},
      status: "pending",
    })
    .returning();

  if (!interaction) {
    throw new Error("Failed to create card interaction record");
  }

  return {
    messageId: result.message_id,
    interactionId: interaction.id,
  };
}

export async function updateCard(params: {
  messageId: string;
  card: FeishuInteractiveCard;
}) {
  await updateCardMessage(params.messageId, params.card);
}

export async function getInteraction(messageId: string) {
  const db = useDB();
  const [interaction] = await db
    .select()
    .from(schema.cardInteractions)
    .where(eq(schema.cardInteractions.message_id, messageId))
    .limit(1);

  return interaction;
}

export async function updateInteractionStatus(
  messageId: string,
  status: string,
  interactionData?: Record<string, unknown>,
) {
  const db = useDB();
  await db
    .update(schema.cardInteractions)
    .set({
      status,
      interaction_data: interactionData,
      interacted_at: new Date(),
    })
    .where(eq(schema.cardInteractions.message_id, messageId));
}
