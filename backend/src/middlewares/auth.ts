import type { NextFunction, Request, Response } from "express";
import type { WorkerRole } from "@prisma/client";
import { verifyToken } from "../utils/jwt";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: WorkerRole };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    return next(new UnauthorizedError("Authentication required"));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    return next();
  } catch {
    return next(new UnauthorizedError("Invalid or expired token"));
  }
}

export function authorize(...roles: WorkerRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError("Insufficient role for this action"));
    }
    return next();
  };
}
