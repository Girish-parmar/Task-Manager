"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import type { Task } from "@/types";

export function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 shadow-sm cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <Link href={`/tasks/${task.id}`} className="block" onClick={(e) => isDragging && e.preventDefault()}>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{task.title}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {task.requiredTags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{task.location ?? "Any location"}</span>
          <span>{task.durationDays}d</span>
        </div>
        {task.assignedWorker && (
          <p className="mt-1 text-[11px] text-zinc-500">Assigned: {task.assignedWorker.name}</p>
        )}
        {task.nextBranchId && <p className="mt-1 text-[11px] text-indigo-500">Has next branch</p>}
      </Link>
    </div>
  );
}
