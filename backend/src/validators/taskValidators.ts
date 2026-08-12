import { z } from "zod";
import { TaskStatus } from "@prisma/client";

export const taskStatusQuerySchema = z.nativeEnum(TaskStatus).optional();

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  requiredTags: z.array(z.string().min(1)).default([]),
  location: z.string().min(1).max(200).optional(),
  durationDays: z.number().int().min(1),
  nextBranchId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  requiredTags: z.array(z.string().min(1)).optional(),
  location: z.string().min(1).max(200).nullable().optional(),
  durationDays: z.number().int().min(1).optional(),
  nextBranchId: z.string().uuid().nullable().optional(),
});

export const assignWorkerSchema = z.object({
  workerId: z.string().uuid(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type AssignWorkerInput = z.infer<typeof assignWorkerSchema>;
