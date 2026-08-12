import type { Request, Response } from "express";
import { WorkerRole } from "@prisma/client";
import { prisma } from "../config/prismaClient";
import { ForbiddenError } from "../errors/AppError";

export async function listAuditLogs(req: Request, res: Response) {
  const taskId = typeof req.query.taskId === "string" ? req.query.taskId : undefined;

  if (!taskId) {
    const isManagerOrAdmin = req.user!.role === WorkerRole.ADMIN || req.user!.role === WorkerRole.MANAGER;
    if (!isManagerOrAdmin) {
      throw new ForbiddenError("Only managers and admins can view the full audit log");
    }
  }

  const logs = await prisma.auditLog.findMany({
    where: taskId ? { taskId } : undefined,
    include: {
      performedBy: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  res.json({ logs });
}
