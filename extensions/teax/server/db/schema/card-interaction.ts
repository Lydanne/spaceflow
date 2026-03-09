import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./user";
import { organizations } from "./organization";
import { baseColumns } from "./base";

export const cardInteractions = pgTable(
  "card_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organization_id: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    user_id: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    message_id: varchar("message_id", { length: 255 }).notNull().unique(),
    chat_id: varchar("chat_id", { length: 255 }).notNull(),
    open_id: varchar("open_id", { length: 255 }),

    card_type: varchar("card_type", { length: 100 }).notNull(),
    business_id: varchar("business_id", { length: 255 }),
    status: varchar("status", { length: 50 }).default("pending"),

    card_data: jsonb("card_data").default({}),
    interaction_data: jsonb("interaction_data").default({}),

    sent_at: timestamp("sent_at", { withTimezone: true }).defaultNow(),
    interacted_at: timestamp("interacted_at", { withTimezone: true }),

    ...baseColumns(),
  },
  (table) => [
    index("idx_card_message").on(table.message_id),
    index("idx_card_business").on(table.card_type, table.business_id),
    index("idx_card_status").on(table.status),
  ],
);
