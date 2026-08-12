"use client";

import Link from "next/link";
import { useAudit } from "@/hooks/useAudit";

export default function AuditPage() {
  const { logs, loading, error } = useAudit();

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Audit log</h1>
      <p className="mt-1 text-sm text-zinc-500">Immutable trace of every allocation, assignment, and completion.</p>

      {loading && <p className="mt-4 text-sm text-zinc-500">Loading...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Action</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Task</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Performed by</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">{log.action}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {log.task ? (
                      <Link href={`/tasks/${log.task.id}`} className="text-indigo-600 hover:underline">
                        {log.task.title}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{log.performedBy?.name ?? log.performedByUid}</td>
                  <td className="px-4 py-2 text-zinc-500">{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    No audit entries yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
