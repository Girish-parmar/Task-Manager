import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cookie from "cookie";
import { env } from "../config/env";
import { verifyToken } from "../utils/jwt";

let io: SocketIOServer | undefined;

export function initSockets(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      const token = rawCookie ? cookie.parse(rawCookie).token : undefined;
      if (!token) {
        return next(new Error("Authentication required"));
      }
      const payload = verifyToken(token);
      socket.data.user = payload;
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("workspace");
    socket.on("disconnect", () => {
      // no-op: connection cleanup handled by socket.io
    });
  });

  return io;
}

export function getIo(): SocketIOServer | undefined {
  return io;
}
