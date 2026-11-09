import type { VaultPort } from "$lib/features/vault/ports";
import type { WebApi } from "$lib/shared/adapters/web/web_api";
import { WORKSPACE_SOURCE } from "$lib/shared/adapters/web/web_api";
import { as_vault_id, as_vault_path } from "$lib/shared/types/ids";
import type { Vault } from "$lib/shared/types/vault";

type Draft = {
  source?: string;
  updatedAt?: string;
  stale?: boolean;
  conflicts?: string[];
  error?: string;
  overlaps?: Array<{ source?: string; ref: string; paths: string[] }>;
};

type Source = {
  id: string;
  writable: boolean;
  label: string;
  commit?: string;
  draft?: Draft | null;
};

type SourcesResponse = { version: 1; sources: Source[] };

function draft_description(draft: Draft | null | undefined): string {
  if (!draft) return "只读草稿 · 冲突检查尚无结果";
  const parts = ["只读草稿"];
  if (draft.updatedAt)
    parts.push(`更新于 ${draft.updatedAt.slice(0, 16).replace("T", " ")}`);
  if (draft.error) parts.push(`检查失败：${draft.error}`);
  else if (draft.conflicts?.length)
    parts.push(`与 main 冲突：${draft.conflicts.join("、")}`);
  else parts.push("与 main 无冲突");
  for (const overlap of draft.overlaps ?? [])
    parts.push(
      `与 ${overlap.source ?? overlap.ref} 同改：${overlap.paths.join("、")}`,
    );
  if (draft.stale) parts.push("长期搁置");
  return parts.join(" · ");
}

function to_vault(source: Source): Vault {
  const description =
    source.id === WORKSPACE_SOURCE
      ? "可编辑 · 改动由服务器同步提交"
      : source.id === "main"
        ? `只读 · 提交 ${source.commit?.slice(0, 8) ?? "未知"}`
        : draft_description(source.draft);
  return {
    id: as_vault_id(source.id),
    path: as_vault_path(source.id),
    name: source.draft?.source ? `草稿：${source.draft.source}` : source.label,
    created_at: 0,
    is_available: true,
    read_only: !source.writable,
    description,
  };
}

export function create_vault_web_adapter(api: WebApi): VaultPort {
  async function list(): Promise<Vault[]> {
    const response = await api.get_json<SourcesResponse>("/api/sources", 1);
    if (!Array.isArray(response.sources))
      throw new Error("InfoHub 来源列表响应无效，请刷新页面或更新前端");
    return response.sources.map(to_vault);
  }

  async function open(id: string): Promise<Vault> {
    const vault = (await list()).find((item) => item.id === id);
    if (!vault) throw new Error(`来源 ${id} 已不存在（草稿可能已被清理）`);
    return vault;
  }

  return {
    open_vault: open,
    open_vault_by_id: open,
    list_vaults: list,
  };
}
