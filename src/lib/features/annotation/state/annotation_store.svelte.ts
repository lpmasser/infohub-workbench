import type { AnnotationList } from "$lib/features/annotation/ports";

export class AnnotationStore {
  // The source the list was read from.
  source = $state<string | null>(null);
  list = $state<AnnotationList | null>(null);
  error = $state<string | null>(null);
  loading = $state(false);

  reset() {
    this.source = null;
    this.list = null;
    this.error = null;
    this.loading = false;
  }
}
