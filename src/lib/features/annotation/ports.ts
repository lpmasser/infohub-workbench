import type { VaultId } from "$lib/shared/types/ids";

// One annotation as the server found it in a source.
export type AnnotationEntry = {
  path: string;
  object_id: string | null;
  title: string | null;
  // 1-based lines of the saved file.
  line: number;
  date: string;
  author: string;
  text: string;
};

export type AnnotationList = {
  entries: AnnotationEntry[];
  // Malformed annotations, by path and line.
  issues: Array<{ path: string; line: number | null; message: string }>;
};

export interface AnnotationsPort {
  list(source: VaultId): Promise<AnnotationList>;
}
