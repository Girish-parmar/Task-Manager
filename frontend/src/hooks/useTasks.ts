"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types";

export function useTasks() {
  const tasks = useTaskStore((s) => s.tasks);
  const setTasks = useTaskStore((s) => s.setTasks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ tasks: Task[] }>("/tasks")
      .then((res) => {
        if (!cancelled) setTasks(res.data.tasks);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load tasks");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tasks, loading, error };
}
