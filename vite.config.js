import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter(dep => !dep.includes("control-surface-ui-"));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/") || id.includes("/node_modules/scheduler/")) {
            return "react-vendor";
          }
          if (id.includes("/node_modules/control-surface-ui/")) {
            return "control-surface-ui";
          }
        },
      },
    },
  },
});
