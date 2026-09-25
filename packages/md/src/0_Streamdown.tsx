import { useCallback, useContext, useMemo, type ComponentProps } from "react";
import { Streamdown, type CustomRendererProps, type ExtraProps, type PluginConfig, type StreamdownProps } from "streamdown";
import { Signal } from "@hafley66/signals";
import { useSignal } from "@hafley66/signals/react";
import "streamdown/styles.css";
import { renderedOffsetsForSourceStarts } from "./0b_fenceOrigin.js";
import { resolveMdPlugins } from "./lib/3_mdPlugins.js";
import { fenceCommandPass, shiftOffsets, type FencePass } from "./lib/4_fenceCommands.js";
import type { MdTableProps } from "./plugins/0_types.js";
import { defaultMdPlugins } from "./plugins/3_defaultMdPlugins.js";
import { MdInlineDocContext, MdPluginContext } from "./plugins/4_MdPluginContext.js";

const controls = {
  code: { copy: true, download: false },
  table: false,
  mermaid: false,
} as const;

const NO_TABLE_STARTS: readonly number[] = [];

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
  const { plugins, runCommand, columns } = useContext(MdPluginContext);
  const inlineDoc = useContext(MdInlineDocContext);
  const set = useMemo(() => resolveMdPlugins(plugins ?? defaultMdPlugins), [plugins]);

  // The pass signal starts at the text as written; a host answer swaps in the rewrite.
  const written = useMemo((): FencePass => ({ source: children, text: children, edits: [] }), [children]);
  const passSignal = useMemo(
    () => Signal(fenceCommandPass(children, set.commands, runCommand, columns), written),
    [children, set.commands, runCommand, columns, written],
  );
  const latest = useSignal(passSignal.$);
  const pass = latest.source === children ? latest : written;

  const renderedTableStarts = useMemo(
    () => shiftOffsets(renderedOffsetsForSourceStarts(children, sourceStart, tableStarts), pass.edits),
    [children, sourceStart, tableStarts, pass.edits],
  );

  // Streamdown uses renderer identity as part of its tree reconciliation. Keep
  // renderers stable across Markdown signal re-renders, otherwise an open
  // MermaidDiagram remounts and its lightbox state returns to false.
  const plugin = useMemo((): PluginConfig => ({
    ...(set.highlight ? { code: set.highlight } : {}),
    renderers: set.fences.map(({ languages, component: Fence }) => ({
      language: [...languages],
      component: (props: CustomRendererProps) => <Fence {...props} dark={dark} />,
    })),
  }), [set, dark]);

  const Table = set.table;
  const TableRenderer = useCallback(
    (props: MdTableProps) => {
      if (!Table) return null;
      const relativeStart = props.node?.position?.start?.offset;
      const ordinal = relativeStart === undefined ? undefined : renderedTableStarts.indexOf(relativeStart);
      return (
        <Table
          {...props}
          node={props.node}
          tableSectionId={sectionId}
          tableOrdinal={ordinal !== undefined && ordinal >= 0 ? ordinal : undefined}
        />
      );
    },
    [Table, sectionId, renderedTableStarts],
  );
  // Inline slots need the document they sit in; outside MdPanel Streamdown keeps its own markup.
  const inlineComponents = useMemo((): StreamdownProps["components"] => {
    if (!inlineDoc) return {};
    const { inlineCode: InlineCode, link: Link, image: Image } = set;
    return {
      ...(InlineCode ? { inlineCode: (props: ComponentProps<"code"> & ExtraProps) => <InlineCode {...props} doc={inlineDoc} /> } : {}),
      ...(Link ? { a: (props: ComponentProps<"a"> & ExtraProps) => <Link {...props} doc={inlineDoc} /> } : {}),
      ...(Image ? { img: (props: ComponentProps<"img"> & ExtraProps) => <Image {...props} doc={inlineDoc} /> } : {}),
    };
  }, [set, inlineDoc]);
  const markdownComponents = useMemo(
    () => ({ ...components, ...inlineComponents, ...(Table ? { table: TableRenderer } : {}) }),
    [components, inlineComponents, Table, TableRenderer],
  );

  return (
    <div className="mdview-streamdown" data-md-code-theme={dark ? "dark" : "light"}>
      <Streamdown
        mode="static"
        components={markdownComponents}
        plugins={plugin}
        controls={controls}
        shikiTheme={["github-light", "github-dark"]}
      >
        {pass.text}
      </Streamdown>
    </div>
  );
}
