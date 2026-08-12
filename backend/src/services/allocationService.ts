import { TaskStatus, type Task, type Worker } from "@prisma/client";
import { prisma } from "../config/prismaClient";
import { ConflictError, NotFoundError } from "../errors/AppError";
import { NoEligibleWorkerError } from "../errors/NoEligibleWorkerError";

interface AllocationResult {
  task: Task;
  worker: Worker;
}

function pickBestCandidate(candidates: (Worker & { _activeCount: number })[], durationDays: number): Worker {
  const ranked = [...candidates].sort((a, b) => {
    const slackA = a.availableCapacity - durationDays;
    const slackB = b.availableCapacity - durationDays;
    if (slackA !== slackB) return slackA - slackB;

    if (a._activeCount !== b._activeCount) return a._activeCount - b._activeCount;

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return ranked[0];
}

export async function allocateWorkerForTask(taskId: string, performedByUid: string): Promise<AllocationResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError("Task not found");
  }
  if (task.status !== TaskStatus.PENDING || task.assignedUid) {
    throw new ConflictError("Task is already assigned or not pending");
  }

  const candidates = await prisma.worker.findMany({
    where: {
      tags: { hasEvery: task.requiredTags },
      availableCapacity: { gte: task.durationDays },
      ...(task.location ? { location: task.location } : {}),
    },
  });

  if (candidates.length === 0) {
    await prisma.auditLog.create({
      data: {
        taskId: task.id,
        performedByUid,
        action: "AUTO_ALLOCATION_FAILED",
        metadata: {
          requiredTags: task.requiredTags,
          location: task.location,
          durationDays: task.durationDays,
          candidateCount: 0,
        },
      },
    });
    throw new NoEligibleWorkerError();
  }

  const activeCounts = await prisma.task.groupBy({
    by: ["assignedUid"],
    where: { status: TaskStatus.ACTIVE, assignedUid: { in: candidates.map((w) => w.id) } },
    _count: { _all: true },
  });
  const activeCountByWorker = new Map(activeCounts.map((c) => [c.assignedUid as string, c._count._all]));

  const candidatesWithActiveCount = candidates.map((worker) => ({
    ...worker,
    _activeCount: activeCountByWorker.get(worker.id) ?? 0,
  }));

  const chosen = pickBestCandidate(candidatesWithActiveCount, task.durationDays);
  const slack = chosen.availableCapacity - task.durationDays;

  // Re-check both preconditions (task still PENDING/unassigned, worker still
  // has enough capacity) as conditional writes *inside* the transaction, not
  // just via the reads above - two concurrent calls could otherwise both
  // pass the initial reads and both mutate the same row.
  const updatedTask = await prisma.$transaction(async (tx) => {
    const taskUpdate = await tx.task.updateMany({
      where: { id: task.id, status: TaskStatus.PENDING, assignedUid: null },
      data: { status: TaskStatus.ACTIVE, assignedUid: chosen.id },
    });
    if (taskUpdate.count !== 1) {
      throw new ConflictError("Task is already assigned or not pending");
    }

    const workerUpdate = await tx.worker.updateMany({
      where: { id: chosen.id, availableCapacity: { gte: task.durationDays } },
      data: { availableCapacity: { decrement: task.durationDays } },
    });
    if (workerUpdate.count !== 1) {
      throw new ConflictError("Worker no longer has sufficient capacity");
    }

    await tx.auditLog.create({
      data: {
        taskId: task.id,
        performedByUid,
        action: "AUTO_ALLOCATED",
        metadata: { workerId: chosen.id, slack, algorithmVersion: 1 },
      },
    });

    return tx.task.findUniqueOrThrow({ where: { id: task.id } });
  });

  return { task: updatedTask, worker: chosen };
}

/**
 * Manual assignment fallback for when auto-allocation finds no eligible
 * worker (or a manager simply wants to hand-pick). Same invariants and
 * capacity/audit bookkeeping as allocateWorkerForTask, minus the matching
 * algorithm - the caller has already chosen the worker.
 */
export async function assignWorkerManually(
  taskId: string,
  workerId: string,
  performedByUid: string,
): Promise<AllocationResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new NotFoundError("Task not found");
  }
  if (task.status === TaskStatus.COMPLETED || task.assignedUid) {
    throw new ConflictError("Task is already assigned or completed");
  }

  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) {
    throw new NotFoundError("Worker not found");
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    const taskUpdate = await tx.task.updateMany({
      where: { id: task.id, assignedUid: null, status: { not: TaskStatus.COMPLETED } },
      data: { status: TaskStatus.ACTIVE, assignedUid: worker.id },
    });
    if (taskUpdate.count !== 1) {
      throw new ConflictError("Task is already assigned or completed");
    }

    const workerUpdate = await tx.worker.updateMany({
      where: { id: worker.id, availableCapacity: { gte: task.durationDays } },
      data: { availableCapacity: { decrement: task.durationDays } },
    });
    if (workerUpdate.count !== 1) {
      throw new ConflictError("Worker does not have sufficient capacity for this task");
    }

    await tx.auditLog.create({
      data: {
        taskId: task.id,
        performedByUid,
        action: "MANUAL_ASSIGNED",
        metadata: { workerId: worker.id },
      },
    });

    return tx.task.findUniqueOrThrow({ where: { id: task.id } });
  });

  return { task: updatedTask, worker };
}
