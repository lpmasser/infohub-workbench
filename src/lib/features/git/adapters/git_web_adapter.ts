import type { GitPort } from "$lib/features/git/ports";

// The server copy is committed and pushed by its background sync. The web
// page has no Git panel, so it reports "no repository" and offers nothing.
export function create_git_web_adapter(): GitPort {
  const unavailable = () =>
    Promise.reject(new Error("网页版没有 Git 面板，提交由服务器同步完成"));
  return {
    has_repo: () => Promise.resolve(false),
    init_repo: unavailable,
    status: unavailable,
    stage_and_commit: unavailable,
    log: unavailable,
    diff: unavailable,
    show_file_at_commit: unavailable,
    restore_file: unavailable,
    create_tag: unavailable,
  };
}
