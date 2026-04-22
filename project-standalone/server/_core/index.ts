import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { getLocalFilePath } from "../storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`${startPort}부터 사용 가능한 포트를 찾을 수 없습니다`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // 로컬 파일 서빙 (Manus S3 대체)
  app.get("/local-storage/:key", (req, res) => {
    try {
      const key = req.params.key;
      const filePath = getLocalFilePath(key);
      if (!fs.existsSync(filePath)) {
        res.status(404).send("파일을 찾을 수 없습니다");
        return;
      }
      res.sendFile(path.resolve(filePath));
    } catch (err) {
      res.status(500).send("파일 서빙 오류");
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`포트 ${preferredPort}가 사용 중이어서 ${port}를 사용합니다`);
  }

  server.listen(port, () => {
    console.log(`✅ 서버 실행 중: http://localhost:${port}/`);
    console.log(`📁 업로드 폴더: ${path.resolve(ENV.uploadDir)}`);
  });
}

startServer().catch(console.error);
