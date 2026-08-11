import request from "supertest";
import { createApp } from "../../src/app";
import { truncateAll, testPrisma } from "../setup/testDb";

const app = createApp();

describe("auth routes", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  const signupPayload = {
    name: "Jane Doe",
    email: "jane@test.dev",
    password: "supersecret1",
    type: "INTERNAL",
    location: "New York",
    tags: ["IT"],
    availableCapacity: 5,
  };

  it("signs up a new worker, hashes the password, and sets a session cookie", async () => {
    const res = await request(app).post("/api/auth/signup").send(signupPayload);

    expect(res.status).toBe(201);
    expect(res.body.worker.email).toBe(signupPayload.email);
    expect(res.body.worker.passwordHash).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/token=/);

    const stored = await testPrisma.worker.findUniqueOrThrow({ where: { email: signupPayload.email } });
    expect(stored.passwordHash).not.toBe(signupPayload.password);
  });

  it("rejects signup with a duplicate email", async () => {
    await request(app).post("/api/auth/signup").send(signupPayload);
    const res = await request(app).post("/api/auth/signup").send(signupPayload);
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials", async () => {
    await request(app).post("/api/auth/signup").send(signupPayload);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: signupPayload.email, password: signupPayload.password });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/token=/);
  });

  it("rejects login with an incorrect password", async () => {
    await request(app).post("/api/auth/signup").send(signupPayload);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: signupPayload.email, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("returns the current worker from /me when authenticated", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(signupPayload);
    const cookie = signupRes.headers["set-cookie"];

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.worker.email).toBe(signupPayload.email);
  });

  it("rejects /me without a session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
