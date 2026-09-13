import "./0_bench-CoT3Z-06.js";
import { a as require_react, r as require_client } from "./2_heavy-5kugUYg1.js";
require_react();
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
export { reactSlot as t };
