// Payload of filetree.reveal_note: a path, or { note_path, show_explorer }.
// Following the open document leaves the sidebar on whatever it shows.
export function parse_reveal_note(input: unknown): {
  note_path: string;
  show_explorer: boolean;
} {
  if (input && typeof input === "object" && "note_path" in input) {
    const record = input as Record<string, unknown>;
    if (typeof record.note_path === "string") {
      return {
        note_path: record.note_path.trim(),
        show_explorer: record.show_explorer !== false,
      };
    }
  }
  return { note_path: String(input).trim(), show_explorer: true };
}

export function ancestor_folder_paths(note_path: string): string[] {
  const segments = note_path.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return [];
  }

  const folders = segments.slice(0, -1);
  const result: string[] = [];
  for (let i = 0; i < folders.length; i += 1) {
    result.push(folders.slice(0, i + 1).join("/"));
  }
  return result;
}
