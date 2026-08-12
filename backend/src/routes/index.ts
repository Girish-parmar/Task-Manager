import { Router } from "express";
import { authRoutes } from "./authRoutes";
import { workerRoutes } from "./workerRoutes";
import { taskRoutes } from "./taskRoutes";
import { auditRoutes } from "./auditRoutes";

export const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/workers", workerRoutes);
apiRouter.use("/tasks", taskRoutes);
apiRouter.use("/audit", auditRoutes);
