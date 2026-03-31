import { z } from "zod";

export const recentCommitItemSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author_name: z.string(),
  author_email: z.string(),
  date: z.string(),
  html_url: z.string(),
  project_name: z.string(),
  project_full_name: z.string(),
});
export type RecentCommitItemDto = z.infer<typeof recentCommitItemSchema>;

export const recentCommitsResponseSchema = z.object({
  data: z.array(recentCommitItemSchema),
});
export type RecentCommitsResponseDto = z.infer<typeof recentCommitsResponseSchema>;

export const repoCountResponseSchema = z.object({
  count: z.number(),
});
export type RepoCountResponseDto = z.infer<typeof repoCountResponseSchema>;
