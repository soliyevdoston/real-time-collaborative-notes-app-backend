"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const app_1 = require("./app");
const hocuspocus_server_1 = require("./collab/hocuspocus.server");
const socket_server_1 = require("./socket/socket.server");
const env_1 = require("./shared/config/env");
const prisma_1 = require("./shared/db/prisma");
const bootstrap = async () => {
    const app = (0, app_1.createApp)();
    const httpServer = (0, http_1.createServer)(app);
    const realtimeGateway = (0, socket_server_1.createRealtimeSocketServer)(httpServer);
    const { io, emitVersionCreated } = realtimeGateway;
    app.set("realtimeGateway", realtimeGateway);
    const hocuspocusServer = await (0, hocuspocus_server_1.startRealtimeDocumentServer)({
        onVersionCreated: emitVersionCreated,
    });
    httpServer.listen(env_1.env.PORT, () => {
        console.log(`HTTP API ishga tushdi: http://localhost:${env_1.env.PORT}`);
        console.log(`Socket.IO shu serverga ulandi`);
        console.log(`Hocuspocus ishga tushdi: ws://localhost:${env_1.env.HOCUSPOCUS_PORT}`);
    });
    const gracefulShutdown = async () => {
        console.log("Serverlar to'xtatilmoqda...");
        io.close();
        httpServer.close();
        await hocuspocusServer.destroy();
        await prisma_1.prisma.$disconnect();
        process.exit(0);
    };
    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
};
bootstrap().catch(async (error) => {
    console.error("Serverni ishga tushirishda xatolik", error);
    await prisma_1.prisma.$disconnect();
    process.exit(1);
});
