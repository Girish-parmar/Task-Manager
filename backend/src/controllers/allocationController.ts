import type { Request, Response } from "express";
import { allocateWorkerForTask, assignWorkerManually } from "../services/allocationService";
import { completeTaskBranch } from "../services/taskCompletionService";
import { assignWorkerSchema } from "../validators/taskValidators";
import { emitBranchCompleted, emitTaskAssigned, emitTaskUpdated } from "../sockets/taskEvents";

export async function autoAssignTask(req: Request, res: Response) {
  const { task, worker } = await allocateWorkerForTask(req.params.id, req.user!.id);
  emitTaskUpdated(task);
  res.json({ task, worker: { id: worker.id, name: worker.name, email: worker.email } });
}

export async function assignWorker(req: Request, res: Response) {
  const { workerId } = assignWorkerSchema.parse(req.body);
  const { task, worker } = await assignWorkerManually(req.params.id, workerId, req.user!.id);
  emitTaskAssigned(task);
  res.json({ task, worker: { id: worker.id, name: worker.name, email: worker.email } });
}

export async function completeTask(req: Request, res: Response) {
  const { task, nextBranch } = await completeTaskBranch(req.params.id, req.user!);
  emitBranchCompleted(task);
  if (nextBranch) {
    emitTaskUpdated(nextBranch);
  }
  res.json({ task, nextBranch });
}
