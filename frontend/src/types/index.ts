export type WorkerType = "INTERNAL" | "EXTERNAL";
export type WorkerRole = "ADMIN" | "MANAGER" | "MEMBER";
export type TaskStatus = "PENDING" | "ACTIVE" | "COMPLETED";

export interface Worker {
  id: string;
  name: string;
  email: string;
  role: WorkerRole;
  type: WorkerType;
  location: string;
  tags: string[];
  availableCapacity: number;
}

export interface TaskAssignee {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assignedUid: string | null;
  assignedWorker?: TaskAssignee | null;
  requiredTags: string[];
  location: string | null;
  durationDays: number;
  completedDate: string | null;
  nextBranchId: string | null;
  nextBranch?: Task | null;
  previousBranch?: Task | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  taskId: string;
  performedByUid: string;
  performedBy?: TaskAssignee;
  task?: { id: string; title: string };
  action: string;
  metadata: unknown;
  timestamp: string;
}
