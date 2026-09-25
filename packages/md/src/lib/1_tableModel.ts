import { Children, isValidElement, type ReactNode, type ReactElement } from "react";

export interface MarkdownTableRow {
  readonly id: string;
  readonly cells: readonly ReactNode[];
  readonly values: readonly string[];
}

export interface MarkdownTableModel {
  readonly headers: readonly ReactNode[];
  readonly headerValues: readonly string[];
  readonly alignments: readonly ("left" | "center" | "right" | undefined)[];
  readonly rows: readonly MarkdownTableRow[];
}

type ElementWithChildren = ReactElement<{
  readonly children?: ReactNode;
  readonly align?: string;
  readonly style?: { readonly textAlign?: string };
  readonly node?: { readonly tagName?: string };
}>;
interface ParsedCell {
  readonly children: ReactNode;
  readonly alignment: "left" | "center" | "right" | undefined;
}

const textOf = (value: ReactNode): string => {
  if (value === null || value === undefined || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join("");
  if (isValidElement(value)) return textOf((value as ReactElement<{ readonly children?: ReactNode }>).props.children);
  return "";
};

const elementsOf = (value: ReactNode): readonly ElementWithChildren[] => {
  return Children.toArray(value).filter(isValidElement) as readonly ElementWithChildren[];
};

const htmlTagOf = (element: ElementWithChildren): string | undefined => {
  if (typeof element.type === "string") return element.type;
  const nodeTag = element.props.node?.tagName;
  if (nodeTag !== undefined) return nodeTag;
  const displayName = (element.type as { readonly displayName?: string }).displayName;
  return displayName?.replace(/^Markdown/, "").toLowerCase();
};

const alignmentOf = (cell: ElementWithChildren): ParsedCell["alignment"] => {
  const alignment = cell.props.align ?? cell.props.style?.textAlign;
  return alignment === "left" || alignment === "center" || alignment === "right" ? alignment : undefined;
};

const cellsOf = (value: ReactNode): readonly ParsedCell[] => {
  return elementsOf(value)
    .filter((cell) => htmlTagOf(cell) === "th" || htmlTagOf(cell) === "td")
    .map((cell) => ({ children: cell.props.children, alignment: alignmentOf(cell) }));
};

const rowsOf = (value: ReactNode): readonly (readonly ParsedCell[])[] => {
  return elementsOf(value)
    .filter((row) => htmlTagOf(row) === "tr")
    .map((row) => cellsOf(row.props.children));
};

const sectionsOf = (value: ReactNode): {
  readonly head: readonly (readonly ParsedCell[])[];
  readonly body: readonly (readonly ParsedCell[])[];
} => {
  const sections = elementsOf(value);
  const head: (readonly ParsedCell[])[] = [];
  const body: (readonly ParsedCell[])[] = [];
  for (const section of sections) {
    const rows = rowsOf(section.props.children);
    if (htmlTagOf(section) === "thead") head.push(...rows);
    else if (htmlTagOf(section) === "tbody") body.push(...rows);
    else if (htmlTagOf(section) === "tr") {
      body.push(cellsOf(section.props.children));
    }
  }
  if (head.length === 0 && body.length > 0) return { head: [body[0]!], body: body.slice(1) };
  return { head, body };
};

const rectangular = (rows: readonly (readonly ParsedCell[])[], width: number): readonly (readonly ParsedCell[])[] => {
  return rows.map((row) => Array.from(
    { length: width },
    (_, index) => row[index] ?? { children: null, alignment: undefined },
  ));
};

/** Converts Streamdown's table element tree into stable row and column identities. */
export function markdownTableModel(children: ReactNode): MarkdownTableModel {
  const sections = sectionsOf(children);
  const width = Math.max(0, ...sections.head.concat(sections.body).map((row) => row.length));
  const headerCells = rectangular(sections.head.slice(0, 1), width)[0] ?? [];
  const headers = headerCells.map((cell) => cell.children);
  const rows = rectangular(sections.body, width).map((cells, index) => ({
    id: `row-${index}`,
    cells: cells.map((cell) => cell.children),
    values: cells.map((cell) => textOf(cell.children)),
  }));
  return {
    headers,
    headerValues: headers.map(textOf),
    alignments: headerCells.map((cell) => cell.alignment),
    rows,
  };
}

export interface CodeToken {
  readonly text: string;
  readonly className: string | undefined;
}

const codeRunsOf = (value: ReactNode): readonly CodeToken[] => {
  if (Array.isArray(value)) return value.flatMap(codeRunsOf);
  if (!isValidElement(value)) return [];
  const element = value as ElementWithChildren & ReactElement<{ readonly className?: string }>;
  if (htmlTagOf(element) !== "code") return codeRunsOf(element.props.children);
  return textOf(element.props.children).split(/\s+/).map((text) => ({ text, className: element.props.className }));
};

/** Per column, the longest whitespace-free run of inline code in its body cells. */
export function longestCodeTokens(model: MarkdownTableModel): readonly (CodeToken | undefined)[] {
  return model.headers.map((_, index) => model.rows
    .flatMap((row) => codeRunsOf(row.cells[index]))
    .reduce<CodeToken | undefined>((longest, token) => token.text.length > (longest?.text.length ?? 0) ? token : longest, undefined));
}

export { textOf as markdownTableText };
