"use client";

import { useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types";

export function useAllocation() {
  const applyTaskUpdate = useTaskStore((s) => s.applyTaskUpdate);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const autoAssign = async (taskId: string) => {
    setPendingId(taskId);
    setError(null);
    try {
      const res = await api.post<{ task: Task }>(`/tasks/${taskId}/auto-assign`);
      applyTaskUpdate(res.data.task);
      return res.data.task;
    } catch (err) {
      setError(apiErrorMessage(err, "Could not auto-assign a worker"));
      throw err;
    } finally {
      setPendingId(null);
    }
  };

  const complete = async (taskId: string) => {
    setPendingId(taskId);
    setError(null);
    try {
      const res = await api.post<{ task: Task; nextBranch: Task | null }>(`/tasks/${taskId}/complete`);
      applyTaskUpdate(res.data.task);
      if (res.data.nextBranch) {
        applyTaskUpdate(res.data.nextBranch);
      }
      return res.data;
    } catch (err) {
      setError(apiErrorMessage(err, "Could not complete task"));
      throw err;
    } finally {
      setPendingId(null);
    }
  };

  return { autoAssign, complete, pendingId, error };
}
