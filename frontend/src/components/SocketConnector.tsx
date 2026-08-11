"use client";

import { useEffect } from "react";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types";

export function SocketConnector() {
  const applyTaskUpdate = useTaskStore((s) => s.applyTaskUpdate);

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    const handleTaskEvent = (task: Task) => applyTaskUpdate(task);

    socket.on("task:updated", handleTaskEvent);
    socket.on("task:assigned", handleTaskEvent);
    socket.on("task:branchCompleted", handleTaskEvent);

    return () => {
      socket.off("task:updated", handleTaskEvent);
      socket.off("task:assigned", handleTaskEvent);
      socket.off("task:branchCompleted", handleTaskEvent);
      disconnectSocket();
    };
  }, [applyTaskUpdate]);

  return null;
}
