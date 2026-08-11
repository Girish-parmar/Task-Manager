"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, apiErrorMessage } from "@/lib/api";
import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  requiredTags: z.string().optional(),
  location: z.string().optional(),
  durationDays: z.coerce.number().int().min(1, "Must be at least 1 day"),
});

type CreateTaskFormInput = z.input<typeof createTaskSchema>;
type CreateTaskFormOutput = z.output<typeof createTaskSchema>;

export function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const applyTaskUpdate = useTaskStore((s) => s.applyTaskUpdate);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskFormInput, unknown, CreateTaskFormOutput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { durationDays: 1 },
  });

  const onSubmit = async (values: CreateTaskFormOutput) => {
    setServerError(null);
    try {
      const res = await api.post<{ task: Task }>("/tasks", {
        title: values.title,
        requiredTags: values.requiredTags
          ? values.requiredTags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        location: values.location || undefined,
        durationDays: values.durationDays,
      });
      applyTaskUpdate(res.data.task);
      onClose();
    } catch (err) {
      setServerError(apiErrorMessage(err, "Could not create task"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div data-testid="create-task-modal" className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-950 p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Create task</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title</label>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              {...register("title")}
            />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Required tags (comma-separated)
            </label>
            <input
              placeholder="IT, Tier1"
              className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              {...register("requiredTags")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Location</label>
              <input
                placeholder="Optional"
                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
                {...register("location")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Duration (days)</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
                {...register("durationDays")}
              />
              {errors.durationDays && <p className="mt-1 text-xs text-red-600">{errors.durationDays.message}</p>}
            </div>
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
