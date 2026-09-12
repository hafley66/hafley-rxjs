import { i as mountBench, o as setGridLogEmit, r as cfgOf } from "./0_bench-CoT3Z-06.js";
import { n as firstRowAt, t as burst } from "./1_run-ClDSS-VY.js";
//#region bench/scroll/main.ts
var found = document.getElementById("mount");
if (found === null) throw new Error("bench page has no #mount");
var mount = found;
var cfg = cfgOf(new URLSearchParams(location.search));
var bench = mountBench(mount, cfg);
var by = /* @__PURE__ */ new Map();
var stages = {
	start: () => {
		setGridLogEmit((category, _message, fields) => {
			const key = category.join(".");
			const held = by.get(key) ?? {
				records: 0,
				ms: 0
			};
			held.records += 1;
			held.ms += typeof fields["durationMs"] === "number" ? fields["durationMs"] : 0;
			by.set(key, held);
		});
	},
	reset: () => by.clear(),
	stop: () => {
		setGridLogEmit(null);
		return [...by].map(([stage, it]) => ({
			stage,
			records: it.records,
			ms: it.ms
		}));
	}
};
var run = (warm, frames) => burst({
	warm,
	frames,
	step: bench.step,
	scroll: () => bench.scroll,
	held: () => mount.getElementsByClassName("sg-row").length,
	styleBytes: () => (mount.getAttribute("style") ?? "").length,
	stages
});
window.__bench = run;
window.__firstRow = firstRowAt(".sg-row");
//#endregion
