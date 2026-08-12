import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { WorkerRole } from "@prisma/client";
import { authenticate, authorize } from "../../src/middlewares/auth";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { asyncHandler } from "../../src/middlewares/asyncHandler";

function buildTestApp() {
  const app = express();
  app.use(cookieParser());

  app.get(
    "/protected",
    authenticate,
    asyncHandler(async (req, res) => {
      res.json({ user: req.user });
    }),
  );

  app.get(
    "/admin-only",
    authenticate,
    authorize(WorkerRole.ADMIN),
    asyncHandler(async (_req, res) => {
      res.json({ ok: true });
    }),
  );

  app.use(errorHandler);
  return app;
}

function signTestToken(payload: object, options: jwt.SignOptions = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, options);
}

describe("auth middleware", () => {
  const app = buildTestApp();
  const validPayload = { id: "worker-1", email: "a@test.dev", role: WorkerRole.MEMBER };

  it("rejects requests with no token", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
  });

  it("accepts a valid token and attaches req.user", async () => {
    const token = signTestToken(validPayload, { expiresIn: "1h" });
    const res = await request(app).get("/protected").set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: "worker-1", email: "a@test.dev", role: "MEMBER" });
  });

  it("rejects an expired token", async () => {
    const token = signTestToken(validPayload, { expiresIn: "-1s" });
    const res = await request(app).get("/protected").set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(401);
  });

  it("rejects a tampered/invalid-signature token", async () => {
    const token = jwt.sign(validPayload, "wrong-secret", { expiresIn: "1h" });
    const res = await request(app).get("/protected").set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(401);
  });

  it("returns 403 for authorize() when role does not match", async () => {
    const token = signTestToken({ ...validPayload, role: WorkerRole.MEMBER }, { expiresIn: "1h" });
    const res = await request(app).get("/admin-only").set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(403);
  });

  it("returns 200 for authorize() when role matches", async () => {
    const token = signTestToken({ ...validPayload, role: WorkerRole.ADMIN }, { expiresIn: "1h" });
    const res = await request(app).get("/admin-only").set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(200);
  });
});
