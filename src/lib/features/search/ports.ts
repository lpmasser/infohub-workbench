import type { VaultId } from "$lib/shared/types/ids";
import type {
  NoteSearchHit,
  PlannedLinkSuggestion,
  SearchQuery,
  WikiSuggestion,
  IndexProgressEvent,
} from "$lib/shared/types/search";

export type { IndexProgressEvent };

export interface SearchPort {
  search_notes(
    vault_id: VaultId,
    query: SearchQuery,
    limit?: number,
  ): Promise<NoteSearchHit[]>;
  suggest_files(
    vault_id: VaultId,
    query: string,
    limit?: number,
  ): Promise<NoteSearchHit[]>;
  suggest_wiki_links(
    vault_id: VaultId,
    query: string,
    limit?: number,
  ): Promise<WikiSuggestion[]>;
  suggest_planned_links(
    vault_id: VaultId,
    query: string,
    limit?: number,
  ): Promise<PlannedLinkSuggestion[]>;
  resolve_note_link(
    source_path: string,
    raw_target: string,
  ): Promise<string | null>;
}

// The "index" is the source's file tree. A sync reads it (again if it
// changed) and reports progress, so views waiting for a finished index
// refresh after it.
export interface WorkspaceIndexPort {
  sync_index(vault_id: VaultId): Promise<void>;
  rebuild_index(vault_id: VaultId): Promise<void>;
  subscribe_index_progress(
    callback: (event: IndexProgressEvent) => void,
  ): () => void;
}
