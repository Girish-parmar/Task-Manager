"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentWorker } from "@/hooks/useCurrentWorker";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { worker, status } = useCurrentWorker();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && worker) {
      router.replace("/tasks");
    }
  }, [status, worker, router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
