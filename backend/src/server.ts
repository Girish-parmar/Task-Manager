import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSockets } from "./sockets";

const app = createApp();
const httpServer = createServer(app);

initSockets(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`Backend listening on port ${env.PORT}`);
});
