import { Component, useContext, useMemo } from "react";
import { combineLatest } from "rxjs";
import {
  getPreRef,
  InnerLine,
  InnerPre,
  InnerToken,
  Pre,
  type AnnotationHandler,
  type CustomPreProps,
  type HighlightedCode,
} from "codehike/code";
import { calculateTransitions, getStartingSnapshot, type TokenTransitionsSnapshot } from "codehike/utils/token-transitions";
import { Signal } from "@hafley66/signals";
import { useSignal } from "@hafley66/signals/react";
import { resolveMdPlugins } from "../lib/3_mdPlugins.js";
import { parseStepsFence } from "../lib/5_stepsFence.js";
import { highlight$ } from "../lib/6_hikeTokens.js";
import type { MdFenceProps } from "./0_types.js";
import { defaultMdPlugins } from "./3_defaultMdPlugins.js";
import { MdPluginContext } from "./4_MdPluginContext.js";
import "./steps.css";

// Code Hike's SmoothPre recipe: token boxes are snapshotted before React commits, then FLIPped.
// Timing reads --md-steps-duration (ms) so a theme can slow or disable it.
class SmoothPre extends Component<CustomPreProps> {
  ref = getPreRef(this.props);

  render() {
    return <InnerPre merge={this.props} />;
  }

  getSnapshotBeforeUpdate(): TokenTransitionsSnapshot {
    return getStartingSnapshot(this.ref.current);
  }

  componentDidUpdate(_props: CustomPreProps, _state: unknown, snapshot: TokenTransitionsSnapshot) {
    const pre = this.ref.current;
    const duration = Number.parseFloat(getComputedStyle(pre).getPropertyValue("--md-steps-duration")) || 0;
    if (duration <= 0) return;
    for (const { element, keyframes, options } of calculateTransitions(pre, snapshot)) {
      const { translateX, translateY, ...rest } = keyframes;
      const frames: PropertyIndexedKeyframes = { ...rest };
      if (translateX && translateY) {
        frames.translate = [`${translateX[0]}px ${translateY[0]}px`, `${translateX[1]}px ${translateY[1]}px`];
      }
      element.animate(frames, {
        duration: options.duration * duration,
        delay: options.delay * duration,
        easing: options.easing,
        fill: "both",
      });
    }
  }
}

const tokenTransitions: AnnotationHandler = {
  name: "md-steps-transitions",
  PreWithRef: SmoothPre,
  Line: (props) => <InnerLine merge={props} className="md-steps-line" />,
  Token: (props) => <InnerToken merge={props} className="md-steps-token" />,
};
const HANDLERS = [tokenTransitions];

export default function StepsFence({ code, meta, dark }: MdFenceProps) {
  const { plugins } = useContext(MdPluginContext);
  const highlighter = useMemo(() => resolveMdPlugins(plugins ?? defaultMdPlugins).highlight, [plugins]);
  const fence = useMemo(() => parseStepsFence(code, meta), [code, meta]);
  const highlighted = useMemo(
    () => Signal<readonly HighlightedCode[] | null>(combineLatest(fence.steps.map((step) => highlight$(highlighter, step.code, fence.lang, dark))), null),
    [fence, highlighter, dark],
  );
  const codes = useSignal(highlighted.$);
  const index = useMemo(() => Signal(0), []);
  const at = Math.min(useSignal(index.$), fence.steps.length - 1);
  const step = fence.steps[at];
  const last = fence.steps.length - 1;

  return (
    <figure className="md-steps" data-theme={dark ? "dark" : "light"} data-step={at} data-steps={fence.steps.length}>
      <figcaption className="md-steps-bar">
        <button type="button" className="md-steps-prev" aria-label="previous step" disabled={at === 0} onClick={() => index.$(at - 1)}>‹</button>
        <span className="md-steps-count">{`${at + 1} / ${fence.steps.length}`}</span>
        <button type="button" className="md-steps-next" aria-label="next step" disabled={at === last} onClick={() => index.$(at + 1)}>›</button>
        {step.title ? <span className="md-steps-title">{step.title}</span> : null}
        {step.error ? <span className="md-steps-error" role="alert">{step.error}</span> : null}
      </figcaption>
      {codes
        ? <Pre code={codes[at]} handlers={HANDLERS} className="md-steps-pre" />
        : <pre className="md-steps-pre"><code>{step.code}</code></pre>}
    </figure>
  );
}
