// Usage: npm run make-admin -- you@example.com   (promotes an existing account to administrator)
import pg from "pg";
import fs from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- you@example.com");
  process.exit(1);
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
const res = await client.query("update users set role = 'admin' where email = $1 returning email", [email]);
await client.end();
console.log(res.rowCount ? `✅ ${email} is now an administrator` : `No account found for ${email}. Sign up first, then run this again.`);
process.exit(res.rowCount ? 0 : 1);
