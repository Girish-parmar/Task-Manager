"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { Worker } from "@/types";

export function useCurrentWorker() {
  const { worker, status, setWorker, setStatus } = useAuthStore();

  useEffect(() => {
    if (status !== "idle") return;
    setStatus("loading");
    api
      .get<{ worker: Worker }>("/auth/me")
      .then((res) => setWorker(res.data.worker))
      .catch(() => setWorker(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return { worker, status };
}
