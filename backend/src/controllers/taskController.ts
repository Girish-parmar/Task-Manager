import type { Request, Response } from "express";
import { prisma } from "../config/prismaClient";
import { createTaskSchema, updateTaskSchema } from "../validators/taskValidators";
import { NotFoundError } from "../errors/AppError";
import { emitTaskUpdated } from "../sockets/taskEvents";

export async function listTasks(req: Request, res: Response) {
  const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
  const tasks = await prisma.task.findMany({
    where: statusFilter ? { status: statusFilter as never } : undefined,
    include: { assignedWorker: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ tasks });
}

export async function getTask(req: Request, res: Response) {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      assignedWorker: { select: { id: true, name: true, email: true } },
      nextBranch: true,
      previousBranch: true,
    },
  });
  if (!task) {
    throw new NotFoundError("Task not found");
  }
  res.json({ task });
}

export async function createTask(req: Request, res: Response) {
  const input = createTaskSchema.parse(req.body);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: input.title,
        requiredTags: input.requiredTags,
        location: input.location,
        durationDays: input.durationDays,
        nextBranchId: input.nextBranchId,
      },
    });
    await tx.auditLog.create({
      data: {
        taskId: created.id,
        performedByUid: req.user!.id,
        action: "TASK_CREATED",
      },
    });
    return created;
  });

  emitTaskUpdated(task);
  res.status(201).json({ task });
}

export async function updateTask(req: Request, res: Response) {
  const input = updateTaskSchema.parse(req.body);

  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    throw new NotFoundError("Task not found");
  }

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id: req.params.id }, data: input });
    await tx.auditLog.create({
      data: {
        taskId: updated.id,
        performedByUid: req.user!.id,
        action: "TASK_UPDATED",
        metadata: input,
      },
    });
    return updated;
  });

  emitTaskUpdated(task);
  res.json({ task });
}
