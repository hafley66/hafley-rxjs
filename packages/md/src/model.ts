// The markdown structural model lives in @hafley66/grapht-model, beside the
// other source languages and the spans they share. This module keeps the
// package's export surface pointing at it, so callers see the same names.
export {
  MD_LINK_RE,
  allSectionIds,
  blockAt,
  expandChain,
  mdDocument,
  parseMdSections,
  resolveMdLink,
  sectionDisplayTitle,
  sliceOwn,
  slugify,
} from "@hafley66/grapht-model";

export type { ListFolds, MdBlock, MdBlockKind, MdDoc, MdDocument, MdSection, SourceSpan } from "@hafley66/grapht-model";
