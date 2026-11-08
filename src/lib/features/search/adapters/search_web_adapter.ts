import type { SearchPort } from "$lib/features/search/ports";
import { resolve_wiki_target } from "$lib/features/search/domain/resolve_wiki_target";
import type { WebFiles } from "$lib/shared/adapters/web/web_files";
import { as_note_path } from "$lib/shared/types/ids";
import type { NoteMeta } from "$lib/shared/types/note";
import type { NoteSearchHit } from "$lib/shared/types/search";

type SearchResponse = {
  version: 1;
  matches: Array<{ path: string; line: number; snippet: string }>;
  truncated: boolean;
};

const SEARCH_LIMIT = 500;

function meta(path: string, size_bytes: number): NoteMeta {
  const id = as_note_path(path);
  const name = (path.split("/").at(-1) ?? path).replace(/\.md$/, "");
  return { id, path: id, name, title: name, mtime_ms: 0, size_bytes };
}

// File-name matches come from the tree the page already has. Names starting
// with the query rank first, then names containing it, then paths.
function rank_path(path: string, query: string): number {
  const name = (path.split("/").at(-1) ?? path).toLowerCase();
  const lower = path.toLowerCase();
  if (name.startsWith(query)) return 3;
  if (name.includes(query)) return 2;
  if (lower.includes(query)) return 1;
  return 0;
}

function no_link_index(): Promise<never> {
  return Promise.reject(new Error("网页版没有链接索引"));
}

export function create_search_web_adapter(files: WebFiles): SearchPort {
  async function suggest(
    vault_id: string,
    query: string,
    limit: number,
    markdown_only: boolean,
  ): Promise<NoteSearchHit[]> {
    const needle = query.trim().toLowerCase();
    const tree = await files.tree(vault_id);
    const hits: NoteSearchHit[] = [];
    for (const [path, size] of tree.files) {
      if (markdown_only && !path.toLowerCase().endsWith(".md")) continue;
      const score = needle ? rank_path(path, needle) : 1;
      if (score > 0) hits.push({ note: meta(path, size), score });
    }
    return hits
      .sort(
        (a, b) => b.score - a.score || a.note.path.localeCompare(b.note.path),
      )
      .slice(0, limit);
  }

  return {
    // Server-side literal search; one hit per file, at its first matching line.
    async search_notes(vault_id, query, limit = 50) {
      const text = query.text.trim();
      if (!text) return [];
      const response = await files.api.get_json<SearchResponse>(
        "/api/search",
        1,
        {
          source: vault_id,
          q: text.slice(0, 200),
          limit: String(SEARCH_LIMIT),
        },
      );
      const tree = await files.tree(vault_id).catch(() => null);
      const hits = new Map<string, NoteSearchHit>();
      for (const match of response.matches) {
        const hit = hits.get(match.path);
        if (hit) {
          hit.score += 1;
          continue;
        }
        hits.set(match.path, {
          note: meta(match.path, tree?.files.get(match.path) ?? 0),
          score: 1,
          snippet: match.snippet,
        });
      }
      return [...hits.values()].slice(0, limit);
    },
    suggest_files: (vault_id, query, limit = 15) =>
      suggest(vault_id, query, limit, false),
    async suggest_wiki_links(vault_id, query, limit = 15) {
      const hits = await suggest(vault_id, query, limit, true);
      return hits.map((hit) => ({
        kind: "existing" as const,
        note: hit.note,
        score: hit.score,
      }));
    },
    suggest_planned_links: () => Promise.resolve([]),
    get_note_links_snapshot: no_link_index,
    extract_local_note_links: no_link_index,
    rewrite_note_links: no_link_index,
    resolve_note_link: (source_path, raw_target) =>
      Promise.resolve(resolve_wiki_target(source_path, raw_target)),
  };
}
