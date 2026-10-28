// Starts the production server with test settings, runs the integration tests, stops the server.
// Usage: npm run build && npm run test:integration
import { spawn } from "node:child_process";
import fs from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!fs.existsSync(".next/BUILD_ID")) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(1);
}
const PORT = process.env.TEST_PORT || "3100";
const MOCK = process.env.TEST_MOCK_PORT || "4010";
const env = {
  ...process.env,
  PORT,
  NODE_ENV: "production",
  ALLOW_PRIVATE_WEBHOOKS: "true", // lets webhook tests target the local mock server
  RESEND_API_KEY: "test-key",
  RESEND_API_URL: `http://localhost:${MOCK}/emails`,
  TEST_BASE_URL: `http://localhost:${PORT}`,
  TEST_MOCK_PORT: MOCK,
};
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", PORT], { env, stdio: "ignore" });
const stop = () => server.kill();
process.on("exit", stop);

async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/login`)).status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
if (!(await ready())) {
  console.error("Server did not start");
  stop();
  process.exit(1);
}
const args = ["node_modules/vitest/vitest.mjs", "run", "tests/integration", ...process.argv.slice(2)];
const tests = spawn(process.execPath, args, { env, stdio: "inherit" });
tests.on("exit", (code) => {
  stop();
  process.exit(code ?? 1);
});
