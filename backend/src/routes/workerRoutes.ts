import { Router } from "express";
import { WorkerRole } from "@prisma/client";
import { getWorker, listWorkers, updateWorker } from "../controllers/workerController";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize } from "../middlewares/auth";

export const workerRoutes = Router();

workerRoutes.use(authenticate);

workerRoutes.get("/", asyncHandler(listWorkers));
workerRoutes.get("/:id", asyncHandler(getWorker));
workerRoutes.patch("/:id", authorize(WorkerRole.ADMIN, WorkerRole.MANAGER), asyncHandler(updateWorker));
