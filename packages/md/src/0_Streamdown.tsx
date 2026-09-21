import { useCallback, useMemo, type ComponentProps } from "react";
import { Streamdown, type CustomRendererProps, type StreamdownProps } from "streamdown";
import { code as shikiCode } from "@streamdown/code";
import "streamdown/styles.css";
import { MermaidDiagram } from "./0a_MermaidDiagram.js";
import { D2Diagram } from "./0a_D2Diagram.js";
import { fenceOriginOf, renderedOffsetsForSourceStarts } from "./0b_fenceOrigin.js";
import { SequenceDiagram } from "./0b_SequenceDiagram.js";
import { isSequenceSource } from "./0b_isSequenceSource.js";
import PersistedMarkdownTable from "./5_PersistedMarkdownTable.js";

interface TableNode {
  readonly position?: {
    readonly start?: { readonly offset?: number };
  };
}

const controls = {
  code: { copy: true, download: false },
  table: false,
  mermaid: false,
} as const;

const NO_TABLE_STARTS: readonly number[] = [];

// dl6 is Prolog-shaped and has no bundled Shiki grammar. Preserve the fence's
// displayed language while routing its tokens through the bundled Prolog
// grammar. All other languages retain @streamdown/code's normal dispatch.
const code = {
  ...shikiCode,
  supportsLanguage(language: Parameters<typeof shikiCode.supportsLanguage>[0]) {
    return String(language).toLowerCase() === "dl6" || shikiCode.supportsLanguage(language);
  },
  highlight(
    options: Parameters<typeof shikiCode.highlight>[0],
    callback?: Parameters<typeof shikiCode.highlight>[1],
  ) {
    const language = String(options.language).toLowerCase() === "dl6"
      ? "prolog" as typeof options.language
      : options.language;
    return shikiCode.highlight({ ...options, language }, callback);
  },
};

export default function StreamdownBody({
  children,
  components,
  dark,
  sectionId,
  sourceStart = 0,
  tableStarts = NO_TABLE_STARTS,
}: {
  children: string;
  components: StreamdownProps["components"];
  dark: boolean;
  sectionId?: string;
  sourceStart?: number;
  /** Absolute source offsets of this section's tables, in source order. */
  tableStarts?: readonly number[];
}) {
  // Streamdown uses renderer identity as part of its tree reconciliation. Keep
  // both values stable across Markdown signal re-renders, otherwise an open
  // MermaidDiagram remounts and its lightbox state returns to false.
  const MermaidRenderer = useCallback(
    ({ code, meta }: CustomRendererProps) => isSequenceSource("mermaid", code)
      ? <SequenceDiagram code={code} language="mermaid" dark={dark} sourceStart={fenceOriginOf(meta)} />
      : <MermaidDiagram code={code} dark={dark} />,
    [dark],
  );
  const D2Renderer = useCallback(
    ({ code, meta }: CustomRendererProps) => isSequenceSource("d2", code)
      ? <SequenceDiagram code={code} language="d2" dark={dark} sourceStart={fenceOriginOf(meta)} />
      : <D2Diagram code={code} dark={dark} />,
    [dark],
  );
  const renderedTableStarts = useMemo(
    () => renderedOffsetsForSourceStarts(children, sourceStart, tableStarts),
    [children, sourceStart, tableStarts],
  );
  const TableRenderer = useCallback(
    (props: ComponentProps<"table"> & { readonly node?: TableNode }) => {
      const relativeStart = props.node?.position?.start?.offset;
      const ordinal = relativeStart === undefined ? undefined : renderedTableStarts.indexOf(relativeStart);
      return (
        <PersistedMarkdownTable
          {...props}
          node={props.node}
          tableSectionId={sectionId}
          tableOrdinal={ordinal !== undefined && ordinal >= 0 ? ordinal : undefined}
        />
      );
    },
    [sectionId, renderedTableStarts],
  );
  const plugins = useMemo(
    () => ({
      code,
      renderers: [
        { language: "mermaid", component: MermaidRenderer },
        { language: "d2", component: D2Renderer },
      ],
    }),
    [MermaidRenderer, D2Renderer],
  );
  const markdownComponents = useMemo(
    () => ({ ...components, table: TableRenderer }),
    [components, TableRenderer],
  );

  return (
    <div className="mdview-streamdown" data-md-code-theme={dark ? "dark" : "light"}>
      <Streamdown
        mode="static"
        components={markdownComponents}
        plugins={plugins}
        controls={controls}
        shikiTheme={["github-light", "github-dark"]}
      >
        {children}
      </Streamdown>
    </div>
  );
}
