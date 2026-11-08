// The browser build (VITE_INFOHUB_TARGET=web) talks to the InfoHub Web API;
// every other build is the Tauri desktop app. Desktop-only entry points
// (Git panel, file manager, document windows, vault folders) check this.
export const is_web_build = import.meta.env.VITE_INFOHUB_TARGET === "web";
