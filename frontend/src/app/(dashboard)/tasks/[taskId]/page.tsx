"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, apiErrorMessage } from "@/lib/api";
import { useAllocation } from "@/hooks/useAllocation";
import { useAudit } from "@/hooks/useAudit";
import { useAuthStore } from "@/store/authStore";
import { AssignWorkerModal } from "@/components/Modals/AssignWorkerModal";
import type { Task } from "@/types";

export default function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const worker = useAuthStore((s) => s.worker);
  const { autoAssign, complete, error: actionError } = useAllocation();
  const { logs, refetch: refetchAudit } = useAudit(taskId);

  const [task, setTask] = useState<Task | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const loadTask = useCallback(async () => {
    try {
      const res = await api.get<{ task: Task }>(`/tasks/${taskId}`);
      setTask(res.data.task);
    } catch (err) {
      setLoadError(apiErrorMessage(err, "Could not load task"));
    }
  }, [taskId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/taskId-change is the intended pattern here
    loadTask();
  }, [loadTask]);

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!task) return <p className="text-sm text-zinc-500">Loading...</p>;

  const isManagerOrAdmin = worker?.role === "ADMIN" || worker?.role === "MANAGER";
  const canComplete = task.status === "ACTIVE" && (task.assignedUid === worker?.id || isManagerOrAdmin);

  const handleAutoAssign = async () => {
    await autoAssign(task.id);
    loadTask();
    refetchAudit();
  };

  const handleComplete = async () => {
    await complete(task.id);
    loadTask();
    refetchAudit();
  };

  return (
    <div>
      <Link href="/tasks" className="text-sm text-zinc-500 hover:underline">
        &larr; Back to tasks
      </Link>

      <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{task.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Status: <span className="font-medium">{task.status}</span>
            </p>
          </div>
          <div className="flex gap-2">
            {task.status === "PENDING" && (
              <>
                <button
                  onClick={handleAutoAssign}
                  className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-sm font-medium text-white dark:text-zinc-900"
                >
                  Auto-assign
                </button>
                {isManagerOrAdmin && (
                  <button
                    onClick={() => setShowAssign(true)}
                    className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    Assign manually
                  </button>
                )}
              </>
            )}
            {canComplete && (
              <button
                onClick={handleComplete}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Complete
              </button>
            )}
          </div>
        </div>

        {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-zinc-500">Required tags</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{task.requiredTags.join(", ") || "None"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Location</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{task.location ?? "Any"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Duration</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{task.durationDays} day(s)</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Assigned to</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{task.assignedWorker?.name ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Completed</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
              {task.completedDate ? new Date(task.completedDate).toLocaleString() : "Not yet"}
            </dd>
          </div>
          {task.nextBranch && (
            <div>
              <dt className="text-zinc-500">Next branch</dt>
              <dd className="mt-1">
                <Link href={`/tasks/${task.nextBranch.id}`} className="text-indigo-600 hover:underline">
                  {task.nextBranch.title}
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Audit trail</h2>
        <ul className="mt-3 space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{log.action}</span> by{" "}
              {log.performedBy?.name ?? log.performedByUid} &mdash; {new Date(log.timestamp).toLocaleString()}
            </li>
          ))}
          {logs.length === 0 && <li className="text-xs text-zinc-400">No audit entries yet</li>}
        </ul>
      </div>

      {showAssign && (
        <AssignWorkerModal
          task={task}
          onClose={() => {
            setShowAssign(false);
            loadTask();
            refetchAudit();
          }}
        />
      )}
    </div>
  );
}
