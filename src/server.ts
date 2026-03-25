import { createServer } from "http";
import { createApp } from "./app";
import { startRealtimeDocumentServer } from "./collab/hocuspocus.server";
import { createRealtimeSocketServer } from "./socket/socket.server";
import { env } from "./shared/config/env";
import { prisma } from "./shared/db/prisma";

const bootstrap = async () => {
  const app = createApp();
  const httpServer = createServer(app);

  const realtimeGateway = createRealtimeSocketServer(httpServer);
  const { io, emitVersionCreated } = realtimeGateway;
  app.set("realtimeGateway", realtimeGateway);
  const hocuspocusServer = await startRealtimeDocumentServer({
    onVersionCreated: emitVersionCreated,
  });

  httpServer.listen(env.PORT, () => {
    console.log(`HTTP API ishga tushdi: http://localhost:${env.PORT}`);
    console.log(`Socket.IO shu serverga ulandi`);
    console.log(`Hocuspocus ishga tushdi: ws://localhost:${env.HOCUSPOCUS_PORT}`);
  });

  const gracefulShutdown = async () => {
    console.log("Serverlar to'xtatilmoqda...");

    io.close();
    httpServer.close();
    await hocuspocusServer.destroy();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);
};

bootstrap().catch(async (error) => {
  console.error("Serverni ishga tushirishda xatolik", error);
  await prisma.$disconnect();
  process.exit(1);
});
