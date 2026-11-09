import type { InfoHubPort } from "$lib/features/infohub";
import type { LocationPort } from "$lib/features/deep_link/ports";
import type { DeepLinkStore } from "$lib/features/deep_link/state/deep_link_store.svelte";
import {
  document_link,
  format_deep_link,
  parse_deep_link,
  type DeepLink,
} from "$lib/features/deep_link/domain/deep_link";

export class DeepLinkService {
  // The address the page was loaded with, before anything opened.
  readonly initial: DeepLink;

  constructor(
    private readonly location_port: LocationPort,
    private readonly infohub_port: InfoHubPort,
    private readonly store: DeepLinkStore,
  ) {
    this.initial = parse_deep_link(location_port.current());
  }

  finish_initial(): void {
    this.store.ready = true;
  }

  // The path an object link names, null when the workspace has no such
  // object (not pushed yet, or deleted).
  async target_path(link: DeepLink): Promise<string | null> {
    if (link.kind === "file") return link.path;
    if (link.kind === "object")
      return await this.infohub_port.object_path(link.id);
    return null;
  }

  // Opening a document from an address: the address already names it.
  mark_shown(path: string): void {
    this.store.shown_path = path;
  }

  // The address bar follows the open document: a new history entry when the
  // document changes, an in-place update when the same document gets a
  // better address (its object id became known).
  show_document(path: string, source: string, object_id: string | null) {
    const href = format_deep_link(document_link(path, source, object_id));
    const current = this.location_port.current();
    const same_document = this.store.shown_path === path;
    if (same_document && `${current.pathname}${current.search}` === href)
      return;
    if (same_document || this.store.shown_path === null)
      this.location_port.replace(`${href}${same_document ? current.hash : ""}`);
    else this.location_port.push(href);
    this.store.shown_path = path;
  }

  on_history_move(listener: (link: DeepLink) => void): () => void {
    return this.location_port.on_history_move((url) => {
      listener(parse_deep_link(url));
    });
  }
}
