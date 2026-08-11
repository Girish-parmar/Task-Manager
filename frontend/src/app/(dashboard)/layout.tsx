"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentWorker } from "@/hooks/useCurrentWorker";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { SocketConnector } from "@/components/SocketConnector";

const NAV_LINKS = [
  { href: "/tasks", label: "Tasks" },
  { href: "/workers", label: "Workers" },
  { href: "/audit", label: "Audit Log", roles: ["ADMIN", "MANAGER"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { worker, status } = useCurrentWorker();
  const reset = useAuthStore((s) => s.reset);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const handleLogout = async () => {
    await api.post("/auth/logout");
    reset();
    router.replace("/login");
  };

  if (status !== "authenticated" || !worker) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <SocketConnector />
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Task Manager</span>
            <nav className="flex gap-4">
              {NAV_LINKS.filter((link) => !link.roles || link.roles.includes(worker.role)).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium ${
                    pathname.startsWith(link.href)
                      ? "text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">
              {worker.name} <span className="text-zinc-400">({worker.role})</span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
