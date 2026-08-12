import { WorkerRole, WorkerType, TaskStatus } from "@prisma/client";
import { testPrisma, truncateAll } from "../setup/testDb";
import { completeTaskBranch } from "../../src/services/taskCompletionService";
import { ConflictError, ForbiddenError, NotFoundError } from "../../src/errors/AppError";

async function createWorker(overrides: Partial<Parameters<typeof testPrisma.worker.create>[0]["data"]> = {}) {
  return testPrisma.worker.create({
    data: {
      name: "Test Worker",
      email: `worker-${Math.random()}@test.dev`,
      passwordHash: "hash",
      type: WorkerType.INTERNAL,
      location: "New York",
      tags: [],
      availableCapacity: 10,
      ...overrides,
    },
  });
}

async function createTask(overrides: Partial<Parameters<typeof testPrisma.task.create>[0]["data"]> = {}) {
  return testPrisma.task.create({
    data: {
      title: "Test Task",
      requiredTags: [],
      durationDays: 3,
      status: TaskStatus.ACTIVE,
      ...overrides,
    },
  });
}

describe("taskCompletionService.completeTaskBranch", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("marks the task COMPLETED, sets completedDate, and writes a BRANCH_COMPLETED audit row", async () => {
    const worker = await createWorker({ availableCapacity: 2 });
    const task = await createTask({ assignedUid: worker.id, durationDays: 3 });

    const { task: completed, nextBranch } = await completeTaskBranch(task.id, {
      id: worker.id,
      role: WorkerRole.MEMBER,
    });

    expect(completed.status).toBe(TaskStatus.COMPLETED);
    expect(completed.completedDate).not.toBeNull();
    expect(nextBranch).toBeNull();

    const auditRow = await testPrisma.auditLog.findFirst({ where: { taskId: task.id, action: "BRANCH_COMPLETED" } });
    expect(auditRow).not.toBeNull();
  });

  it("restores the assigned worker's capacity on completion (no capacity leak)", async () => {
    const worker = await createWorker({ availableCapacity: 2 });
    const task = await createTask({ assignedUid: worker.id, durationDays: 3 });

    await completeTaskBranch(task.id, { id: worker.id, role: WorkerRole.MEMBER });

    const refreshedWorker = await testPrisma.worker.findUniqueOrThrow({ where: { id: worker.id } });
    expect(refreshedWorker.availableCapacity).toBe(5);
  });

  it("allows a MANAGER to complete a task they are not assigned to", async () => {
    const assignee = await createWorker();
    const manager = await createWorker({ role: WorkerRole.MANAGER });
    const task = await createTask({ assignedUid: assignee.id });

    const { task: completed } = await completeTaskBranch(task.id, { id: manager.id, role: WorkerRole.MANAGER });
    expect(completed.status).toBe(TaskStatus.COMPLETED);
  });

  it("forbids a MEMBER who is not the assignee from completing the task", async () => {
    const assignee = await createWorker();
    const otherMember = await createWorker();
    const task = await createTask({ assignedUid: assignee.id });

    await expect(
      completeTaskBranch(task.id, { id: otherMember.id, role: WorkerRole.MEMBER }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws NotFoundError for an unknown task", async () => {
    const worker = await createWorker();
    await expect(
      completeTaskBranch("00000000-0000-0000-0000-000000000000", { id: worker.id, role: WorkerRole.MEMBER }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError if the task is not ACTIVE", async () => {
    const worker = await createWorker();
    const task = await createTask({ assignedUid: worker.id, status: TaskStatus.PENDING });

    await expect(completeTaskBranch(task.id, { id: worker.id, role: WorkerRole.MEMBER })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("auto-allocates the next branch task when an eligible worker exists", async () => {
    const assignee = await createWorker();
    const nextWorker = await createWorker({ tags: ["IT"], availableCapacity: 5 });
    const nextBranchTask = await createTask({
      status: TaskStatus.PENDING,
      requiredTags: ["IT"],
      durationDays: 2,
    });
    const task = await createTask({ assignedUid: assignee.id, nextBranchId: nextBranchTask.id });

    const { nextBranch } = await completeTaskBranch(task.id, { id: assignee.id, role: WorkerRole.MEMBER });

    expect(nextBranch?.status).toBe(TaskStatus.ACTIVE);
    expect(nextBranch?.assignedUid).toBe(nextWorker.id);

    const auditRow = await testPrisma.auditLog.findFirst({
      where: { taskId: nextBranchTask.id, action: "AUTO_ALLOCATED" },
    });
    expect(auditRow).not.toBeNull();
  });

  it("activates the next branch unassigned and writes a BRANCH_ACTIVATED_UNASSIGNED audit row when no worker qualifies", async () => {
    const assignee = await createWorker();
    const nextBranchTask = await createTask({
      status: TaskStatus.PENDING,
      requiredTags: ["Nonexistent"],
      durationDays: 2,
    });
    const task = await createTask({ assignedUid: assignee.id, nextBranchId: nextBranchTask.id });

    const { nextBranch } = await completeTaskBranch(task.id, { id: assignee.id, role: WorkerRole.MEMBER });

    expect(nextBranch?.status).toBe(TaskStatus.ACTIVE);
    expect(nextBranch?.assignedUid).toBeNull();

    const auditRow = await testPrisma.auditLog.findFirst({
      where: { taskId: nextBranchTask.id, action: "BRANCH_ACTIVATED_UNASSIGNED" },
    });
    expect(auditRow).not.toBeNull();
  });
});
