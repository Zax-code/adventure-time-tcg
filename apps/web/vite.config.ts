import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/assets/web/",
  plugins: [react()],
  build: {
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    outDir: "../phoenix/priv/static/assets/web",
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: [fileURLToPath(new URL("../..", import.meta.url))],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4200",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/media": {
        target: "http://127.0.0.1:4200",
        changeOrigin: false,
      },
      "/images": {
        target: "http://127.0.0.1:4200",
        changeOrigin: false,
      },
      "/.well-known": {
        target: "http://127.0.0.1:4200",
        changeOrigin: false,
      },
      "/socket": {
        target: "ws://127.0.0.1:4200",
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
}));
