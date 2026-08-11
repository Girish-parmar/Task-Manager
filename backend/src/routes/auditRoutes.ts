import { Router } from "express";
import { listAuditLogs } from "../controllers/auditController";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/auth";

export const auditRoutes = Router();

// Per-task audit trails (?taskId=) are visible to any authenticated worker -
// the same access they already have to the task itself via GET /tasks/:id.
// Listing the full, unfiltered org-wide log is restricted to ADMIN/MANAGER
// inside the controller.
auditRoutes.use(authenticate);
auditRoutes.get("/", asyncHandler(listAuditLogs));
