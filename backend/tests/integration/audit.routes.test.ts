import request from "supertest";
import { WorkerRole, WorkerType } from "@prisma/client";
import { createApp } from "../../src/app";
import { truncateAll, testPrisma } from "../setup/testDb";
import { hashPassword } from "../../src/utils/password";

const app = createApp();

async function signupAndGetCookie(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({
      name: "Caller",
      email: `caller-${Math.random()}@test.dev`,
      password: "supersecret1",
      type: WorkerType.INTERNAL,
      location: "New York",
      tags: [],
      availableCapacity: 5,
      ...overrides,
    });
  return { cookie: res.headers["set-cookie"], worker: res.body.worker };
}

describe("audit routes", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/audit");
    expect(res.status).toBe(401);
  });

  it("allows a MEMBER to view a specific task's scoped audit trail", async () => {
    const { cookie } = await signupAndGetCookie();
    const createRes = await request(app)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({ title: "Task A", requiredTags: [], durationDays: 1 });

    const res = await request(app).get(`/api/audit?taskId=${createRes.body.task.id}`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThan(0);
  });

  it("forbids a MEMBER from viewing the unfiltered org-wide audit log", async () => {
    const { cookie } = await signupAndGetCookie();
    const res = await request(app).get("/api/audit").set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("allows an ADMIN to view the unfiltered org-wide audit log", async () => {
    const email = "admin@test.dev";
    const password = "supersecret1";
    await testPrisma.worker.create({
      data: {
        name: "Admin",
        email,
        passwordHash: await hashPassword(password),
        role: WorkerRole.ADMIN,
        type: WorkerType.INTERNAL,
        location: "New York",
        tags: { create: [].map((tag) => ({ tag })) },
        availableCapacity: 5,
      },
    });
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });

    const res = await request(app).get("/api/audit").set("Cookie", loginRes.headers["set-cookie"]);
    expect(res.status).toBe(200);
  });
});
