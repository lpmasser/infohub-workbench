// A note to the Agents, kept in the document itself as an HTML comment on
// lines of its own, right after the block it is about:
//   <!-- 批注 2026-11-09 lpmasser：时间不对，应该是 11-06 -->
// The rules match work-ontology core/annotations.mjs: a full-width colon is
// the written form, a half-width one is accepted; content may span lines but
// may not hold another comment.

export type Annotation = {
  date: string;
  author: string;
  text: string;
};

const pattern =
  /^<!--[\t ]*批注[\t ]+(\S+)[\t ]+([^：:\r\n]*?)[：:]([\s\S]*?)-->$/;

function is_iso_date(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

export function parse_annotation(source: string): Annotation | null {
  const match = pattern.exec(source.trim());
  if (!match) return null;
  const [, date = "", raw_author = "", raw_text = ""] = match;
  const author = raw_author.trim();
  const text = raw_text.trim();
  if (
    !is_iso_date(date) ||
    !author ||
    !text ||
    text.includes("<!--") ||
    text.includes("-->")
  )
    return null;
  return { date, author, text };
}

// Why this text cannot be an annotation, or null when it can.
export function annotation_text_problem(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "写点内容再提交";
  if (trimmed.includes("-->") || trimmed.includes("<!--"))
    return "内容里不能有 <!-- 或 -->";
  return null;
}

export function format_annotation(annotation: Annotation): string {
  return `<!-- 批注 ${annotation.date} ${annotation.author}：${annotation.text.trim()} -->`;
}

// The writer's calendar day, not UTC.
export function local_date(now_ms: number): string {
  const date = new Date(now_ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
