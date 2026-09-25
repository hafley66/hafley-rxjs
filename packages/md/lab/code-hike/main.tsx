import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { installMdviewHost, type MdviewHost } from "../../src/ports.js";
import "../../src/mdview.css";
import { CodeHikeLab } from "./6_Lab.js";

installMdviewHost({
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
} as unknown as MdviewHost);

const app = document.getElementById("app");
if (app) createRoot(app).render(createElement(CodeHikeLab));
