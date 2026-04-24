import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Group React + everything that depends directly on React in a single
          // chunk to avoid circular chunk references (vendor -> react -> vendor)
          // which break runtime with "Cannot read properties of undefined (reading 'createContext')".
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("react-router") ||
            id.includes("@tanstack") ||
            id.includes("@radix-ui") ||
            id.includes("framer-motion") ||
            id.includes("react-hook-form") ||
            id.includes("@hookform") ||
            id.includes("next-themes") ||
            id.includes("sonner") ||
            id.includes("vaul") ||
            id.includes("cmdk") ||
            id.includes("embla-carousel") ||
            id.includes("react-day-picker") ||
            id.includes("react-resizable-panels") ||
            id.includes("input-otp") ||
            id.includes("qrcode.react")
          ) {
            return "react-vendor";
          }
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("date-fns")) return "date";
          return "vendor";
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
    ],
  },
}));
