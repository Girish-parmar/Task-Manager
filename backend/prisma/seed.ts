import { PrismaClient, WorkerType, WorkerRole, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.task.updateMany({ data: { nextBranchId: null } });
  await prisma.task.deleteMany();
  await prisma.worker.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const [admin, alice, bob, carla, dmitri, elena, frank] = await Promise.all([
    prisma.worker.create({
      data: {
        name: "Admin Owner",
        email: "admin@taskmanager.dev",
        passwordHash,
        role: WorkerRole.ADMIN,
        type: WorkerType.INTERNAL,
        location: "New York",
        tags: ["Management"],
        availableCapacity: 20,
      },
    }),
    prisma.worker.create({
      data: {
        name: "Alice Chen",
        email: "alice@taskmanager.dev",
        passwordHash,
        role: WorkerRole.MANAGER,
        type: WorkerType.INTERNAL,
        location: "New York",
        tags: ["IT", "Tier2", "Networking"],
        availableCapacity: 12,
      },
    }),
    prisma.worker.create({
      data: {
        name: "Bob Smith",
        email: "bob@taskmanager.dev",
        passwordHash,
        role: WorkerRole.MEMBER,
        type: WorkerType.INTERNAL,
        location: "New York",
        tags: ["IT", "Tier1"],
        availableCapacity: 5,
      },
    }),
    prisma.worker.create({
      data: {
        name: "Carla Nunez",
        email: "carla@taskmanager.dev",
        passwordHash,
        role: WorkerRole.MEMBER,
        type: WorkerType.EXTERNAL,
        location: "Chicago",
        tags: ["Plumbing", "Tier1"],
        availableCapacity: 8,
      },
    }),
    prisma.worker.create({
      data: {
        name: "Dmitri Petrov",
        email: "dmitri@taskmanager.dev",
        passwordHash,
        role: WorkerRole.MEMBER,
        type: WorkerType.EXTERNAL,
        location: "Chicago",
        tags: ["Plumbing", "Electrical", "Tier2"],
        availableCapacity: 15,
      },
    }),
    prisma.worker.create({
      data: {
        name: "Elena Ruiz",
        email: "elena@taskmanager.dev",
        passwordHash,
        role: WorkerRole.MEMBER,
        type: WorkerType.INTERNAL,
        location: "Austin",
        tags: ["IT", "Tier1", "Support"],
        availableCapacity: 3,
      },
    }),
    prisma.worker.create({
      data: {
        name: "Frank Osei",
        email: "frank@taskmanager.dev",
        passwordHash,
        role: WorkerRole.MEMBER,
        type: WorkerType.EXTERNAL,
        location: "Austin",
        tags: ["Electrical", "Tier2"],
        availableCapacity: 10,
      },
    }),
  ]);

  // Standalone pending tasks for manual/auto allocation testing
  await prisma.task.create({
    data: {
      title: "Reset office network switch",
      status: TaskStatus.PENDING,
      requiredTags: ["IT", "Tier1"],
      location: "New York",
      durationDays: 2,
    },
  });

  await prisma.task.create({
    data: {
      title: "Fix leaking pipe in break room",
      status: TaskStatus.PENDING,
      requiredTags: ["Plumbing"],
      location: "Chicago",
      durationDays: 3,
    },
  });

  // Deliberately unmatchable task (no worker has this tag combination in this location)
  await prisma.task.create({
    data: {
      title: "Rewire server room in Austin",
      status: TaskStatus.PENDING,
      requiredTags: ["Electrical", "Tier2", "IT"],
      location: "Austin",
      durationDays: 4,
    },
  });

  // Already-assigned active task
  await prisma.task.create({
    data: {
      title: "Weekly IT support rounds",
      status: TaskStatus.ACTIVE,
      assignedUid: elena.id,
      requiredTags: ["IT", "Support"],
      location: "Austin",
      durationDays: 1,
    },
  });

  // Branch chain: 3 tasks, first ACTIVE and assigned, next two PENDING and locked
  const branch3 = await prisma.task.create({
    data: {
      title: "Onboarding: Final review with manager",
      status: TaskStatus.PENDING,
      requiredTags: ["Management"],
      location: "New York",
      durationDays: 1,
    },
  });
  const branch2 = await prisma.task.create({
    data: {
      title: "Onboarding: IT equipment setup",
      status: TaskStatus.PENDING,
      requiredTags: ["IT"],
      location: "New York",
      durationDays: 1,
      nextBranchId: branch3.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "Onboarding: Paperwork intake",
      status: TaskStatus.ACTIVE,
      assignedUid: bob.id,
      requiredTags: ["IT", "Tier1"],
      location: "New York",
      durationDays: 1,
      nextBranchId: branch2.id,
    },
  });

  console.log("Seed complete.");
  console.log("Seeded workers:", [admin, alice, bob, carla, dmitri, elena, frank].map((w) => w.email));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
