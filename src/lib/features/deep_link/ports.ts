// The browser address bar and its history.
export interface LocationPort {
  current(): URL;
  // A new history entry, so Back returns to the previous document.
  push(href: string): void;
  replace(href: string): void;
  // Back and Forward. Returns an unsubscribe function.
  on_history_move(listener: (url: URL) => void): () => void;
}
