import { AnnotatedDemo } from "./1_AnnotatedDemo.js";
import { TransitionsDemo } from "./2_TransitionsDemo.js";
import { ScrollyDemo } from "./3_ScrollyDemo.js";
import { FenceDemo, StepsPluginDemo } from "./4_FenceDemo.js";
import { MagicMoveDemo } from "./5_MagicMoveDemo.js";
import "./lab.css";

export function CodeHikeLab() {
  return (
    <main className="ch-lab">
      <h1>Code Hike lab</h1>
      <AnnotatedDemo />
      <TransitionsDemo />
      <ScrollyDemo />
      <FenceDemo />
      <MagicMoveDemo />
      <StepsPluginDemo />
    </main>
  );
}
