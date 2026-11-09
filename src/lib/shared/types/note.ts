import type { MarkdownText, NoteId, NotePath } from "$lib/shared/types/ids";

export type NoteMeta = {
  id: NoteId;
  path: NotePath;
  name: string;
  title: string;
  // Server version (ETag) of the text this meta describes; null when this
  // page has not read the file, as for tree listings and new notes.
  version: string | null;
  size_bytes: number;
};

export type NoteDoc = {
  meta: NoteMeta;
  markdown: MarkdownText;
};
