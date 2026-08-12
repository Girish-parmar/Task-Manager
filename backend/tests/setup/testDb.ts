import { PrismaClient } from "@prisma/client";

export const testPrisma = new PrismaClient();

export async function truncateAll() {
  await testPrisma.$transaction([
    testPrisma.auditLog.deleteMany(),
    testPrisma.task.updateMany({ data: { nextBranchId: null } }),
    testPrisma.task.deleteMany(),
    testPrisma.worker.deleteMany(),
  ]);
}
