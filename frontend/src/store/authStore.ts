import { create } from "zustand";
import type { Worker } from "@/types";

interface AuthState {
  worker: Worker | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  setWorker: (worker: Worker | null) => void;
  setStatus: (status: AuthState["status"]) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  worker: null,
  status: "idle",
  setWorker: (worker) => set({ worker, status: worker ? "authenticated" : "unauthenticated" }),
  setStatus: (status) => set({ status }),
  reset: () => set({ worker: null, status: "unauthenticated" }),
}));
