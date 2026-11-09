import adapter from "@sveltejs/adapter-static";

// The browser build goes to its own folder; build/ stays the Tauri frontend.
const output =
  process.env.VITE_INFOHUB_TARGET === "web" ? "build-web" : "build";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    runes: true,
  },
  kit: {
    alias: {
      "@otterly/markdown-editor": "./packages/markdown_editor/src/index.ts",
    },
    adapter: adapter({
      pages: output,
      assets: output,
      fallback: "index.html",
      precompress: false,
    }),
  },
};

export default config;
