import { afterAll, describe, expect, it } from "vitest";
import { Client, db, newAdmin, newUser } from "./helpers";

afterAll(() => db.end());

describe("admin dashboard", () => {
  it("renders for admins with stats, user search, and logs suspensions", async () => {
    const admin = await newAdmin();
    const target = await newUser("findme");
    const tid = (await db.query("select id from users where email=$1", [target.email])).rows[0].id;
    expect((await admin.get("/admin")).status).toBe(200);
    const search = await admin.get(`/admin/users?q=${encodeURIComponent(target.email)}`);
    expect(search.status).toBe(200);
    expect(search.text).toContain(target.email);
    const none = await admin.get("/admin/users?q=zzz-no-such-user-zzz");
    expect(none.text).not.toContain(target.email);
    expect((await admin.get(`/admin/users?q=${encodeURIComponent("' or 1=1 --")}`)).status).toBe(200);

    expect((await admin.patch(`/api/admin/users/${tid}`, { suspended: true })).status).toBe(200);
    expect((await target.get("/api/forms")).status).toBe(401);
    const act = await admin.get("/admin/activity");
    expect(act.status).toBe(200);
    expect(act.text).toMatch(/suspend/i);
    expect((await admin.patch(`/api/admin/users/${tid}`, { suspended: false })).status).toBe(200);
    expect((await target.post("/api/auth/login", { email: target.email, password: "Password123!x" })).status).toBe(200);
  });
});
