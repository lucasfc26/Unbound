import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Rust's build output lives under src-tauri/target — watching it causes
    // EBUSY crashes on Windows when cargo has files open during a build.
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
