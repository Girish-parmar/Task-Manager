"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Worker } from "@/types";

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ workers: Worker[] }>("/workers")
      .then((res) => setWorkers(res.data.workers))
      .catch(() => setError("Could not load workers"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Workers</h1>
      <p className="mt-1 text-sm text-zinc-500">Internal employees and external contractors in the workspace.</p>

      {loading && <p className="mt-4 text-sm text-zinc-500">Loading...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Name</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Type</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Role</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Location</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Tags</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">{worker.name}</td>
                  <td className="px-4 py-2 text-zinc-500">{worker.type}</td>
                  <td className="px-4 py-2 text-zinc-500">{worker.role}</td>
                  <td className="px-4 py-2 text-zinc-500">{worker.location}</td>
                  <td className="px-4 py-2 text-zinc-500">{worker.tags.join(", ") || "-"}</td>
                  <td className="px-4 py-2 text-zinc-500">{worker.availableCapacity}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
