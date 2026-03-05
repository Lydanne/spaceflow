import { pgTable, uuid, varchar, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./user";

export const serviceTokens = pgTable(
  "service_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    encryptedToken: text("encrypted_token").notNull(),
    giteaUsername: varchar("gitea_username", { length: 255 }).notNull(),
    tokenHint: varchar("token_hint", { length: 20 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique("service_tokens_username").on(table.giteaUsername)],
);
