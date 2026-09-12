import { n as cfgOf, r as mountBench, s as __toESM } from "./0_bench-DMhVVjsg.js";
import { n as firstRowAt, t as burst } from "./1_run-ClDSS-VY.js";
import { a as require_react, r as require_client, t as Heavy } from "./2_heavy-DjyBCaRc.js";
//#region src/react/index.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_client = require_client();
/**
* A slot that hands back JSX. `10_render.ts` drops a React element on purpose: `Renderable` matches
* one structurally through `$$typeof`, and the DOM path has no renderer to mount it with.
*
* This wraps the element in its own root and returns the `{ content, unsubscribe }` shape the slot
* contract already carries, so the root unmounts with the row that mounted it.
*/
function reactSlot(view) {
	return (ctx) => {
		const host = document.createElement("div");
		host.className = "sg-react";
		const root = (0, import_client.createRoot)(host);
		root.render(view(ctx));
		const unsubscribe = () => queueMicrotask(() => root.unmount());
		return {
			content: host,
			unsubscribe
		};
	};
}
//#endregion
//#region bench/scroll/react.tsx
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
