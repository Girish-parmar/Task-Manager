import { TaskStatus, type Task } from "@prisma/client";
import { prisma } from "../config/prismaClient";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors/AppError";
import { WorkerRole } from "@prisma/client";
import { allocateWorkerForTask } from "./allocationService";
import { NoEligibleWorkerError } from "../errors/NoEligibleWorkerError";

interface CompleteResult {
  task: Task;
  nextBranch: Task | null;
}

export async function completeTaskBranch(
  taskId: string,
  actor: { id: string; role: WorkerRole },
): Promise<CompleteResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError("Task not found");
  }
  if (task.status !== TaskStatus.ACTIVE) {
    throw new ConflictError("Task is not active");
  }

  const isAssignee = task.assignedUid === actor.id;
  const isManagerOrAdmin = actor.role === WorkerRole.ADMIN || actor.role === WorkerRole.MANAGER;
  if (!isAssignee && !isManagerOrAdmin) {
    throw new ForbiddenError("Only the assigned worker or a manager/admin can complete this task");
  }

  const [completedTask] = await prisma.$transaction([
    prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.COMPLETED, completedDate: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        taskId: task.id,
        performedByUid: actor.id,
        action: "BRANCH_COMPLETED",
      },
    }),
  ]);

  if (!task.nextBranchId) {
    return { task: completedTask, nextBranch: null };
  }

  // allocateWorkerForTask requires PENDING (its own transaction moves it to
  // ACTIVE+assigned on success). Only if no eligible worker is found do we
  // force it to ACTIVE unassigned, so it's still visible for manual pickup.
  let nextBranch: Task;
  try {
    const { task: allocated } = await allocateWorkerForTask(task.nextBranchId, actor.id);
    nextBranch = allocated;
  } catch (err) {
    if (!(err instanceof NoEligibleWorkerError)) {
      throw err;
    }
    nextBranch = await prisma.task.update({
      where: { id: task.nextBranchId },
      data: { status: TaskStatus.ACTIVE },
    });
  }

  return { task: completedTask, nextBranch };
}
