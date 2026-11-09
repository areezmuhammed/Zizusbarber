import { defineConfig } from "@playwright/test";

process.loadEnvFile(".env.local");
const PORT = 3107; // avoids 3000 and the Supabase 54xxx/56xxx ranges

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 375, height: 812 } },
  webServer: { command: `npx next dev -p ${PORT}`, port: PORT, reuseExistingServer: false, timeout: 120_000 },
});
