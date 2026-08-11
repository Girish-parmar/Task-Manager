"use client";

import { useState } from "react";
import { useTasks } from "@/hooks/useTasks";
import { Board } from "@/components/Kanban/Board";
import { CreateTaskModal } from "@/components/Modals/CreateTaskModal";

export default function TasksPage() {
  const { tasks, loading, error } = useTasks();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Tasks</h1>
          <p className="text-sm text-zinc-500">
            Drag a Pending task to Active to auto-assign it, or an Active task to Completed to finish it.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:opacity-90"
        >
          + New task
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading tasks...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && <Board tasks={tasks} />}

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
