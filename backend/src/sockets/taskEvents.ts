import { getIo } from "./index";

export function emitTaskUpdated(task: unknown) {
  getIo()?.to("workspace").emit("task:updated", task);
}

export function emitTaskAssigned(task: unknown) {
  getIo()?.to("workspace").emit("task:assigned", task);
}

export function emitBranchCompleted(task: unknown) {
  getIo()?.to("workspace").emit("task:branchCompleted", task);
}
