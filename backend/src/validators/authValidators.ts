import { z } from "zod";
import { WorkerType } from "@prisma/client";

export const signupSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  type: z.nativeEnum(WorkerType),
  location: z.string().min(1).max(200),
  tags: z.array(z.string().min(1)).default([]),
  availableCapacity: z.number().int().min(0),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
