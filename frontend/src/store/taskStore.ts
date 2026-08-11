import { create } from "zustand";
import type { Task } from "@/types";

interface TaskState {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  applyTaskUpdate: (task: Task) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  applyTaskUpdate: (task) =>
    set((state) => {
      const exists = state.tasks.some((t) => t.id === task.id);
      const tasks = exists
        ? state.tasks.map((t) => (t.id === task.id ? task : t))
        : [task, ...state.tasks];
      return { tasks };
    }),
}));
