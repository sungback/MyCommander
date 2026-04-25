import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const devHost = host || "127.0.0.1";

const getManualChunk = (id: string) => {
  const normalizedId = id.replace(/\\/g, "/");

  if (!normalizedId.includes("node_modules")) {
    return undefined;
  }

  if (normalizedId.includes("/node_modules/xlsx/")) {
    return "xlsx-vendor";
  }
  if (normalizedId.includes("/node_modules/jszip/")) {
    return "jszip-vendor";
  }
  if (normalizedId.includes("/node_modules/marked/")) {
    return "marked-vendor";
  }
  if (normalizedId.includes("/node_modules/highlight.js/")) {
    return "highlight-vendor";
  }
  if (
    normalizedId.includes("/node_modules/react/") ||
    normalizedId.includes("/node_modules/react-dom/") ||
    normalizedId.includes("/node_modules/scheduler/")
  ) {
    return "react-vendor";
  }
  if (
    normalizedId.includes("/node_modules/@tauri-apps/") ||
    normalizedId.includes("/node_modules/@crabnebula/")
  ) {
    return "tauri-vendor";
  }
  if (
    normalizedId.includes("/node_modules/@radix-ui/") ||
    normalizedId.includes("/node_modules/@tanstack/") ||
    normalizedId.includes("/node_modules/lucide-react/") ||
    normalizedId.includes("/node_modules/re-resizable/") ||
    normalizedId.includes("/node_modules/react-resizable-panels/")
  ) {
    return "ui-vendor";
  }

  return undefined;
};

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: devHost,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },
}));
