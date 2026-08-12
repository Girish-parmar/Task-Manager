"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import type { Task, TaskStatus } from "@/types";
import { useAllocation } from "@/hooks/useAllocation";
import { Column } from "./Column";

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "PENDING", title: "Pending" },
  { status: "ACTIVE", title: "Active" },
  { status: "COMPLETED", title: "Completed" },
];

export function Board({ tasks }: { tasks: Task[] }) {
  const { autoAssign, complete, error } = useAllocation();
  const [localError, setLocalError] = useState<string | null>(null);

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  const handleDragEnd = async (event: DragEndEvent) => {
    const taskId = event.active.id as string;
    const targetStatus = event.over?.id as TaskStatus | undefined;
    if (!targetStatus) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    setLocalError(null);
    try {
      if (task.status === "PENDING" && targetStatus === "ACTIVE") {
        await autoAssign(taskId);
      } else if (task.status === "ACTIVE" && targetStatus === "COMPLETED") {
        await complete(taskId);
      } else {
        setLocalError("Drag a Pending task to Active to auto-assign, or an Active task to Completed to finish it.");
      }
    } catch {
      setLocalError(error);
    }
  };

  return (
    <div>
      {(localError || error) && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {localError || error}
        </div>
      )}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <Column key={col.status} status={col.status} title={col.title} tasks={tasksByStatus(col.status)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
