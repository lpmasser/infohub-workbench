// Which document the address bar currently names, so opening it does not
// add a second history entry for the same document.
export class DeepLinkStore {
  shown_path = $state<string | null>(null);
  // False until the address the page was loaded with has been opened; the
  // address bar is left alone until then.
  ready = $state(false);
}
