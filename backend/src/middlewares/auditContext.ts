import type { NextFunction, Request, Response } from "express";
import type { Prisma } from "@prisma/client";

export interface AuditEntry {
  action: string;
  taskId: string;
  metadata?: Prisma.InputJsonValue;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      audit: (entry: AuditEntry) => AuditEntry;
    }
  }
}

/**
 * Attaches req.audit(), which controllers/services call to declare an audit
 * entry inline with the business logic that produces it. The entry is
 * returned (not queued/written here) so the caller can pass it straight into
 * the same prisma.$transaction() that performs the state change, guaranteeing
 * the audit row and the state change commit atomically.
 */
export function auditContext(req: Request, _res: Response, next: NextFunction) {
  req.audit = (entry: AuditEntry) => entry;
  next();
}
