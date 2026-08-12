"use client";

import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { useTaskStore } from "@/store/taskStore";
import type { Task, Worker } from "@/types";

export function AssignWorkerModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const applyTaskUpdate = useTaskStore((s) => s.applyTaskUpdate);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ workers: Worker[] }>("/workers").then((res) => setWorkers(res.data.workers));
  }, []);

  const handleAssign = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ task: Task }>(`/tasks/${task.id}/assign`, { workerId: selectedId });
      applyTaskUpdate(res.data.task);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not assign worker"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div data-testid="assign-worker-modal" className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-950 p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Assign worker</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Manually assign a worker to &ldquo;{task.title}&rdquo;, bypassing the auto-allocation matching.
        </p>

        <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
          {workers.map((worker) => (
            <label
              key={worker.id}
              className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm has-[:checked]:border-zinc-900 dark:has-[:checked]:border-zinc-100"
            >
              <span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{worker.name}</span>{" "}
                <span className="text-zinc-500">
                  ({worker.location}, {worker.availableCapacity}d, {worker.tags.join(", ") || "no tags"})
                </span>
              </span>
              <input
                type="radio"
                name="worker"
                value={worker.id}
                checked={selectedId === worker.id}
                onChange={() => setSelectedId(worker.id)}
              />
            </label>
          ))}
          {workers.length === 0 && <p className="text-sm text-zinc-400">Loading workers...</p>}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedId || submitting}
            className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
          >
            {submitting ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
