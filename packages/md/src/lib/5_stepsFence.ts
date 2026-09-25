import { applyPatch } from "diff";

export interface CodeStep {
  title: string;
  code: string;
  from: "literal" | "patch";
  error?: string;
}

export interface StepsFence {
  lang: string;
  steps: readonly CodeStep[];
}

const STEP_LINE = /^--- ?step(?::|\s|$)\s*(.*)$/;
const PATCH_START = /^(@@ |--- |diff |Index: )/;

// States split on `--- step <title>` lines; a segment opening with `@@`, `---`, `diff` or `Index:`
// is a unified-diff patch applied (jsdiff applyPatch) to the previous state.
export function parseStepsFence(body: string, meta: string | undefined): StepsFence {
  const lang = meta?.trim().split(/\s+/)[0] ?? "";
  const segments: { title: string; lines: string[] }[] = [{ title: "", lines: [] }];
  for (const line of body.replace(/\n$/, "").split("\n")) {
    const separator = STEP_LINE.exec(line);
    if (separator) segments.push({ title: separator[1].trim(), lines: [] });
    else segments[segments.length - 1].lines.push(line);
  }
  const kept = segments.filter((segment, index) => index > 0 || segment.lines.some((line) => line !== "") || segments.length === 1);
  const steps: CodeStep[] = [];
  for (const { title, lines } of kept) {
    const text = lines.join("\n");
    const previous = steps.length > 0 ? steps[steps.length - 1].code : "";
    const firstLine = lines.find((line) => line !== "") ?? "";
    if (!PATCH_START.test(firstLine)) {
      steps.push({ title, code: text, from: "literal" });
      continue;
    }
    const applied = applyPatch(previous, `${text}\n`);
    steps.push(applied === false
      ? { title, code: previous, from: "patch", error: "patch does not apply to the previous step" }
      : { title, code: applied, from: "patch" });
  }
  return { lang, steps };
}
