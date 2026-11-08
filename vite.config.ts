import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// `pnpm dev:web` serves the browser build and forwards the API to a local
// InfoHub Web service, so the page and the API share one origin.
const web_api_target = process.env.INFOHUB_WEB_API ?? "http://127.0.0.1:3999";

export default defineConfig({
  plugins: [sveltekit(), tailwindcss()],
  // Keep standalone editor spikes from replacing the app's optimized modules.
  cacheDir: "node_modules/.vite/otterly",
  optimizeDeps: {
    // Code block grammars load through dynamic imports inside language-data.
    // Prebundle them up front, otherwise the first highlighted block in a dev
    // window triggers a dependency reload and its import fails.
    include: ["@codemirror/language-data"],
  },
  worker: {
    format: "es",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    // SvelteKit limits served roots to src; the editor workspace lives beside it.
    fs: { allow: ["packages"] },
    proxy:
      process.env.VITE_INFOHUB_TARGET === "web"
        ? { "/api": { target: web_api_target } }
        : {},
    watch: {
      ignored: ["**/src-tauri/target/**", "**/.pnpm-store/**", "**/.codex/**"],
    },
  },
  css: {
    transformer: "lightningcss",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/*/tests/**/*.test.ts"],
  },
});
