import type { AnnotationsPort } from "$lib/features/annotation/ports";
import type { AnnotationStore } from "$lib/features/annotation/state/annotation_store.svelte";
import {
  annotation_text_problem,
  format_annotation,
  local_date,
} from "$lib/features/annotation/domain/annotation";
import type { VaultStore } from "$lib/features/vault";
import { error_message } from "$lib/shared/utils/error_message";

export class AnnotationService {
  private busy = false;
  private pending = false;

  constructor(
    private readonly port: AnnotationsPort,
    private readonly store: AnnotationStore,
    private readonly vault_store: VaultStore,
    private readonly username: string,
    private readonly now_ms: () => number,
  ) {}

  // The comment line for `text` by the signed-in user today, or why not.
  compose(text: string): { line: string } | { problem: string } {
    const problem = annotation_text_problem(text);
    if (problem) return { problem };
    return {
      line: format_annotation({
        date: local_date(this.now_ms()),
        author: this.username,
        text,
      }),
    };
  }

  is_own(author: string): boolean {
    return author === this.username;
  }

  // Reads the open source's annotations. Changes arriving during a read get
  // another read, so the list does not stay behind.
  async refresh(): Promise<void> {
    this.pending = true;
    if (this.busy) return;
    this.busy = true;
    this.store.loading = true;
    try {
      while (this.pending) {
        this.pending = false;
        const source = this.vault_store.vault?.id;
        if (!source) break;
        try {
          const list = await this.port.list(source);
          if (this.vault_store.vault?.id !== source) continue;
          this.store.source = source;
          this.store.list = list;
          this.store.error = null;
        } catch (error) {
          if (this.vault_store.vault?.id !== source) continue;
          this.store.error = error_message(error);
        }
      }
    } finally {
      this.busy = false;
      this.store.loading = false;
    }
  }
}
