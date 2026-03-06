import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { repositories } from "../../db/schema/repository";
import { z } from "zod";

// ─── repositories ────────────────────────────────────────
export const insertRepositorySchema = createInsertSchema(repositories);
export const selectRepositorySchema = createSelectSchema(repositories);
export const updateRepositorySchema = createUpdateSchema(repositories);

export type InsertRepository = z.infer<typeof insertRepositorySchema>;
export type SelectRepository = z.infer<typeof selectRepositorySchema>;
export type UpdateRepository = z.infer<typeof updateRepositorySchema>;

// ─── API response（排除敏感字段） ────────────────────────
export const repositoryResponseSchema = selectRepositorySchema.omit({
  webhook_secret: true,
});
export type RepositoryResponse = z.infer<typeof repositoryResponseSchema>;

// ─── 创建项目 request body ───────────────────────────────
export const createProjectBodySchema = z.object({
  repo_full_name: z.string().min(1).includes("/"),
});
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
