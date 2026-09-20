import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/**
 * 開発時は /api・/ws をサーバへ中継する（architecture「tasks への申し送り」11）。
 * 出力は packages/web/dist（サーバの composeServer.ts の webDistDirFor() が配る場所）。
 */
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:7780",
      "/ws": { target: "ws://127.0.0.1:7780", ws: true },
    },
  },
  build: {
    outDir: "dist",
  },
});
