import { defineConfig } from 'drizzle-kit';

// Only used to generate SQL migrations from the schema (`pnpm db:generate`).
// Migrations are applied by Wrangler (`pnpm db:migrate`), so no database credentials live here.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './migrations',
});
