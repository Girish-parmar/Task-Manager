import { z } from "zod";
import { WorkerRole, WorkerType } from "@prisma/client";

export const updateWorkerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.nativeEnum(WorkerType).optional(),
  role: z.nativeEnum(WorkerRole).optional(),
  location: z.string().min(1).max(200).optional(),
  tags: z.array(z.string().min(1)).optional(),
  availableCapacity: z.number().int().min(0).optional(),
});

export type UpdateWorkerInput = z.infer<typeof updateWorkerSchema>;
