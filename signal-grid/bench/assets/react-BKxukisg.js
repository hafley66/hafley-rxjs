import { l as __toESM } from "./0_bench-CoT3Z-06.js";
import { a as require_react, i as require_react_dom, r as require_client } from "./2_heavy-5kugUYg1.js";
require_react();
var import_client = require_client();
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom(), 1);
function reactSlot(view, options) {
	const sync = options?.sync ?? true;
	const cap = options?.pool ?? 256;
	const free = [];
	const make = () => {
		const host = document.createElement("div");
		host.className = "sg-react";
		return {
			host,
			root: (0, import_client.createRoot)(host)
		};
	};
	return (ctx) => {
		const pair = free.pop() ?? make();
		const draw = () => pair.root.render(view(ctx));
		if (sync) (0, import_react_dom.flushSync)(draw);
		else draw();
		const unsubscribe = () => {
			if (free.length < cap) {
				pair.host.remove();
				free.push(pair);
				return;
			}
			queueMicrotask(() => pair.root.unmount());
		};
		return {
			content: pair.host,
			unsubscribe
		};
	};
}
//#endregion
export { reactSlot as t };
