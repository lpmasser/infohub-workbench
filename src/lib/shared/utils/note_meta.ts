import { as_note_path } from "$lib/shared/types/ids";
import type { NoteMeta } from "$lib/shared/types/note";

// A file's meta from its path. Titles would need every file's content, so
// the name doubles as the title.
export function note_meta(
  path: string,
  size_bytes: number,
  version: string | null = null,
): NoteMeta {
  const id = as_note_path(path);
  const name = (path.split("/").at(-1) ?? path).replace(/\.md$/, "");
  return { id, path: id, name, title: name, version, size_bytes };
}
