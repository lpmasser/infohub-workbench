import type { CommandDefinition } from "$lib/features/search/types/command_palette";
import { is_web_build } from "$lib/app/runtime_target";

// Commands whose feature the browser build does not have.
const DESKTOP_ONLY_COMMANDS = new Set<CommandDefinition["id"]>([
  "clean_up_legacy_markdown",
  "git_version_history",
  "git_create_checkpoint",
  "git_init_repo",
  "toggle_links_panel",
]);

const ALL_COMMANDS: CommandDefinition[] = [
  {
    id: "create_new_note",
    label: "Create new note",
    description: "Create an untitled note in the current folder",
    keywords: ["new", "add", "create", "note", "file", "document"],
    icon: "file-plus",
  },
  {
    id: "save_note",
    label: "Save Note",
    description: "Save the current note",
    keywords: ["save note", "save current note", "write changes"],
    icon: "file-plus",
  },
  {
    id: "toggle_source_mode",
    label: "Toggle source mode",
    description: "Switch the note between rich text and Markdown source",
    keywords: ["source", "raw", "markdown", "rich", "plain", "mode", "toggle"],
    icon: "code",
  },
  {
    id: "clean_up_legacy_markdown",
    label: "Clean up legacy Markdown…",
    description: "Preview spacing cleanup for notes in this vault",
    keywords: ["clean", "cleanup", "markdown", "spacing", "legacy", "br"],
    icon: "refresh-cw",
  },
  {
    id: "change_vault",
    label: is_web_build ? "切换来源" : "Change vault",
    description: is_web_build
      ? "在我的工作区、main 和草稿之间切换"
      : "Switch to a different vault",
    keywords: ["switch", "vault", "folder", "workspace", "change", "open"],
    icon: "folder-open",
  },
  {
    id: "open_settings",
    label: "Settings",
    description: "Open application settings",
    keywords: ["settings", "preferences", "config", "options", "configure"],
    icon: "settings",
  },
  {
    id: "open_theme_settings",
    label: "Theme Settings",
    description: "Open theme and appearance settings",
    keywords: ["theme", "appearance", "dark mode", "light mode", "colors"],
    icon: "settings",
  },
  {
    id: "open_hotkeys",
    label: "Keyboard Shortcuts",
    description: "Configure keyboard shortcuts and hotkeys",
    keywords: [
      "hotkeys",
      "keyboard",
      "shortcuts",
      "keybindings",
      "keys",
      "remap",
      "bindings",
    ],
    icon: "keyboard",
  },
  {
    id: "toggle_sidebar",
    label: "Toggle Sidebar",
    description: "Show or hide the sidebar",
    keywords: ["sidebar", "navigation", "show sidebar", "hide sidebar"],
    icon: "folder-open",
  },
  {
    id: "find_in_note",
    label: "Find in Note",
    description: "Search within the current note",
    keywords: ["find", "find in note", "search in note", "current note"],
    icon: "settings",
  },
  {
    id: "open_help",
    label: "Open Help",
    description: "Show keyboard shortcuts and app help",
    keywords: ["help", "documentation", "shortcuts", "how to"],
    icon: "keyboard",
  },
  {
    id: "next_tab",
    label: "Next Tab",
    description: "Switch to the next open tab",
    keywords: ["next tab", "switch tab", "forward tab"],
    icon: "folder-open",
  },
  {
    id: "previous_tab",
    label: "Previous Tab",
    description: "Switch to the previous open tab",
    keywords: ["previous tab", "prev tab", "back tab"],
    icon: "folder-open",
  },
  {
    id: "last_used_tab",
    label: "Last Used Tab",
    description: "Switch to the previously active tab",
    keywords: ["last used tab", "previously used tab", "switch back"],
    icon: "history",
  },
  {
    id: "reopen_closed_tab",
    label: "Reopen Closed Tab",
    description: "Reopen the last closed tab",
    keywords: ["reopen tab", "undo close tab", "closed tab"],
    icon: "history",
  },
  {
    id: "sync_index",
    label: "Sync index",
    description: "Rescan vault files and sync search index",
    keywords: ["index", "sync", "search", "vault", "refresh", "rescan"],
    icon: "refresh-cw",
  },
  {
    id: "reindex_vault",
    label: "Reindex vault",
    description: "Rebuild search index for the current vault",
    keywords: ["index", "rebuild", "search", "vault", "reindex", "repair"],
    icon: "settings",
  },
  {
    id: "show_vault_dashboard",
    label: "Show vault dashboard",
    description: "Open vault dashboard overview",
    keywords: ["dashboard", "vault", "overview", "stats", "activity"],
    icon: "folder-open",
  },
  {
    id: "git_version_history",
    label: "Version History",
    description: "View version history for the current note",
    keywords: ["history", "versions", "git", "log", "timeline"],
    icon: "history",
  },
  {
    id: "git_create_checkpoint",
    label: "Create Checkpoint",
    description: "Save a named checkpoint of the current state",
    keywords: ["checkpoint", "snapshot", "save", "git", "commit"],
    icon: "bookmark",
  },
  {
    id: "git_init_repo",
    label: "Initialize Git Repository",
    description: "Initialize version control for this vault",
    keywords: ["git", "init", "repo", "repository", "version", "control"],
    icon: "git-branch",
  },
  {
    id: "toggle_links_panel",
    label: "Toggle Links Panel",
    description: "Show or hide backlinks and outlinks panel",
    keywords: ["links", "backlinks", "outlinks", "context", "panel", "sidebar"],
    icon: "link",
  },
];

export const COMMANDS_REGISTRY: CommandDefinition[] = is_web_build
  ? ALL_COMMANDS.filter((command) => !DESKTOP_ONLY_COMMANDS.has(command.id))
  : ALL_COMMANDS;
