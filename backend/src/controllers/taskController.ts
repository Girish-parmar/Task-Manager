import type { Request, Response } from "express";
import { prisma } from "../config/prismaClient";
import { createTaskSchema, taskStatusQuerySchema, updateTaskSchema } from "../validators/taskValidators";
import { NotFoundError } from "../errors/AppError";
import { emitTaskUpdated } from "../sockets/taskEvents";
import { tagList } from "../utils/tags";

export async function listTasks(req: Request, res: Response) {
  const statusFilter = taskStatusQuerySchema.parse(
    typeof req.query.status === "string" ? req.query.status : undefined,
  );
  const tasks = await prisma.task.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: { assignedWorker: { select: { id: true, name: true, email: true } }, requiredTags: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ tasks: tasks.map((task) => ({ ...task, requiredTags: tagList(task.requiredTags) })) });
}

export async function getTask(req: Request, res: Response) {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      assignedWorker: { select: { id: true, name: true, email: true } },
      requiredTags: true,
      nextBranch: { include: { requiredTags: true } },
      previousBranch: { include: { requiredTags: true } },
    },
  });
  if (!task) {
    throw new NotFoundError("Task not found");
  }
  res.json({
    task: {
      ...task,
      requiredTags: tagList(task.requiredTags),
      nextBranch: task.nextBranch ? { ...task.nextBranch, requiredTags: tagList(task.nextBranch.requiredTags) } : task.nextBranch,
      previousBranch: task.previousBranch
        ? { ...task.previousBranch, requiredTags: tagList(task.previousBranch.requiredTags) }
        : task.previousBranch,
    },
  });
}

export async function createTask(req: Request, res: Response) {
  const input = createTaskSchema.parse(req.body);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: input.title,
        requiredTags: { create: input.requiredTags.map((tag) => ({ tag })) },
        location: input.location,
        durationDays: input.durationDays,
        nextBranchId: input.nextBranchId,
      },
      include: { requiredTags: true },
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

  const serialized = { ...task, requiredTags: tagList(task.requiredTags) };
  emitTaskUpdated(serialized);
  res.status(201).json({ task: serialized });
}

export async function updateTask(req: Request, res: Response) {
  const input = updateTaskSchema.parse(req.body);
  const { requiredTags, ...rest } = input;

  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    throw new NotFoundError("Task not found");
  }

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(requiredTags !== undefined
          ? { requiredTags: { deleteMany: {}, create: requiredTags.map((tag) => ({ tag })) } }
          : {}),
      },
      include: { requiredTags: true },
    });
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

  const serialized = { ...task, requiredTags: tagList(task.requiredTags) };
  emitTaskUpdated(serialized);
  res.json({ task: serialized });
}
