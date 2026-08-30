import type { Request, Response } from "express";
import { prisma } from "../config/prismaClient";
import { updateWorkerSchema } from "../validators/workerValidators";
import { NotFoundError } from "../errors/AppError";
import { tagList } from "../utils/tags";

export async function listWorkers(_req: Request, res: Response) {
  const workers = await prisma.worker.findMany({ orderBy: { name: "asc" }, include: { tags: true } });
  res.json({
    workers: workers.map(({ passwordHash: _passwordHash, tags, ...worker }) => ({ ...worker, tags: tagList(tags) })),
  });
}

export async function getWorker(req: Request, res: Response) {
  const worker = await prisma.worker.findUnique({ where: { id: req.params.id }, include: { tags: true } });
  if (!worker) {
    throw new NotFoundError("Worker not found");
  }
  const { passwordHash: _passwordHash, tags, ...publicWorker } = worker;
  res.json({ worker: { ...publicWorker, tags: tagList(tags) } });
}

export async function updateWorker(req: Request, res: Response) {
  const input = updateWorkerSchema.parse(req.body);
  const { tags, ...rest } = input;

  const existing = await prisma.worker.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    throw new NotFoundError("Worker not found");
  }

  const worker = await prisma.worker.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(tags !== undefined ? { tags: { deleteMany: {}, create: tags.map((tag) => ({ tag })) } } : {}),
    },
    include: { tags: true },
  });
  const { passwordHash: _passwordHash, tags: workerTags, ...publicWorker } = worker;
  res.json({ worker: { ...publicWorker, tags: tagList(workerTags) } });
}
