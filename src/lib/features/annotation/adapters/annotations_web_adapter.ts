import type {
  AnnotationEntry,
  AnnotationList,
  AnnotationsPort,
} from "$lib/features/annotation/ports";
import type { WebApi } from "$lib/shared/adapters/web/web_api";

type Response = {
  version: 1;
  annotations: Array<Record<string, unknown>>;
  issues: Array<Record<string, unknown>>;
};

function invalid(): Error {
  return new Error("InfoHub 批注列表响应无效，请刷新页面或更新前端");
}

function entry(value: Record<string, unknown>): AnnotationEntry {
  const { path, objectId, title, line, date, author, content } = value;
  if (
    typeof path !== "string" ||
    typeof line !== "number" ||
    typeof date !== "string" ||
    typeof author !== "string" ||
    typeof content !== "string" ||
    (objectId !== null && typeof objectId !== "string") ||
    (title !== null && typeof title !== "string")
  )
    throw invalid();
  return {
    path,
    object_id: objectId,
    title,
    line,
    date,
    author,
    text: content,
  };
}

export function create_annotations_web_adapter(api: WebApi): AnnotationsPort {
  return {
    async list(source): Promise<AnnotationList> {
      const response = await api.get_json<Response>("/api/annotations", 1, {
        source,
      });
      if (
        !Array.isArray(response.annotations) ||
        !Array.isArray(response.issues)
      )
        throw invalid();
      return {
        entries: response.annotations.map(entry),
        issues: response.issues.map((issue) => ({
          path: typeof issue.path === "string" ? issue.path : "",
          line: typeof issue.line === "number" ? issue.line : null,
          message: typeof issue.message === "string" ? issue.message : "",
        })),
      };
    },
  };
}
