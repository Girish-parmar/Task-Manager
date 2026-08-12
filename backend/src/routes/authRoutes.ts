import { Router } from "express";
import { login, logout, me, signup } from "../controllers/authController";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/auth";

export const authRoutes = Router();

authRoutes.post("/signup", asyncHandler(signup));
authRoutes.post("/login", asyncHandler(login));
authRoutes.post("/logout", authenticate, logout);
authRoutes.get("/me", authenticate, asyncHandler(me));
