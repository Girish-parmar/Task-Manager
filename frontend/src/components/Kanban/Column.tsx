"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Task, TaskStatus } from "@/types";
import { TaskCard } from "./TaskCard";

interface ColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
}

export function Column({ status, title, tasks }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[400px] w-full flex-col rounded-xl border p-3 transition-colors ${
        isOver
          ? "border-zinc-400 bg-zinc-100 dark:bg-zinc-900"
          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50"
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h2>
        <span className="text-xs text-zinc-400">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && <p className="px-1 text-xs text-zinc-400">No tasks</p>}
      </div>
    </div>
  );
}
