import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build, preview } from "vite";

const clientRoot = fileURLToPath(new URL("../client", import.meta.url));
const outDir = fileURLToPath(new URL("../client/dist", import.meta.url));

export async function startViteProxy(apiUrl: string): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  await rm(outDir, { recursive: true, force: true });
  await build({
    configFile: false,
    root: clientRoot,
    logLevel: "silent",
    build: {
      outDir,
      emptyOutDir: true,
    },
  });

  const apiOrigin = new URL(apiUrl).origin;
  const server = await preview({
    configFile: false,
    root: clientRoot,
    logLevel: "silent",
    build: { outDir },
    preview: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
      proxy: {
        "/trpc": {
          target: apiOrigin,
          changeOrigin: true,
          proxyTimeout: 2_000,
          timeout: 2_000,
          configure(proxy) {
            proxy.on("proxyRes", (response) => {
              if (
                !response.headers["content-type"]?.startsWith(
                  "text/event-stream",
                )
              )
                return;
              response.headers["x-accel-buffering"] = "no";
              response.headers["cache-control"] = "no-cache, no-transform";
            });
          },
        },
      },
    },
  });

  const address = server.httpServer.address();
  if (!address || typeof address === "string")
    throw new Error("Expected Vite TCP address");

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await server.close();
      await rm(outDir, { recursive: true, force: true });
    },
  };
}
