import { Router } from "express";
import { WorkerRole } from "@prisma/client";
import { createTask, getTask, listTasks, updateTask } from "../controllers/taskController";
import { assignWorker, autoAssignTask, completeTask } from "../controllers/allocationController";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize } from "../middlewares/auth";

export const taskRoutes = Router();

taskRoutes.use(authenticate);

taskRoutes.get("/", asyncHandler(listTasks));
taskRoutes.get("/:id", asyncHandler(getTask));
taskRoutes.post("/", asyncHandler(createTask));
taskRoutes.patch("/:id", asyncHandler(updateTask));
taskRoutes.post("/:id/auto-assign", asyncHandler(autoAssignTask));
taskRoutes.post("/:id/assign", authorize(WorkerRole.ADMIN, WorkerRole.MANAGER), asyncHandler(assignWorker));
taskRoutes.post("/:id/complete", asyncHandler(completeTask));
