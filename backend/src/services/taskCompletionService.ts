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

  const completedTask = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.COMPLETED, completedDate: new Date() },
    });

    // Completion frees up the days that were reserved on assignment - without
    // this, a worker's capacity only ever goes down and they eventually
    // become ineligible for every task.
    if (task.assignedUid) {
      await tx.worker.update({
        where: { id: task.assignedUid },
        data: { availableCapacity: { increment: task.durationDays } },
      });
    }

    await tx.auditLog.create({
      data: {
        taskId: task.id,
        performedByUid: actor.id,
        action: "BRANCH_COMPLETED",
      },
    });

    return updated;
  });

  if (!task.nextBranchId) {
    return { task: completedTask, nextBranch: null };
  }

  // allocateWorkerForTask requires PENDING (its own transaction moves it to
  // ACTIVE+assigned on success). Only if no eligible worker is found do we
  // force it to ACTIVE unassigned, so it's still visible for manual pickup -
  // that fallback is itself a state change, so it gets its own transactional
  // audit row rather than mutating the row silently.
  let nextBranch: Task;
  try {
    const { task: allocated } = await allocateWorkerForTask(task.nextBranchId, actor.id);
    nextBranch = allocated;
  } catch (err) {
    if (!(err instanceof NoEligibleWorkerError)) {
      throw err;
    }
    const nextBranchId = task.nextBranchId;
    nextBranch = await prisma.$transaction(async (tx) => {
      const activated = await tx.task.update({
        where: { id: nextBranchId },
        data: { status: TaskStatus.ACTIVE },
      });
      await tx.auditLog.create({
        data: {
          taskId: activated.id,
          performedByUid: actor.id,
          action: "BRANCH_ACTIVATED_UNASSIGNED",
          metadata: { reason: "no_eligible_worker" },
        },
      });
      return activated;
    });
  }

  return { task: completedTask, nextBranch };
}
