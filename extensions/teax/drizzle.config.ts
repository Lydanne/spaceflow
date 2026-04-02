import { defineConfig } from "drizzle-kit";

const resolveDatabaseUrl = () => {
  if (process.env.NUXT_DATABASE_URL) {
    return process.env.NUXT_DATABASE_URL;
  }
  const user = process.env.NUXT_POSTGRES_USER || "postgres";
  const password = process.env.NUXT_POSTGRES_PASSWORD || "postgres";
  const host = process.env.NUXT_POSTGRES_HOST || "localhost";
  const port = process.env.NUXT_POSTGRES_PORT || "5432";
  const database = process.env.NUXT_POSTGRES_DB || "teax";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

export default defineConfig({
  schema: "./server/db/schema/index.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
