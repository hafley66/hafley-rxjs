// Shapes follow the codehike.org recipes (mark, focus, callout, token-transitions);
// visuals are class names and data attributes that lab.css styles through --ch-* properties.
import { Component, useMemo } from "react";
import { from } from "rxjs";
import {
  getPreRef,
  highlight,
  InnerLine,
  InnerPre,
  InnerToken,
  type AnnotationHandler,
  type BlockAnnotation,
  type CustomPreProps,
  type HighlightedCode,
  type InlineAnnotation,
  type RawCode,
} from "codehike/code";
import { calculateTransitions, getStartingSnapshot, type TokenTransitionsSnapshot } from "codehike/utils/token-transitions";
import { Signal } from "@hafley66/signals";
import { useSignal } from "@hafley66/signals/react";

export const THEME = "github-dark";

/** `// !mark` (line) and `// !mark[/regex/]` (inline). */
export const mark: AnnotationHandler = {
  name: "mark",
  Line: ({ annotation, ...props }) => <InnerLine merge={props} className="ch-line" data-mark={annotation ? "line" : undefined} />,
  Inline: ({ children }) => <span className="ch-mark-inline">{children}</span>,
};

/** `// !focus` and `// !focus(1:3)`: every other line dims. */
export const focus: AnnotationHandler = {
  name: "focus",
  onlyIfAnnotated: true,
  Line: (props) => <InnerLine merge={props} className="ch-line ch-focus-dim" />,
  AnnotatedLine: ({ annotation: _annotation, ...props }) => <InnerLine merge={props} className="ch-line" data-focus="" />,
};

/** `// !callout[/word/] text`: an inline range becomes a block under its line, arrow at the range middle. */
export const callout: AnnotationHandler = {
  name: "callout",
  transform: (annotation: InlineAnnotation): BlockAnnotation => ({
    name: annotation.name,
    query: annotation.query,
    fromLineNumber: annotation.lineNumber,
    toLineNumber: annotation.lineNumber,
    data: { column: (annotation.fromColumn + annotation.toColumn) / 2 },
  }),
  Block: ({ annotation, children }) => {
    const column = typeof annotation.data?.column === "number" ? annotation.data.column : 0;
    return (
      <>
        {children}
        <div className="ch-callout" style={{ "--ch-callout-column": `${column}ch` } as React.CSSProperties}>
          {annotation.query}
        </div>
      </>
    );
  },
};

const MAX_TRANSITION_MS = 900;

// codehike.org's SmoothPre: snapshot token boxes before React commits, FLIP them after.
class SmoothPre extends Component<CustomPreProps> {
  ref = getPreRef(this.props);

  render() {
    return <InnerPre merge={this.props} style={{ position: "relative" }} />;
  }

  getSnapshotBeforeUpdate(): TokenTransitionsSnapshot {
    return getStartingSnapshot(this.ref.current);
  }

  componentDidUpdate(_props: CustomPreProps, _state: unknown, snapshot: TokenTransitionsSnapshot) {
    for (const { element, keyframes, options } of calculateTransitions(this.ref.current, snapshot)) {
      const { translateX, translateY, ...rest } = keyframes;
      const frames: PropertyIndexedKeyframes = { ...rest };
      if (translateX && translateY) {
        frames.translate = [`${translateX[0]}px ${translateY[0]}px`, `${translateX[1]}px ${translateY[1]}px`];
      }
      element.animate(frames, {
        duration: options.duration * MAX_TRANSITION_MS,
        delay: options.delay * MAX_TRANSITION_MS,
        easing: options.easing,
        fill: "both",
      });
    }
  }
}

export const tokenTransitions: AnnotationHandler = {
  name: "token-transitions",
  PreWithRef: SmoothPre,
  Token: (props) => <InnerToken merge={props} style={{ display: "inline-block" }} />,
};

/** highlight() is async (lighter loads the grammar chunk); null until it resolves. */
export function useHighlighted(raw: RawCode): HighlightedCode | null {
  const signal = useMemo(
    () => Signal<HighlightedCode | null>(from(highlight(raw, THEME)), null),
    [raw.value, raw.lang, raw.meta],
  );
  return useSignal(signal.$);
}

export function useHighlightedAll(raws: readonly RawCode[]): readonly HighlightedCode[] | null {
  const signal = useMemo(
    () => Signal<readonly HighlightedCode[] | null>(from(Promise.all(raws.map((raw) => highlight(raw, THEME)))), null),
    [raws],
  );
  return useSignal(signal.$);
}
