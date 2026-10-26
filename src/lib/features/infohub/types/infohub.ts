export type HubObject = {
  id: string;
  type: string;
  title: string;
  path: string;
  frontmatter: Record<string, unknown>;
};
export type Overview = {
  version: 3;
  references: Record<string, { title: string; path: string }>;
  needsAction: Array<{
    object: HubObject;
    category: "等我拍板" | "卡住了";
    reason: string;
  }>;
  projects: Array<{
    id: string;
    title: string;
    ongoingCount: number;
    deliveredCount: number;
    work: HubObject[];
  }>;
  deliveryWindowDays: number;
  issues: Array<{ path: string; message: string }>;
};
export type SyncStatus = {
  version: 1;
  running: boolean;
  dirtyFiles?: string[];
  blockedFiles?: string[];
  finishedAt?: string;
  pending?: Record<string, string>;
  server?: { drafts: Array<{ changedPaths?: string[] }> } | null;
};
