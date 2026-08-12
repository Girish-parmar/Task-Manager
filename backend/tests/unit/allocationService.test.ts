import { WorkerType, TaskStatus } from "@prisma/client";
import { testPrisma, truncateAll } from "../setup/testDb";
import { allocateWorkerForTask } from "../../src/services/allocationService";
import { NoEligibleWorkerError } from "../../src/errors/NoEligibleWorkerError";
import { ConflictError, NotFoundError } from "../../src/errors/AppError";

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
      ...overrides,
    },
  });
}

describe("allocationService.allocateWorkerForTask", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("assigns the single worker who matches tags, location, and capacity", async () => {
    const performer = await createWorker({ email: "performer@test.dev" });
    const worker = await createWorker({
      tags: ["IT", "Tier1"],
      location: "New York",
      availableCapacity: 5,
    });
    const task = await createTask({
      requiredTags: ["IT", "Tier1"],
      location: "New York",
      durationDays: 3,
    });

    const { task: updated, worker: chosen } = await allocateWorkerForTask(task.id, performer.id);

    expect(chosen.id).toBe(worker.id);
    expect(updated.status).toBe(TaskStatus.ACTIVE);
    expect(updated.assignedUid).toBe(worker.id);

    const refreshedWorker = await testPrisma.worker.findUniqueOrThrow({ where: { id: worker.id } });
    expect(refreshedWorker.availableCapacity).toBe(2);

    const auditRow = await testPrisma.auditLog.findFirst({ where: { taskId: task.id, action: "AUTO_ALLOCATED" } });
    expect(auditRow).not.toBeNull();
  });

  it("excludes a worker missing one of several required tags (no partial credit)", async () => {
    const performer = await createWorker({ email: "performer2@test.dev" });
    await createWorker({ tags: ["IT"], location: "New York", availableCapacity: 10 });
    const task = await createTask({ requiredTags: ["IT", "Tier1"], location: "New York", durationDays: 2 });

    await expect(allocateWorkerForTask(task.id, performer.id)).rejects.toBeInstanceOf(NoEligibleWorkerError);
  });

  it("excludes a worker whose capacity is less than the task duration", async () => {
    const performer = await createWorker({ email: "performer3@test.dev" });
    await createWorker({ tags: ["IT"], location: "New York", availableCapacity: 1 });
    const task = await createTask({ requiredTags: ["IT"], location: "New York", durationDays: 3 });

    await expect(allocateWorkerForTask(task.id, performer.id)).rejects.toBeInstanceOf(NoEligibleWorkerError);
  });

  it("breaks ties by smallest slack (best fit)", async () => {
    const performer = await createWorker({ email: "performer4@test.dev" });
    const looseFit = await createWorker({ tags: ["IT"], location: "New York", availableCapacity: 20 });
    const tightFit = await createWorker({ tags: ["IT"], location: "New York", availableCapacity: 3 });
    const task = await createTask({ requiredTags: ["IT"], location: "New York", durationDays: 3 });

    const { worker: chosen } = await allocateWorkerForTask(task.id, performer.id);

    expect(chosen.id).toBe(tightFit.id);
    expect(chosen.id).not.toBe(looseFit.id);
  });

  it("breaks slack ties by fewest currently active tasks", async () => {
    const performer = await createWorker({ email: "performer5@test.dev" });
    const busyWorker = await createWorker({ tags: ["IT"], location: "New York", availableCapacity: 5 });
    const freeWorker = await createWorker({ tags: ["IT"], location: "New York", availableCapacity: 5 });

    // Give busyWorker an existing ACTIVE task so it has a higher active count.
    await createTask({
      title: "Existing active task",
      requiredTags: [],
      durationDays: 1,
      status: TaskStatus.ACTIVE,
      assignedUid: busyWorker.id,
    });

    const task = await createTask({ requiredTags: ["IT"], location: "New York", durationDays: 5 });

    const { worker: chosen } = await allocateWorkerForTask(task.id, performer.id);

    expect(chosen.id).toBe(freeWorker.id);
    expect(chosen.id).not.toBe(busyWorker.id);
  });

  it("throws NoEligibleWorkerError and writes an audit row without mutating state when no worker qualifies", async () => {
    const performer = await createWorker({ email: "performer6@test.dev" });
    const task = await createTask({ requiredTags: ["Nonexistent"], location: "Nowhere", durationDays: 1 });

    await expect(allocateWorkerForTask(task.id, performer.id)).rejects.toBeInstanceOf(NoEligibleWorkerError);

    const refreshedTask = await testPrisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(refreshedTask.status).toBe(TaskStatus.PENDING);
    expect(refreshedTask.assignedUid).toBeNull();

    const auditRow = await testPrisma.auditLog.findFirst({
      where: { taskId: task.id, action: "AUTO_ALLOCATION_FAILED" },
    });
    expect(auditRow).not.toBeNull();
  });

  it("throws NotFoundError for an unknown task id", async () => {
    const performer = await createWorker({ email: "performer7@test.dev" });
    await expect(
      allocateWorkerForTask("00000000-0000-0000-0000-000000000000", performer.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError when the task is already assigned", async () => {
    const performer = await createWorker({ email: "performer8@test.dev" });
    const worker = await createWorker({ tags: ["IT"], location: "New York", availableCapacity: 10 });
    const task = await createTask({
      requiredTags: ["IT"],
      location: "New York",
      durationDays: 1,
      status: TaskStatus.ACTIVE,
      assignedUid: worker.id,
    });

    await expect(allocateWorkerForTask(task.id, performer.id)).rejects.toBeInstanceOf(ConflictError);
  });
});
