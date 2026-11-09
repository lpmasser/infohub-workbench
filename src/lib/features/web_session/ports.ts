export type WebSessionInfo = {
  username: string;
  expires_at: string;
};

export interface WebSessionPort {
  // null when the browser has no valid session.
  current(): Promise<WebSessionInfo | null>;
  login(username: string, password: string): Promise<WebSessionInfo>;
  logout(): Promise<void>;
  // Any request rejected for a missing or expired session.
  on_signed_out(listener: () => void): () => void;
}
