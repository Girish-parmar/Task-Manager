import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "ValidationError", details: err.flatten() });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.name, message: err.message });
  }

  console.error(err);
  return res.status(500).json({
    error: "InternalServerError",
    message: env.NODE_ENV === "production" ? "Something went wrong" : String(err),
  });
}
