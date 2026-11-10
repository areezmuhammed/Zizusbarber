import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // CI passes the same vars in the environment
const PORT = 3107; // avoids 3000 and the Supabase 54xxx/56xxx ranges

export default defineConfig({
  testDir: "e2e",
  // spec files share one barber and its slots, so they must not run at the same time
  workers: 1,
  fullyParallel: false,
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 375, height: 812 } },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    // analytics on (with an empty inline script, so nothing is fetched) to test which routes render it
    env: { PLAUSIBLE_DOMAIN: "e2e.invalid", PLAUSIBLE_SRC: "data:text/javascript," },
  },
});
