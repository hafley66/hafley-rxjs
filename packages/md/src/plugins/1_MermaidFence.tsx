import { MermaidDiagram } from "../0a_MermaidDiagram.js";
import { fenceOriginOf } from "../0b_fenceOrigin.js";
import { SequenceDiagram } from "../0b_SequenceDiagram.js";
import { isSequenceSource } from "../0b_isSequenceSource.js";
import type { MdFenceProps } from "./0_types.js";

export default function MermaidFence({ code, meta, dark }: MdFenceProps) {
  return isSequenceSource("mermaid", code)
    ? <SequenceDiagram code={code} language="mermaid" dark={dark} sourceStart={fenceOriginOf(meta)} />
    : <MermaidDiagram code={code} dark={dark} />;
}
