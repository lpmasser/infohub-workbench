import type { MoveItemResult } from "$lib/shared/types/filetree";

export type FolderMoveResult =
  | {
      status: "success";
      results: MoveItemResult[];
    }
  | {
      status: "skipped";
    }
  | {
      status: "failed";
      error: string;
    };

export type FolderLoadResult =
  | {
      status: "stale";
    }
  | {
      status: "skipped";
    }
  | {
      status: "loaded";
      total_count: number;
      has_more: boolean;
    }
  | {
      status: "failed";
      error: string;
    };
