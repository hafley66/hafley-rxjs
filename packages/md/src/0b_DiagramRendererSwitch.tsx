import { SignalReact } from "@hafley66/signals/react";
import { mdUi, setMdUi, type DiagramRenderer } from "./signals.js";

const CHOICES: { value: DiagramRenderer; label: string; title: string }[] = [
  { value: "svg", label: "svg", title: "sequence diagrams draw the renderer's own SVG" },
  { value: "grapht", label: "grapht", title: "sequence diagrams draw through grapht (experimental)" },
];

/** One global choice, shown wherever a sequence diagram or the md toolbar is on screen. */
export const DiagramRendererSwitch = SignalReact(function DiagramRendererSwitch({ className }: { className?: string }) {
  const current = mdUi.$().diagramRenderer;
  return (
    <span className={`mdview-renderer-switch ${className ?? ""}`} role="radiogroup" aria-label="diagram renderer">
      {CHOICES.map((choice) => (
        <button
          key={choice.value}
          type="button"
          role="radio"
          aria-checked={current === choice.value}
          data-active={current === choice.value}
          title={choice.title}
          onClick={() => setMdUi({ diagramRenderer: choice.value })}
        >
          {choice.label}
        </button>
      ))}
    </span>
  );
});
