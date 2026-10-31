import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || "https://cdzzewovtxotkghzeafr.supabase.co";
  const supabaseProjectId = env.VITE_SUPABASE_PROJECT_ID || "cdzzewovtxotkghzeafr";
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkenpld292dHhvdGtnaHplYWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTY0OTAsImV4cCI6MjA4OTA5MjQ5MH0.vleBKxXwibG2H7SmJgzhQ_EGfi6MKJxItB-z4w0Uwvg";

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
    plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
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
            // Só o React em si: "includes('react')" puxava também @radix-ui/react-*, react-smooth (dos gráficos)
            // etc., e o pacote de gráficos acabava baixando em todas as páginas
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "react-vendor";
            // Utilitários usados em toda a interface: se ficarem sem dono, vão parar no pacote de gráficos
            if (/node_modules\/(clsx|tailwind-merge|class-variance-authority)\//.test(id)) return "utils";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("@radix-ui")) return "ui-components";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("recharts")) return "charts";
            if (id.includes("date-fns")) return "date";
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
  };
});
