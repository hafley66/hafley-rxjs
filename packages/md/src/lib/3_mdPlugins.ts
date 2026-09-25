import type { ComponentType } from "react";
import type { CodeHighlighterPlugin } from "streamdown";
import type {
  MdFenceCommand,
  MdFenceProps,
  MdImageProps,
  MdInlineCodeProps,
  MdLinkProps,
  MdPlugin,
  MdTableProps,
} from "../plugins/0_types.js";

export interface MdFenceEntry {
  name: string;
  languages: readonly string[];
  component: ComponentType<MdFenceProps>;
}

export interface MdPluginSet {
  fences: readonly MdFenceEntry[];
  table: ComponentType<MdTableProps> | undefined;
  highlight: CodeHighlighterPlugin | undefined;
  commands: readonly MdFenceCommand[];
  /** Inline slots are present only when some plugin claims them. */
  inlineCode?: ComponentType<MdInlineCodeProps>;
  link?: ComponentType<MdLinkProps>;
  image?: ComponentType<MdImageProps>;
}

/** Array order is precedence: the first plugin to claim a language or slot keeps it. */
export function resolveMdPlugins(plugins: readonly MdPlugin[]): MdPluginSet {
  const claimed = new Set<string>();
  const fences: MdFenceEntry[] = [];
  for (const plugin of plugins) {
    if (!plugin.fence) continue;
    const languages = plugin.fence.languages.filter((language) => !claimed.has(language));
    for (const language of languages) claimed.add(language);
    if (languages.length > 0) fences.push({ name: plugin.name, languages, component: plugin.fence.component });
  }
  const inlineCode = plugins.find((plugin) => plugin.inlineCode)?.inlineCode;
  const link = plugins.find((plugin) => plugin.link)?.link;
  const image = plugins.find((plugin) => plugin.image)?.image;
  return {
    fences,
    table: plugins.find((plugin) => plugin.table)?.table,
    highlight: plugins.find((plugin) => plugin.highlight)?.highlight,
    commands: plugins.flatMap((plugin) => (plugin.command ? [plugin.command] : [])),
    ...(inlineCode ? { inlineCode } : {}),
    ...(link ? { link } : {}),
    ...(image ? { image } : {}),
  };
}
