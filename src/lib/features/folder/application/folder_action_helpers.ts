export function parse_reveal_note_path(input: unknown): string {
  if (input && typeof input === "object" && "note_path" in input) {
    const record = input as Record<string, unknown>;
    if (typeof record.note_path === "string") {
      return record.note_path;
    }
  }
  return String(input);
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
