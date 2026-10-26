import type { EditorView } from "@codemirror/view";
import { isMap, isScalar, isSeq, parseDocument, type Node } from "yaml";
import {
  BlockWidget,
  block_for_dom,
  edit_block_source,
  wrap_in_layers,
  type Block,
  type BlockController,
} from "../../core/block_field.js";

export type FrontmatterReference = { title: string; path: string };
export type FrontmatterOptions = {
  resolve_id?: (id: string, field: string) => FrontmatterReference | undefined;
  open_reference?: (path: string) => void;
};
type Value = { text: string; offset: number; reference?: FrontmatterReference };
type Row = { key: string; offset: number; list: boolean; values: Value[] };

// This is generic YAML presentation. Object identity and path resolution belong
// to the host; this plugin never derives an ontology index from note contents.
export function property_rows(
  source: string,
  options: FrontmatterOptions,
): Row[] | null {
  const start = source.indexOf("\n") + 1;
  const body = source.slice(start, source.lastIndexOf("\n"));
  const document = parseDocument(body);
  if (document.errors.length || !isMap(document.contents)) return null;
  const value = (node: Node | null, field: string): Value => {
    const scalar = isScalar(node) ? node.value : undefined;
    const text =
      typeof scalar === "string" ||
      typeof scalar === "number" ||
      typeof scalar === "boolean" ||
      scalar === null
        ? String(scalar)
        : node?.range
          ? body.slice(node.range[0], node.range[1]).trimEnd()
          : "";
    const reference =
      isScalar(node) && typeof node.value === "string"
        ? options.resolve_id?.(node.value, field)
        : undefined;
    return {
      text,
      offset: start + (node?.range?.[0] ?? 0),
      ...(reference ? { reference } : {}),
    };
  };
  const rows: Row[] = [];
  for (const pair of document.contents.items) {
    if (!isScalar(pair.key) || typeof pair.key.value !== "string") return null;
    const key = pair.key.value;
    rows.push({
      key,
      offset: start + (pair.key.range?.[0] ?? 0),
      list: isSeq(pair.value),
      values: isSeq(pair.value)
        ? pair.value.items.map((node) => value(node, key))
        : [value(pair.value, key)],
    });
  }
  return rows;
}

export class FrontmatterWidget extends BlockWidget {
  private readonly signature: string;
  constructor(
    block: Block,
    read_only: boolean,
    readonly rows: Row[],
    readonly options: FrontmatterOptions,
  ) {
    super(block, read_only);
    this.signature = JSON.stringify(rows);
  }
  protected same_options(other: FrontmatterWidget): boolean {
    return this.signature === other.signature;
  }
  protected estimate_height(): number {
    return this.rows.length * 32 + 16;
  }
  protected create_controller(view: EditorView): BlockController {
    return new FrontmatterController(view, this);
  }
}

class FrontmatterController implements BlockController {
  readonly root: HTMLElement;
  constructor(
    readonly view: EditorView,
    private readonly widget: FrontmatterWidget,
  ) {
    const table = document.createElement("table");
    table.className = "md-frontmatter-table";
    table.setAttribute("aria-label", "YAML properties");
    const body = table.createTBody();
    for (const row of widget.rows) {
      const tr = body.insertRow();
      const key = document.createElement("th");
      key.scope = "row";
      key.textContent = row.key;
      key.onclick = () => this.edit(row.offset);
      tr.append(key);
      const cell = tr.insertCell();
      cell.onclick = () => this.edit(row.values[0]?.offset ?? row.offset);
      for (const value of row.values) {
        const reference = value.reference;
        const element = document.createElement(
          reference && widget.options.open_reference ? "button" : "span",
        );
        element.className = row.list
          ? "md-frontmatter-tag"
          : "md-frontmatter-value";
        element.textContent = reference?.title ?? value.text;
        if (element instanceof HTMLButtonElement && reference) {
          element.type = "button";
          element.classList.add("md-frontmatter-reference");
          element.title = `${value.text}\n${reference.path}`;
          element.onclick = (event) => {
            event.stopPropagation();
            widget.options.open_reference?.(reference.path);
          };
        } else
          element.onclick = (event) => {
            event.stopPropagation();
            this.edit(value.offset);
          };
        cell.append(element);
      }
    }
    this.root = wrap_in_layers(widget.block, table);
    this.root.classList.add("md-frontmatter-widget");
    this.root.dataset.mdBlock = "frontmatter";
  }
  private edit(offset: number): boolean {
    const block = block_for_dom(this.view, this.root);
    if (!block) return false;
    this.view.dispatch({
      effects: edit_block_source.of(block.from),
      selection: { anchor: Math.min(block.to, block.from + offset) },
    });
    this.view.focus();
    return true;
  }
  enter(side: -1 | 1): boolean {
    return this.edit(side === 1 ? 0 : this.widget.block.source.length);
  }
  update(widget: BlockWidget): boolean {
    return this.widget.eq(widget);
  }
  destroy(): void {}
}
