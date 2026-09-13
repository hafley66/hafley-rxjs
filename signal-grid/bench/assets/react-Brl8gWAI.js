import { i as mountBench, l as __toESM, r as cfgOf } from "./0_bench-CoT3Z-06.js";
import { n as firstRowAt, t as burst } from "./1_run-ClDSS-VY.js";
import { a as require_react, t as Heavy } from "./2_heavy-5kugUYg1.js";
import { t as reactSlot } from "./react-BGNvf7iF.js";
//#region bench/scroll/react.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var found = document.getElementById("mount");
if (found === null) throw new Error("bench page has no #mount");
var mount = found;
var cfg = cfgOf(new URLSearchParams(location.search));
var view = (ctx) => cfg.cell === "plain" ? String(ctx.value) : (0, import_react.createElement)(Heavy, {
	row: ctx.data,
	col: ctx.col
});
var slot = reactSlot(view);
var bench = mountBench(mount, cfg, void 0, (ctx) => slot({
	data: ctx.data,
	col: ctx.col,
	value: ctx.value
}));
var run = (warm, frames) => burst({
	warm,
	frames,
	step: bench.step,
	scroll: () => bench.scroll,
	held: () => mount.getElementsByClassName("sg-row").length,
	styleBytes: () => (mount.getAttribute("style") ?? "").length
});
window.__bench = run;
window.__firstRow = firstRowAt(".sg-row");
//#endregion
