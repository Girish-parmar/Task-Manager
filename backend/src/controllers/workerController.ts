import type { Request, Response } from "express";
import { prisma } from "../config/prismaClient";
import { updateWorkerSchema } from "../validators/workerValidators";
import { NotFoundError } from "../errors/AppError";

export async function listWorkers(_req: Request, res: Response) {
  const workers = await prisma.worker.findMany({ orderBy: { name: "asc" } });
  res.json({
    workers: workers.map(({ passwordHash: _passwordHash, ...worker }) => worker),
  });
}

export async function getWorker(req: Request, res: Response) {
  const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
  if (!worker) {
    throw new NotFoundError("Worker not found");
  }
  const { passwordHash: _passwordHash, ...publicWorker } = worker;
  res.json({ worker: publicWorker });
}

export async function updateWorker(req: Request, res: Response) {
  const input = updateWorkerSchema.parse(req.body);

  const existing = await prisma.worker.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    throw new NotFoundError("Worker not found");
  }

  const worker = await prisma.worker.update({ where: { id: req.params.id }, data: input });
  const { passwordHash: _passwordHash, ...publicWorker } = worker;
  res.json({ worker: publicWorker });
}
