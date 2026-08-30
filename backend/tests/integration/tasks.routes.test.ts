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

async function createManagerAndGetCookie() {
  const email = `manager-${Math.random()}@test.dev`;
  const password = "supersecret1";
  await testPrisma.worker.create({
    data: {
      name: "Manager",
      email,
      passwordHash: await hashPassword(password),
      role: WorkerRole.MANAGER,
      type: WorkerType.INTERNAL,
      location: "New York",
      tags: { create: [].map((tag) => ({ tag })) },
      availableCapacity: 5,
    },
  });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return { cookie: res.headers["set-cookie"] };
}

describe("task routes", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("requires authentication for task routes", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(401);
  });

  it("creates and lists a task", async () => {
    const { cookie } = await signupAndGetCookie();

    const createRes = await request(app)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({ title: "Fix router", requiredTags: ["IT"], location: "New York", durationDays: 2 });
    expect(createRes.status).toBe(201);
    expect(createRes.body.task.title).toBe("Fix router");

    const listRes = await request(app).get("/api/tasks").set("Cookie", cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.tasks).toHaveLength(1);
  });

  it("returns 400 for an invalid status filter instead of a 500", async () => {
    const { cookie } = await signupAndGetCookie();
    const res = await request(app).get("/api/tasks?status=NOT_A_REAL_STATUS").set("Cookie", cookie);
    expect(res.status).toBe(400);
  });

  it("filters tasks by a valid status", async () => {
    const { cookie } = await signupAndGetCookie();
    await request(app)
      .post("/api/tasks")
      .set("Cookie", cookie)
      .send({ title: "Pending task", requiredTags: [], durationDays: 1 });

    const res = await request(app).get("/api/tasks?status=PENDING").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
  });

  describe("POST /api/tasks/:id/auto-assign", () => {
    it("auto-assigns an eligible worker and returns 200", async () => {
      const { cookie } = await signupAndGetCookie();
      await testPrisma.worker.create({
        data: {
          name: "Eligible Worker",
          email: "eligible@test.dev",
          passwordHash: "hash",
          type: WorkerType.INTERNAL,
          location: "New York",
          tags: { create: ["IT"].map((tag) => ({ tag })) },
          availableCapacity: 5,
        },
      });

      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "IT task", requiredTags: ["IT"], location: "New York", durationDays: 2 });

      const res = await request(app)
        .post(`/api/tasks/${createRes.body.task.id}/auto-assign`)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe("ACTIVE");
      expect(res.body.worker.email).toBe("eligible@test.dev");
    });

    it("returns 404 for an unknown task", async () => {
      const { cookie } = await signupAndGetCookie();
      const res = await request(app)
        .post("/api/tasks/00000000-0000-0000-0000-000000000000/auto-assign")
        .set("Cookie", cookie);
      expect(res.status).toBe(404);
    });

    it("returns 409 when the task is already assigned", async () => {
      const { cookie } = await signupAndGetCookie();
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "IT task", requiredTags: ["IT"], location: "New York", durationDays: 2 });

      await testPrisma.worker.create({
        data: {
          name: "Eligible Worker",
          email: "eligible2@test.dev",
          passwordHash: "hash",
          type: WorkerType.INTERNAL,
          location: "New York",
          tags: { create: ["IT"].map((tag) => ({ tag })) },
          availableCapacity: 5,
        },
      });

      await request(app).post(`/api/tasks/${createRes.body.task.id}/auto-assign`).set("Cookie", cookie);
      const secondAttempt = await request(app)
        .post(`/api/tasks/${createRes.body.task.id}/auto-assign`)
        .set("Cookie", cookie);

      expect(secondAttempt.status).toBe(409);
    });

    it("returns 422 when no eligible worker exists", async () => {
      const { cookie } = await signupAndGetCookie();
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Impossible task", requiredTags: ["Nonexistent"], location: "Nowhere", durationDays: 2 });

      const res = await request(app)
        .post(`/api/tasks/${createRes.body.task.id}/auto-assign`)
        .set("Cookie", cookie);

      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/tasks/:id/assign", () => {
    it("manually assigns a chosen worker regardless of the matching algorithm, as a MANAGER", async () => {
      const { cookie } = await createManagerAndGetCookie();
      const worker = await testPrisma.worker.create({
        data: {
          name: "Manually Chosen",
          email: "manual@test.dev",
          passwordHash: "hash",
          type: WorkerType.INTERNAL,
          location: "Nowhere",
          tags: { create: [].map((tag) => ({ tag })) },
          availableCapacity: 5,
        },
      });
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Impossible task", requiredTags: ["Nonexistent"], location: "Nowhere", durationDays: 2 });

      const res = await request(app)
        .post(`/api/tasks/${createRes.body.task.id}/assign`)
        .set("Cookie", cookie)
        .send({ workerId: worker.id });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe("ACTIVE");
      expect(res.body.worker.id).toBe(worker.id);

      const refreshedWorker = await testPrisma.worker.findUniqueOrThrow({ where: { id: worker.id } });
      expect(refreshedWorker.availableCapacity).toBe(3);
    });

    it("returns 403 when a MEMBER attempts a manual assignment", async () => {
      const { cookie } = await signupAndGetCookie();
      const worker = await testPrisma.worker.create({
        data: {
          name: "Manually Chosen",
          email: "manual2@test.dev",
          passwordHash: "hash",
          type: WorkerType.INTERNAL,
          location: "Nowhere",
          tags: { create: [].map((tag) => ({ tag })) },
          availableCapacity: 5,
        },
      });
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Impossible task", requiredTags: ["Nonexistent"], location: "Nowhere", durationDays: 2 });

      const res = await request(app)
        .post(`/api/tasks/${createRes.body.task.id}/assign`)
        .set("Cookie", cookie)
        .send({ workerId: worker.id });

      expect(res.status).toBe(403);
    });

    it("returns 409 when the chosen worker does not have enough capacity", async () => {
      const { cookie } = await createManagerAndGetCookie();
      const worker = await testPrisma.worker.create({
        data: {
          name: "Under-capacity Worker",
          email: "undercapacity@test.dev",
          passwordHash: "hash",
          type: WorkerType.INTERNAL,
          location: "Nowhere",
          tags: { create: [].map((tag) => ({ tag })) },
          availableCapacity: 1,
        },
      });
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Long task", requiredTags: [], location: "Nowhere", durationDays: 2 });

      const res = await request(app)
        .post(`/api/tasks/${createRes.body.task.id}/assign`)
        .set("Cookie", cookie)
        .send({ workerId: worker.id });

      expect(res.status).toBe(409);
    });
  });
});
