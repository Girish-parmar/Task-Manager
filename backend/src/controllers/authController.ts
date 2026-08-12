import type { CookieOptions, Request, Response } from "express";
import { prisma } from "../config/prismaClient";
import { env } from "../config/env";
import { hashPassword, comparePassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { loginSchema, signupSchema } from "../validators/authValidators";
import { ConflictError, UnauthorizedError } from "../errors/AppError";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

function toPublicWorker(worker: { id: string; name: string; email: string; role: string; type: string; location: string; tags: string[]; availableCapacity: number }) {
  return {
    id: worker.id,
    name: worker.name,
    email: worker.email,
    role: worker.role,
    type: worker.type,
    location: worker.location,
    tags: worker.tags,
    availableCapacity: worker.availableCapacity,
  };
}

export async function signup(req: Request, res: Response) {
  const input = signupSchema.parse(req.body);

  const existing = await prisma.worker.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const worker = await prisma.worker.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      type: input.type,
      location: input.location,
      tags: input.tags,
      availableCapacity: input.availableCapacity,
    },
  });

  const token = signToken({ id: worker.id, email: worker.email, role: worker.role });
  res.cookie("token", token, cookieOptions());
  res.status(201).json({ worker: toPublicWorker(worker) });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);

  const worker = await prisma.worker.findUnique({ where: { email: input.email } });
  if (!worker) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const valid = await comparePassword(input.password, worker.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const token = signToken({ id: worker.id, email: worker.email, role: worker.role });
  res.cookie("token", token, cookieOptions());
  res.json({ worker: toPublicWorker(worker) });
}

export function logout(_req: Request, res: Response) {
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions();
  res.clearCookie("token", clearOptions);
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  const worker = await prisma.worker.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json({ worker: toPublicWorker(worker) });
}
