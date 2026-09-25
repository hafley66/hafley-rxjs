import { D2Diagram } from "../0a_D2Diagram.js";
import { fenceOriginOf } from "../0b_fenceOrigin.js";
import { SequenceDiagram } from "../0b_SequenceDiagram.js";
import { isSequenceSource } from "../0b_isSequenceSource.js";
import type { MdFenceProps } from "./0_types.js";

export default function D2Fence({ code, meta, dark }: MdFenceProps) {
  return isSequenceSource("d2", code)
    ? <SequenceDiagram code={code} language="d2" dark={dark} sourceStart={fenceOriginOf(meta)} />
    : <D2Diagram code={code} dark={dark} />;
}
