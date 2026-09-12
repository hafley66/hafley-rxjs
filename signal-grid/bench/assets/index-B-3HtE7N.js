import { i as setGridLogEmit, n as cfgOf, r as mountBench } from "./0_bench-CbDffROP.js";
//#region bench/scroll/main.ts
var found = document.getElementById("mount");
if (found === null) throw new Error("bench page has no #mount");
var mount = found;
var cfg = cfgOf(new URLSearchParams(location.search));
var bench = mountBench(mount, cfg);
var SLOW_MS = 32;
var SPEED = 240;
var heap = () => performance.memory?.usedJSHeapSize ?? 0;
/** One burst: `warm` frames discarded, then `frames` measured at 240 px each. Stage totals come off
* the package's LogTape surface, so a row says where the frame went and not only how long. */
async function run(warm, frames) {
	const by = /* @__PURE__ */ new Map();
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
	const gaps = [];
	let previous = performance.now();
	let step = 0;
	let heapWarm = 0;
	await new Promise((resolve) => {
		const tick = (now) => {
			gaps.push(now - previous);
			previous = now;
			bench.step(SPEED, step);
			step += 1;
			if (step === warm) {
				by.clear();
				heapWarm = heap();
			}
			if (step < warm + frames) requestAnimationFrame(tick);
			else resolve();
		};
		requestAnimationFrame(tick);
	});
	setGridLogEmit(null);
	const measured = gaps.slice(warm);
	const sorted = [...measured].sort((a, b) => a - b);
	const style = mount.getAttribute("style") ?? "";
	return {
		frames: measured.length,
		p50: sorted[Math.floor(sorted.length * .5)] ?? 0,
		p95: sorted[Math.floor(sorted.length * .95)] ?? 0,
		worst: sorted[sorted.length - 1] ?? 0,
		slow: measured.filter((it) => it > SLOW_MS).length,
		held: mount.getElementsByClassName("sg-row").length,
		nodes: bench.scroll.getElementsByTagName("*").length,
		styleBytes: style.length,
		heapWarm,
		heapEnd: heap(),
		stages: [...by].map(([stage, it]) => ({
			stage,
			records: it.records,
			ms: it.ms
		}))
	};
}
window.__bench = run;
//#endregion
