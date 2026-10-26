import type { Overview } from "$lib/features/infohub/types/infohub";

export function infohub_overview(title: string): Overview {
  const object = {
    id: "work-1",
    type: "work_item",
    title,
    path: "work.md",
    frontmatter: {},
  };
  return {
    version: 3,
    references: { [object.id]: { title, path: object.path } },
    needsAction: [{ object, category: "等我拍板", reason: "需求待澄清" }],
    projects: [
      {
        id: "project-1",
        title: "项目",
        ongoingCount: 1,
        deliveredCount: 0,
        work: [object],
      },
    ],
    deliveryWindowDays: 14,
    issues: [],
  };
}
