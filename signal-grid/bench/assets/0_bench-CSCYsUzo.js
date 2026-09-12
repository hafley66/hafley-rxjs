//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
var cellId = (row, col) => row + "\0" + col;
var cellParts = (id) => {
	const at = id.indexOf("\0");
	return at === -1 ? [id, ""] : [id.slice(0, at), id.slice(at + 1)];
};
var isGroupKey = (key) => key.startsWith("g:");
/** Narrows the value rather than testing the key: one call at the row level answers for the row and
* every cell under it, and it is the only reader that cast needs. */
var isGroupRow = (value) => typeof value === "object" && value !== null && "g:" in value && Array.isArray(value.path);
/** A nullish hop ends the walk, so a path through an absent branch reads undefined. */
var readPath = (root, segments) => segments.reduce((value, key) => value === null || value === void 0 ? void 0 : value[key], root);
function buildReader(col, colId) {
	const path = col.field;
	const read = col.value;
	if (path !== void 0 && read !== void 0) throw new Error(`signal-grid: column "${col.id}" carries both field and value. Keep the path, or keep the reader.`);
	if (read !== void 0) return read;
	if (path === void 0) return (it) => it[colId];
	const segments = path.split(".");
	const [only] = segments;
	if (segments.length === 1 && only !== void 0) return (it) => it[only];
	return (it) => readPath(it, segments);
}
/** Keyed by the def, because a rendered cell asks per cell and a dotted path must not `split`
* a million times. A schema that rebuilds its defs drops the old entries with them. */
var readers = /* @__PURE__ */ new WeakMap();
/** What a column reads off a row: `value`, else `field`, else the id. */
function columnReader(col, colId) {
	if (col === void 0) return (it) => it[colId];
	const cached = readers.get(col);
	if (cached !== void 0) return cached;
	const built = buildReader(col, colId);
	readers.set(col, built);
	return built;
}
/** A plain click: no chord, primary button. Declared beside `Modifiers`, because `3_paths.ts` and
* `7_epics.ts` both ask it and a second copy is a second answer. */
var isPlainClick = (mods) => !mods.alt && !mods.ctrl && !mods.meta && !mods.shift && mods.button === 0;
//#endregion
//#region src/0_log.ts
var noop$2 = () => {};
var LOG$1 = {
	on: false,
	emit: noop$2
};
var CAT_PLAN = ["signal-grid", "plan"];
var CAT_FRAME = ["signal-grid", "frame"];
var CAT_DOM = ["signal-grid", "dom"];
var CAT_VARS = ["signal-grid", "vars"];
var CAT_BASE = ["signal-grid", "base"];
var CAT_SORT = ["signal-grid", "sort"];
var CAT_GROUP = ["signal-grid", "group"];
var CAT_FLATTEN = ["signal-grid", "flatten"];
var CAT_INTENT = ["signal-grid", "intent"];
function setGridLogEmit(emit) {
	LOG$1.emit = emit ?? noop$2;
	LOG$1.on = emit !== null;
}
//#endregion
//#region src/1_axis.ts
var kidsOf = (axis, key) => axis.children.get(key) ?? [];
/** Depth-first order needs the last sibling on the bottom of the stack, so pushes run backwards. */
var pushBack = (stack, frames) => {
	for (let index = frames.length - 1; index >= 0; index--) {
		const frame = frames[index];
		if (frame !== void 0) stack.push(frame);
	}
};
/**
* True when following parent links from `key` arrives back at `key`. Only the nodes standing on the
* cycle are cut loose: a node hanging below a cycle keeps its edge, because the parent it names
* becomes a root and the forest is acyclic again.
*/
var returnsToSelf = (key, raw) => {
	const seen = /* @__PURE__ */ new Set([key]);
	let at = raw.get(key);
	while (at !== void 0) {
		if (at === key) return true;
		if (seen.has(at)) return false;
		seen.add(at);
		at = raw.get(at);
	}
	return false;
};
/**
* Two passes because a parent may be declared after its child: the first fills `by` and the raw
* edges, the second resolves them once every key is known.
*
* A repeated key is an update, not a second row, so it replaces the value and keeps the seat it
* already had. The parent is read from the latest value for the same reason.
*/
function axisOfEntries(entries, parentOf) {
	const by = /* @__PURE__ */ new Map();
	const order = [];
	const raw = /* @__PURE__ */ new Map();
	for (const [key, value] of entries) {
		if (!by.has(key)) order.push(key);
		by.set(key, value);
		const up = parentOf === void 0 ? void 0 : parentOf(key, value);
		if (up === void 0 || up === key) raw.delete(key);
		else raw.set(key, up);
	}
	const roots = [];
	const children = /* @__PURE__ */ new Map();
	const parent = /* @__PURE__ */ new Map();
	for (const key of order) {
		const up = raw.get(key);
		if (up === void 0 || !by.has(up) || returnsToSelf(key, raw)) {
			roots.push(key);
			continue;
		}
		parent.set(key, up);
		const kids = children.get(up);
		if (kids === void 0) children.set(up, [key]);
		else kids.push(key);
	}
	return {
		roots,
		children,
		parent,
		by
	};
}
/**
* Depth-first construction for nested source data, which is the shape `subRows` arrives in.
*
* A key that has already been placed is an update: the value is replaced and the node is not
* descended into again, which is what stops a payload whose children loop back.
* @feature row.tree
*/
function axisOfTree(items, keyOf, childrenOf) {
	const by = /* @__PURE__ */ new Map();
	const roots = [];
	const children = /* @__PURE__ */ new Map();
	const parent = /* @__PURE__ */ new Map();
	const stack = [];
	const descend = (list, up) => {
		pushBack(stack, list.map((item) => ({
			item,
			up
		})));
	};
	descend(items, void 0);
	while (stack.length > 0) {
		const frame = stack.pop();
		if (frame === void 0) break;
		const key = keyOf(frame.item);
		const placed = by.has(key);
		by.set(key, frame.item);
		if (placed) continue;
		if (frame.up === void 0) roots.push(key);
		else {
			parent.set(key, frame.up);
			const kids = children.get(frame.up);
			if (kids === void 0) children.set(frame.up, [key]);
			else kids.push(key);
		}
		const nested = childrenOf(frame.item);
		if (nested !== void 0 && nested.length > 0) descend(nested, key);
	}
	return {
		roots,
		children,
		parent,
		by
	};
}
/**
* Sorts `roots` and every `children` array. `parent` and `by` are shared by reference because sort
* moves nothing between parents.
* @feature row.sort
*/
function sortAxis(axis, cmp) {
	if (cmp === null) return axis;
	const order = (keys) => {
		if (keys.length < 2) return keys;
		const seats = keys.map((key, index) => ({
			key,
			index
		}));
		seats.sort((a, b) => {
			const left = axis.by.get(a.key);
			const right = axis.by.get(b.key);
			const by = left === void 0 || right === void 0 ? 0 : cmp(left, right);
			return by !== 0 && Number.isFinite(by) ? by : a.index - b.index;
		});
		return seats.map((seat) => seat.key);
	};
	const children = /* @__PURE__ */ new Map();
	for (const [key, kids] of axis.children) children.set(key, order(kids));
	return {
		roots: order(axis.roots),
		children,
		parent: axis.parent,
		by: axis.by
	};
}
/**
* The key of a group node. JSON of the whole path, so two levels that read the same value still land
* in different groups, and the `GROUP_PREFIX` namespace keeps a synthesized key off any RowId.
*/
var groupKeyOf = (path) => "g:" + JSON.stringify(path);
/**
* Rebuilds the group levels of an axis. The units are the data nodes standing at the top of the
* forest once the previous pass's group nodes are lifted out, and each unit travels with its own
* subtree, so grouping tree data does not tear a parent away from its children. Grouping is
* therefore idempotent: regrouping an already grouped axis yields the same axis.
* @feature row.group
*/
function groupAxis(axis, keyOf, makeGroup) {
	if (keyOf.length === 0) return axis;
	const units = [];
	const seen = /* @__PURE__ */ new Set();
	const stack = [];
	pushBack(stack, axis.roots);
	while (stack.length > 0) {
		const key = stack.pop();
		if (key === void 0) break;
		if (seen.has(key)) continue;
		seen.add(key);
		if (isGroupKey(key)) {
			pushBack(stack, kidsOf(axis, key));
			continue;
		}
		units.push(key);
	}
	const by = /* @__PURE__ */ new Map();
	for (const [key, value] of axis.by) if (!isGroupKey(key)) by.set(key, value);
	const roots = [];
	const children = /* @__PURE__ */ new Map();
	const parent = /* @__PURE__ */ new Map();
	for (const [key, up] of axis.parent) if (!isGroupKey(key) && !isGroupKey(up)) parent.set(key, up);
	for (const [key, kids] of axis.children) {
		if (isGroupKey(key)) continue;
		const data = kids.filter((child) => !isGroupKey(child));
		if (data.length > 0) children.set(key, [...data]);
	}
	const attach = (key, up) => {
		if (up === void 0) {
			roots.push(key);
			return;
		}
		parent.set(key, up);
		const kids = children.get(up);
		if (kids === void 0) children.set(up, [key]);
		else kids.push(key);
	};
	for (const unit of units) {
		const value = by.get(unit);
		if (value === void 0) continue;
		const path = [];
		let up = void 0;
		for (const read of keyOf) {
			path.push(read(value));
			const key = groupKeyOf(path);
			if (!by.has(key)) {
				by.set(key, makeGroup([...path], key));
				attach(key, up);
			}
			up = key;
		}
		attach(unit, up);
	}
	return {
		roots,
		children,
		parent,
		by
	};
}
/** Data rows under each group key, whole subtree. Walked upward from each row, so every node is
* visited once and a non-group key never lands in the result. @feature row.group */
function groupCounts(axis) {
	const counts = /* @__PURE__ */ new Map();
	for (const key of axis.by.keys()) {
		if (isGroupKey(key)) continue;
		let up = axis.parent.get(key);
		while (up !== void 0) {
			if (isGroupKey(up)) counts.set(up, (counts.get(up) ?? 0) + 1);
			up = axis.parent.get(up);
		}
	}
	return counts;
}
/**
* Depth-first from the roots, skipping the subtree of a closed node. That skip is what keeps a
* collapsed branch out of the virtualizer's row count entirely.
* @feature row.expand
*/
function flattenAxis(axis, isOpen) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const stack = [];
	pushBack(stack, axis.roots.map((key) => ({
		key,
		depth: 0,
		up: null
	})));
	while (stack.length > 0) {
		const frame = stack.pop();
		if (frame === void 0) break;
		if (seen.has(frame.key)) continue;
		seen.add(frame.key);
		const kids = kidsOf(axis, frame.key);
		const hasChildren = kids.length > 0;
		out.push({
			key: frame.key,
			depth: frame.depth,
			index: out.length,
			parent: frame.up,
			hasChildren
		});
		if (!hasChildren || !isOpen(frame.key)) continue;
		pushBack(stack, kids.map((key) => ({
			key,
			depth: frame.depth + 1,
			up: frame.key
		})));
	}
	return out;
}
/** Nearest first, so an indent guide or a breadcrumb reads the array straight off. */
function ancestorsOf(axis, key) {
	const out = [];
	const seen = /* @__PURE__ */ new Set([key]);
	let at = axis.parent.get(key);
	while (at !== void 0 && !seen.has(at)) {
		seen.add(at);
		out.push(at);
		at = axis.parent.get(at);
	}
	return out;
}
/** Depth-first, excluding `key` itself. The visited set is what makes a cyclic axis terminate. */
function descendantsOf(axis, key) {
	const out = [];
	const seen = /* @__PURE__ */ new Set([key]);
	const stack = [];
	pushBack(stack, kidsOf(axis, key));
	while (stack.length > 0) {
		const at = stack.pop();
		if (at === void 0) break;
		if (seen.has(at)) continue;
		seen.add(at);
		out.push(at);
		pushBack(stack, kidsOf(axis, at));
	}
	return out;
}
//#endregion
//#region src/2_operators.ts
var isNil = (value) => value === null || value === void 0;
/**
* An item is incomplete while the user is still typing, and an incomplete item must not remove any
* row. Only `undefined`, `null`, and `""` count: `0` and `false` are real filter terms.
*/
var isBlank = (value) => isNil(value) || value === "";
var numberOf = (value) => {
	if (isNil(value) || value === "") return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isNaN(n) ? null : n;
};
var DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
/**
* A bare `YYYY-MM-DD` is what a native date input emits. `new Date` reads it as UTC midnight, which
* lands on the previous calendar day for anyone west of Greenwich, so it is built from local parts.
*/
var dateOf = (value) => {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value === "number") {
		const fromMs = new Date(value);
		return Number.isNaN(fromMs.getTime()) ? null : fromMs;
	}
	if (typeof value !== "string") return null;
	const parts = DATE_ONLY.exec(value);
	if (parts !== null) {
		const local = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
		return Number.isNaN(local.getTime()) ? null : local;
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};
/** Date columns hold an instant but mean a day, so both sides collapse to local midnight. */
var dayGrain = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
var instantGrain = (date) => date.getTime();
var isEmptyCell = (value) => isNil(value) || value === "";
var dateOp = (name, test, grain) => ({
	name,
	build: (item) => {
		if (isBlank(item.value)) return null;
		const needle = dateOf(item.value);
		if (needle === null) return null;
		const rhs = grain(needle);
		return (value) => {
			const cell = dateOf(value);
			return cell === null ? false : test(grain(cell), rhs);
		};
	}
});
var emptyOp = (name, want) => ({
	name,
	unary: true,
	build: () => (value) => isEmptyCell(value) === want
});
var dateSet = (grain) => [
	dateOp("is", (cell, needle) => cell === needle, grain),
	dateOp("not", (cell, needle) => cell !== needle, grain),
	dateOp("after", (cell, needle) => cell > needle, grain),
	dateOp("onOrAfter", (cell, needle) => cell >= needle, grain),
	dateOp("before", (cell, needle) => cell < needle, grain),
	dateOp("onOrBefore", (cell, needle) => cell <= needle, grain),
	emptyOp("isEmpty", true),
	emptyOp("isNotEmpty", false)
];
dateSet(dayGrain);
dateSet(instantGrain);
var indexColumns = (columns) => {
	const by = /* @__PURE__ */ new Map();
	for (const col of columns) by.set(col.id, col);
	return by;
};
/**
* Blanks sink to the bottom of an ascending sort, which is what MUI does and what a reader expects.
* Descending is a plain negation of the whole comparator, so blanks rise to the top there.
*/
var nilOrder = (a, b) => {
	const na = isNil(a);
	const nb = isNil(b);
	if (na && nb) return 0;
	if (na) return 1;
	if (nb) return -1;
	return null;
};
var compareString = (a, b) => {
	const nil = nilOrder(a, b);
	if (nil !== null) return nil;
	return String(a).localeCompare(String(b));
};
var compareNumber = (a, b) => {
	const na = numberOf(a);
	const nb = numberOf(b);
	if (na === null) return nb === null ? 0 : 1;
	if (nb === null) return -1;
	return na - nb;
};
var compareBoolean = (a, b) => {
	const nil = nilOrder(a, b);
	if (nil !== null) return nil;
	return Number(Boolean(a)) - Number(Boolean(b));
};
var compareDate = (a, b) => {
	const da = dateOf(a);
	const db = dateOf(b);
	if (da === null) return db === null ? 0 : 1;
	if (db === null) return -1;
	return da.getTime() - db.getTime();
};
var comparatorFor = (type) => {
	switch (type) {
		case "number": return compareNumber;
		case "boolean": return compareBoolean;
		case "date":
		case "dateTime": return compareDate;
		default: return compareString;
	}
};
/** @feature row.sort.multi */
var buildComparator = (model, columns, getValue) => {
	const by = indexColumns(columns);
	const fields = [];
	for (const item of model) {
		const col = by.get(item.field);
		if (col === void 0) continue;
		fields.push({
			field: item.field,
			sign: item.sort === "desc" ? -1 : 1,
			cmp: col.sortComparator ?? comparatorFor(col.type ?? "string")
		});
	}
	if (fields.length === 0) return null;
	return (a, b) => {
		for (const entry of fields) {
			const order = entry.cmp(getValue(a, entry.field), getValue(b, entry.field));
			if (order !== 0) return entry.sign * order;
		}
		return 0;
	};
};
//#endregion
//#region ../path/dist/1_path.js
function pathFactory(syntax) {
	const factory = ((template, configuration) => template === void 0 ? path(syntax) : path(syntax, template, configuration));
	return Object.assign(factory, syntax);
}
var slash = pathFactory({
	segmentDelimiter: "/",
	queryDelimiter: "?",
	queryEntryDelimiter: "&",
	pointerDelimiter: "#"
});
pathFactory({
	segmentDelimiter: ".",
	queryDelimiter: "?",
	queryEntryDelimiter: "&",
	pointerDelimiter: "#"
});
pathFactory({
	segmentDelimiter: "/",
	queryDelimiter: "?",
	queryEntryDelimiter: "&",
	pointerDelimiter: ":"
});
var runtimePaths = /* @__PURE__ */ new WeakMap();
function splitTemplate(template, syntax) {
	const pointerIndex = indexOfOutsideBraces(template, syntax.pointerDelimiter);
	const beforePointer = pointerIndex === -1 ? template : template.slice(0, pointerIndex);
	const pointer = pointerIndex === -1 ? void 0 : template.slice(pointerIndex + syntax.pointerDelimiter.length);
	const queryIndex = indexOfOutsideBraces(beforePointer, syntax.queryDelimiter);
	return {
		pathname: queryIndex === -1 ? beforePointer : beforePointer.slice(0, queryIndex),
		query: queryIndex === -1 ? "" : beforePointer.slice(queryIndex + syntax.queryDelimiter.length),
		pointer
	};
}
function indexOfOutsideBraces(text, delimiter) {
	let depth = 0;
	for (let index = 0; index <= text.length - delimiter.length; index += 1) {
		if (text[index] === "{") depth += 1;
		if (text[index] === "}") depth -= 1;
		if (depth === 0 && text.startsWith(delimiter, index)) return index;
	}
	return -1;
}
function partOf(segment) {
	const optional = /^\{(.+)\?\}$/.exec(segment);
	if (optional) return {
		kind: "optionalProperty",
		name: optional[1]
	};
	const rest = /^\{(.+)\*\}$/.exec(segment);
	if (rest) return {
		kind: "restProperty",
		name: rest[1]
	};
	const property = /^\{(.+)\}$/.exec(segment) ?? /^:(.+)$/.exec(segment);
	if (property) return {
		kind: "property",
		name: property[1]
	};
	return segment === "" ? void 0 : {
		kind: "literal",
		value: segment
	};
}
function partsOf$1(template, syntax) {
	return splitTemplate(template, syntax).pathname.split(syntax.segmentDelimiter).flatMap((segment) => {
		const part = partOf(segment);
		return part === void 0 ? [] : [part];
	});
}
function namesOf(template, syntax) {
	const { query, pointer } = splitTemplate(template, syntax);
	return {
		pathname: partsOf$1(template, syntax),
		queryEntries: query === "" ? [] : query.split(syntax.queryEntryDelimiter),
		pointer
	};
}
function valueNames(template, syntax) {
	const target = namesOf(template, syntax);
	const names = target.pathname.flatMap((part) => part.kind === "literal" ? [] : [part.name]);
	for (const entry of target.queryEntries) {
		const match = /^\{(.+?)(\?)?\}$/.exec(entry);
		if (match) names.push(match[1]);
	}
	const pointer = target.pointer && /^\{(.+)\}$/.exec(target.pointer);
	if (pointer) names.push(pointer[1]);
	return names;
}
function pickValues(values, names) {
	return Object.fromEntries(names.flatMap((name) => name in values ? [[name, values[name]]] : []));
}
function concatenateConfiguration(parent, child) {
	if (!parent.configuration && !child.configuration) return void 0;
	const parentNames = valueNames(parent.template, parent.syntax);
	const childNames = valueNames(child.template, child.syntax);
	return {
		parse(rawValues) {
			const parentValues = parent.configuration ? parent.configuration.parse(pickValues(rawValues, parentNames)) : pickValues(rawValues, parentNames);
			if (parentValues === void 0) return void 0;
			const childValues = child.configuration ? child.configuration.parse(pickValues(rawValues, childNames)) : pickValues(rawValues, childNames);
			if (childValues === void 0) return void 0;
			return {
				...parentValues,
				...childValues
			};
		},
		print(values) {
			const parentValues = parent.configuration ? parent.configuration.print(values) : pickValues(values, parentNames);
			const childValues = child.configuration ? child.configuration.print(values) : pickValues(values, childNames);
			return {
				...pickValues(parentValues, parentNames),
				...pickValues(childValues, childNames)
			};
		}
	};
}
function concatenateAllowed(parent, child) {
	if (!parent) return child;
	if (!child) return parent;
	const allowed = { ...parent };
	for (const [name, values] of Object.entries(child)) allowed[name] = allowed[name] ? allowed[name].filter((value) => values.includes(value)) : values;
	return allowed;
}
function rawMatch(path, text) {
	const { pathname, query, pointer } = splitTemplate(text, path.syntax);
	const target = namesOf(path.template, path.syntax);
	const actual = pathname.split(path.syntax.segmentDelimiter).filter(Boolean);
	const parts = target.pathname;
	const values = {};
	let cursor = 0;
	for (const part of parts) if (part.kind === "literal") {
		if (actual[cursor] !== part.value) return {
			matched: false,
			reason: "structure"
		};
		cursor += 1;
	} else if (part.kind === "optionalProperty") {
		if (actual[cursor] !== void 0) values[part.name] = decodeURIComponent(actual[cursor++]);
	} else if (part.kind === "restProperty") {
		values[part.name] = actual.slice(cursor).map(decodeURIComponent).join(path.syntax.segmentDelimiter);
		cursor = actual.length;
	} else {
		if (actual[cursor] === void 0) return {
			matched: false,
			reason: "structure"
		};
		values[part.name] = decodeURIComponent(actual[cursor++]);
	}
	if (cursor !== actual.length) return {
		matched: false,
		reason: "structure"
	};
	const parameters = new URLSearchParams(query);
	for (const entry of target.queryEntries) {
		const match = /^\{(.+?)(\?)?\}$/.exec(entry);
		if (!match) continue;
		const value = parameters.get(match[1]);
		if (value === null && !match[2]) return {
			matched: false,
			reason: "structure"
		};
		if (value !== null) values[match[1]] = value;
	}
	if (target.pointer !== void 0) {
		const match = /^\{(.+)\}$/.exec(target.pointer);
		if (match) {
			if (pointer === void 0) return {
				matched: false,
				reason: "structure"
			};
			values[match[1]] = decodeURIComponent(pointer);
		} else if (pointer !== target.pointer) return {
			matched: false,
			reason: "structure"
		};
	}
	return {
		matched: true,
		values
	};
}
function printPath(path, values) {
	const { query, pointer } = splitTemplate(path.template, path.syntax);
	const renderedPathname = partsOf$1(path.template, path.syntax).map((part) => {
		if (part.kind === "literal") return part.value;
		const value = values[part.name];
		if (value === void 0 && part.kind === "optionalProperty") return void 0;
		if (value === void 0) throw new Error(`Missing path value: ${part.name}`);
		return part.kind === "restProperty" ? String(value).split(path.syntax.segmentDelimiter).map(encodeURIComponent).join(path.syntax.segmentDelimiter) : encodeURIComponent(String(value));
	}).filter((value) => value !== void 0).join(path.syntax.segmentDelimiter);
	const pathname = splitTemplate(path.template, path.syntax).pathname.startsWith(path.syntax.segmentDelimiter) ? path.syntax.segmentDelimiter + renderedPathname : renderedPathname;
	const entries = query === "" ? [] : query.split(path.syntax.queryEntryDelimiter).flatMap((entry) => {
		const match = /^\{(.+?)(\?)?\}$/.exec(entry);
		if (!match) return [entry];
		const value = values[match[1]];
		if (value === void 0 && match[2]) return [];
		if (value === void 0) throw new Error(`Missing query value: ${match[1]}`);
		return `${encodeURIComponent(match[1])}=${encodeURIComponent(String(value))}`;
	});
	const renderedPointer = pointer === void 0 ? "" : (() => {
		const match = /^\{(.+)\}$/.exec(pointer);
		if (!match) return path.syntax.pointerDelimiter + pointer;
		const value = values[match[1]];
		if (value === void 0) throw new Error(`Missing pointer value: ${match[1]}`);
		return path.syntax.pointerDelimiter + encodeURIComponent(String(value));
	})();
	return pathname + (entries.length ? path.syntax.queryDelimiter + entries.join(path.syntax.queryEntryDelimiter) : "") + renderedPointer;
}
function buildPath(runtime) {
	const result = {
		template: runtime.template,
		syntax: runtime.syntax,
		parts: runtime.parts,
		print(values) {
			if (runtime.allowed) {
				for (const [key, allowed] of Object.entries(runtime.allowed)) if (values[key] !== void 0 && !allowed.includes(String(values[key]))) throw new Error(`Invalid value: ${key}`);
			}
			return printPath(runtime, runtime.configuration ? runtime.configuration.print(values) : values);
		},
		match(text) {
			const raw = rawMatch(runtime, text);
			if (!raw.matched) return raw;
			if (runtime.allowed) for (const [key, allowed] of Object.entries(runtime.allowed)) {
				const value = raw.values[key];
				if (value !== void 0 && !allowed.includes(value)) return {
					matched: false,
					reason: "values"
				};
			}
			if (!runtime.configuration) return raw;
			try {
				const parsed = runtime.configuration.parse(raw.values);
				return parsed === void 0 ? {
					matched: false,
					reason: "values"
				} : {
					matched: true,
					values: parsed
				};
			} catch (error) {
				return {
					matched: false,
					reason: "values",
					error
				};
			}
		},
		concatenate(other) {
			const child = runtimePaths.get(other);
			if (!child) throw new Error("Cannot concatenate a path from a different runtime");
			const parentTemplate = runtime.template;
			const childTemplate = child.template;
			const parentQueryIndex = indexOfOutsideBraces(parentTemplate, runtime.syntax.queryDelimiter);
			const childQueryIndex = indexOfOutsideBraces(childTemplate, runtime.syntax.queryDelimiter);
			const template = parentQueryIndex === -1 ? parentTemplate + childTemplate : childQueryIndex === -1 ? parentTemplate.slice(0, parentQueryIndex) + childTemplate + parentTemplate.slice(parentQueryIndex) : parentTemplate.slice(0, parentQueryIndex) + childTemplate.slice(0, childQueryIndex) + runtime.syntax.queryDelimiter + parentTemplate.slice(parentQueryIndex + 1) + runtime.syntax.queryEntryDelimiter + childTemplate.slice(childQueryIndex + 1);
			return buildPath({
				template,
				syntax: runtime.syntax,
				parts: partsOf$1(template, runtime.syntax),
				configuration: concatenateConfiguration(runtime, child),
				allowed: concatenateAllowed(runtime.allowed, child.allowed)
			});
		},
		check(candidate) {
			return candidate;
		},
		concatenatePath(left, right) {
			return `${left}.${right}`;
		}
	};
	runtimePaths.set(result, runtime);
	return result;
}
function paramsToConversion(params) {
	return {
		parse(raw) {
			const out = {};
			for (const key of Object.keys(raw)) {
				const param = params[key];
				const rawValue = raw[key];
				if (param && rawValue !== void 0) {
					const parsed = param.parse(rawValue);
					if (parsed === void 0) return void 0;
					out[key] = parsed;
				} else out[key] = rawValue;
			}
			return out;
		},
		print(values) {
			const out = {};
			for (const key of Object.keys(values)) {
				const param = params[key];
				const value = values[key];
				out[key] = param && value !== void 0 ? param.print(value) : value === void 0 ? void 0 : String(value);
			}
			return out;
		}
	};
}
function path(syntax, template = "", configuration) {
	const config = configuration;
	const resolved = config?.parse && config.print ? {
		parse: config.parse,
		print: config.print
	} : config?.params ? paramsToConversion(config.params) : void 0;
	return buildPath({
		template,
		syntax,
		parts: partsOf$1(template, syntax),
		allowed: config?.values,
		configuration: resolved
	});
}
//#endregion
//#region ../../node_modules/.pnpm/tslib@2.8.1/node_modules/tslib/tslib.es6.mjs
/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
var extendStatics = function(d, b) {
	extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d, b) {
		d.__proto__ = b;
	} || function(d, b) {
		for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
	};
	return extendStatics(d, b);
};
function __extends(d, b) {
	if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
	extendStatics(d, b);
	function __() {
		this.constructor = d;
	}
	d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
function __awaiter(thisArg, _arguments, P, generator) {
	function adopt(value) {
		return value instanceof P ? value : new P(function(resolve) {
			resolve(value);
		});
	}
	return new (P || (P = Promise))(function(resolve, reject) {
		function fulfilled(value) {
			try {
				step(generator.next(value));
			} catch (e) {
				reject(e);
			}
		}
		function rejected(value) {
			try {
				step(generator["throw"](value));
			} catch (e) {
				reject(e);
			}
		}
		function step(result) {
			result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
		}
		step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
}
function __generator(thisArg, body) {
	var _ = {
		label: 0,
		sent: function() {
			if (t[0] & 1) throw t[1];
			return t[1];
		},
		trys: [],
		ops: []
	}, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
	return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
		return this;
	}), g;
	function verb(n) {
		return function(v) {
			return step([n, v]);
		};
	}
	function step(op) {
		if (f) throw new TypeError("Generator is already executing.");
		while (g && (g = 0, op[0] && (_ = 0)), _) try {
			if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
			if (y = 0, t) op = [op[0] & 2, t.value];
			switch (op[0]) {
				case 0:
				case 1:
					t = op;
					break;
				case 4:
					_.label++;
					return {
						value: op[1],
						done: false
					};
				case 5:
					_.label++;
					y = op[1];
					op = [0];
					continue;
				case 7:
					op = _.ops.pop();
					_.trys.pop();
					continue;
				default:
					if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
						_ = 0;
						continue;
					}
					if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
						_.label = op[1];
						break;
					}
					if (op[0] === 6 && _.label < t[1]) {
						_.label = t[1];
						t = op;
						break;
					}
					if (t && _.label < t[2]) {
						_.label = t[2];
						_.ops.push(op);
						break;
					}
					if (t[2]) _.ops.pop();
					_.trys.pop();
					continue;
			}
			op = body.call(thisArg, _);
		} catch (e) {
			op = [6, e];
			y = 0;
		} finally {
			f = t = 0;
		}
		if (op[0] & 5) throw op[1];
		return {
			value: op[0] ? op[1] : void 0,
			done: true
		};
	}
}
function __values(o) {
	var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
	if (m) return m.call(o);
	if (o && typeof o.length === "number") return { next: function() {
		if (o && i >= o.length) o = void 0;
		return {
			value: o && o[i++],
			done: !o
		};
	} };
	throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o, n) {
	var m = typeof Symbol === "function" && o[Symbol.iterator];
	if (!m) return o;
	var i = m.call(o), r, ar = [], e;
	try {
		while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
	} catch (error) {
		e = { error };
	} finally {
		try {
			if (r && !r.done && (m = i["return"])) m.call(i);
		} finally {
			if (e) throw e.error;
		}
	}
	return ar;
}
function __spreadArray(to, from, pack) {
	if (pack || arguments.length === 2) {
		for (var i = 0, l = from.length, ar; i < l; i++) if (ar || !(i in from)) {
			if (!ar) ar = Array.prototype.slice.call(from, 0, i);
			ar[i] = from[i];
		}
	}
	return to.concat(ar || Array.prototype.slice.call(from));
}
function __await(v) {
	return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
	if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
	var g = generator.apply(thisArg, _arguments || []), i, q = [];
	return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
		return this;
	}, i;
	function awaitReturn(f) {
		return function(v) {
			return Promise.resolve(v).then(f, reject);
		};
	}
	function verb(n, f) {
		if (g[n]) {
			i[n] = function(v) {
				return new Promise(function(a, b) {
					q.push([
						n,
						v,
						a,
						b
					]) > 1 || resume(n, v);
				});
			};
			if (f) i[n] = f(i[n]);
		}
	}
	function resume(n, v) {
		try {
			step(g[n](v));
		} catch (e) {
			settle(q[0][3], e);
		}
	}
	function step(r) {
		r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
	}
	function fulfill(value) {
		resume("next", value);
	}
	function reject(value) {
		resume("throw", value);
	}
	function settle(f, v) {
		if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
	}
}
function __asyncValues(o) {
	if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
	var m = o[Symbol.asyncIterator], i;
	return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
		return this;
	}, i);
	function verb(n) {
		i[n] = o[n] && function(v) {
			return new Promise(function(resolve, reject) {
				v = o[n](v), settle(resolve, reject, v.done, v.value);
			});
		};
	}
	function settle(resolve, reject, d, v) {
		Promise.resolve(v).then(function(v) {
			resolve({
				value: v,
				done: d
			});
		}, reject);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/isFunction.js
function isFunction(value) {
	return typeof value === "function";
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/createErrorClass.js
function createErrorClass(createImpl) {
	var _super = function(instance) {
		Error.call(instance);
		instance.stack = (/* @__PURE__ */ new Error()).stack;
	};
	var ctorFunc = createImpl(_super);
	ctorFunc.prototype = Object.create(Error.prototype);
	ctorFunc.prototype.constructor = ctorFunc;
	return ctorFunc;
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/UnsubscriptionError.js
var UnsubscriptionError = createErrorClass(function(_super) {
	return function UnsubscriptionErrorImpl(errors) {
		_super(this);
		this.message = errors ? errors.length + " errors occurred during unsubscription:\n" + errors.map(function(err, i) {
			return i + 1 + ") " + err.toString();
		}).join("\n  ") : "";
		this.name = "UnsubscriptionError";
		this.errors = errors;
	};
});
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/arrRemove.js
function arrRemove(arr, item) {
	if (arr) {
		var index = arr.indexOf(item);
		0 <= index && arr.splice(index, 1);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/Subscription.js
var Subscription = function() {
	function Subscription(initialTeardown) {
		this.initialTeardown = initialTeardown;
		this.closed = false;
		this._parentage = null;
		this._finalizers = null;
	}
	Subscription.prototype.unsubscribe = function() {
		var e_1, _a, e_2, _b;
		var errors;
		if (!this.closed) {
			this.closed = true;
			var _parentage = this._parentage;
			if (_parentage) {
				this._parentage = null;
				if (Array.isArray(_parentage)) try {
					for (var _parentage_1 = __values(_parentage), _parentage_1_1 = _parentage_1.next(); !_parentage_1_1.done; _parentage_1_1 = _parentage_1.next()) _parentage_1_1.value.remove(this);
				} catch (e_1_1) {
					e_1 = { error: e_1_1 };
				} finally {
					try {
						if (_parentage_1_1 && !_parentage_1_1.done && (_a = _parentage_1.return)) _a.call(_parentage_1);
					} finally {
						if (e_1) throw e_1.error;
					}
				}
				else _parentage.remove(this);
			}
			var initialFinalizer = this.initialTeardown;
			if (isFunction(initialFinalizer)) try {
				initialFinalizer();
			} catch (e) {
				errors = e instanceof UnsubscriptionError ? e.errors : [e];
			}
			var _finalizers = this._finalizers;
			if (_finalizers) {
				this._finalizers = null;
				try {
					for (var _finalizers_1 = __values(_finalizers), _finalizers_1_1 = _finalizers_1.next(); !_finalizers_1_1.done; _finalizers_1_1 = _finalizers_1.next()) {
						var finalizer = _finalizers_1_1.value;
						try {
							execFinalizer(finalizer);
						} catch (err) {
							errors = errors !== null && errors !== void 0 ? errors : [];
							if (err instanceof UnsubscriptionError) errors = __spreadArray(__spreadArray([], __read(errors)), __read(err.errors));
							else errors.push(err);
						}
					}
				} catch (e_2_1) {
					e_2 = { error: e_2_1 };
				} finally {
					try {
						if (_finalizers_1_1 && !_finalizers_1_1.done && (_b = _finalizers_1.return)) _b.call(_finalizers_1);
					} finally {
						if (e_2) throw e_2.error;
					}
				}
			}
			if (errors) throw new UnsubscriptionError(errors);
		}
	};
	Subscription.prototype.add = function(teardown) {
		var _a;
		if (teardown && teardown !== this) {
			if (this.closed) execFinalizer(teardown);
			else {
				if (teardown instanceof Subscription) {
					if (teardown.closed || teardown._hasParent(this)) return;
					teardown._addParent(this);
				}
				(this._finalizers = (_a = this._finalizers) !== null && _a !== void 0 ? _a : []).push(teardown);
			}
		}
	};
	Subscription.prototype._hasParent = function(parent) {
		var _parentage = this._parentage;
		return _parentage === parent || Array.isArray(_parentage) && _parentage.includes(parent);
	};
	Subscription.prototype._addParent = function(parent) {
		var _parentage = this._parentage;
		this._parentage = Array.isArray(_parentage) ? (_parentage.push(parent), _parentage) : _parentage ? [_parentage, parent] : parent;
	};
	Subscription.prototype._removeParent = function(parent) {
		var _parentage = this._parentage;
		if (_parentage === parent) this._parentage = null;
		else if (Array.isArray(_parentage)) arrRemove(_parentage, parent);
	};
	Subscription.prototype.remove = function(teardown) {
		var _finalizers = this._finalizers;
		_finalizers && arrRemove(_finalizers, teardown);
		if (teardown instanceof Subscription) teardown._removeParent(this);
	};
	Subscription.EMPTY = (function() {
		var empty = new Subscription();
		empty.closed = true;
		return empty;
	})();
	return Subscription;
}();
var EMPTY_SUBSCRIPTION = Subscription.EMPTY;
function isSubscription(value) {
	return value instanceof Subscription || value && "closed" in value && isFunction(value.remove) && isFunction(value.add) && isFunction(value.unsubscribe);
}
function execFinalizer(finalizer) {
	if (isFunction(finalizer)) finalizer();
	else finalizer.unsubscribe();
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/config.js
var config = {
	onUnhandledError: null,
	onStoppedNotification: null,
	Promise: void 0,
	useDeprecatedSynchronousErrorHandling: false,
	useDeprecatedNextContext: false
};
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduler/timeoutProvider.js
var timeoutProvider = {
	setTimeout: function(handler, timeout) {
		var args = [];
		for (var _i = 2; _i < arguments.length; _i++) args[_i - 2] = arguments[_i];
		var delegate = timeoutProvider.delegate;
		if (delegate === null || delegate === void 0 ? void 0 : delegate.setTimeout) return delegate.setTimeout.apply(delegate, __spreadArray([handler, timeout], __read(args)));
		return setTimeout.apply(void 0, __spreadArray([handler, timeout], __read(args)));
	},
	clearTimeout: function(handle) {
		var delegate = timeoutProvider.delegate;
		return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearTimeout) || clearTimeout)(handle);
	},
	delegate: void 0
};
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/reportUnhandledError.js
function reportUnhandledError(err) {
	timeoutProvider.setTimeout(function() {
		var onUnhandledError = config.onUnhandledError;
		if (onUnhandledError) onUnhandledError(err);
		else throw err;
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/noop.js
function noop$1() {}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/NotificationFactories.js
var COMPLETE_NOTIFICATION = (function() {
	return createNotification("C", void 0, void 0);
})();
function errorNotification(error) {
	return createNotification("E", void 0, error);
}
function nextNotification(value) {
	return createNotification("N", value, void 0);
}
function createNotification(kind, value, error) {
	return {
		kind,
		value,
		error
	};
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/errorContext.js
var context = null;
function errorContext(cb) {
	if (config.useDeprecatedSynchronousErrorHandling) {
		var isRoot = !context;
		if (isRoot) context = {
			errorThrown: false,
			error: null
		};
		cb();
		if (isRoot) {
			var _a = context, errorThrown = _a.errorThrown, error = _a.error;
			context = null;
			if (errorThrown) throw error;
		}
	} else cb();
}
function captureError(err) {
	if (config.useDeprecatedSynchronousErrorHandling && context) {
		context.errorThrown = true;
		context.error = err;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/Subscriber.js
var Subscriber = function(_super) {
	__extends(Subscriber, _super);
	function Subscriber(destination) {
		var _this = _super.call(this) || this;
		_this.isStopped = false;
		if (destination) {
			_this.destination = destination;
			if (isSubscription(destination)) destination.add(_this);
		} else _this.destination = EMPTY_OBSERVER;
		return _this;
	}
	Subscriber.create = function(next, error, complete) {
		return new SafeSubscriber(next, error, complete);
	};
	Subscriber.prototype.next = function(value) {
		if (this.isStopped) handleStoppedNotification(nextNotification(value), this);
		else this._next(value);
	};
	Subscriber.prototype.error = function(err) {
		if (this.isStopped) handleStoppedNotification(errorNotification(err), this);
		else {
			this.isStopped = true;
			this._error(err);
		}
	};
	Subscriber.prototype.complete = function() {
		if (this.isStopped) handleStoppedNotification(COMPLETE_NOTIFICATION, this);
		else {
			this.isStopped = true;
			this._complete();
		}
	};
	Subscriber.prototype.unsubscribe = function() {
		if (!this.closed) {
			this.isStopped = true;
			_super.prototype.unsubscribe.call(this);
			this.destination = null;
		}
	};
	Subscriber.prototype._next = function(value) {
		this.destination.next(value);
	};
	Subscriber.prototype._error = function(err) {
		try {
			this.destination.error(err);
		} finally {
			this.unsubscribe();
		}
	};
	Subscriber.prototype._complete = function() {
		try {
			this.destination.complete();
		} finally {
			this.unsubscribe();
		}
	};
	return Subscriber;
}(Subscription);
var _bind = Function.prototype.bind;
function bind$1(fn, thisArg) {
	return _bind.call(fn, thisArg);
}
var ConsumerObserver = function() {
	function ConsumerObserver(partialObserver) {
		this.partialObserver = partialObserver;
	}
	ConsumerObserver.prototype.next = function(value) {
		var partialObserver = this.partialObserver;
		if (partialObserver.next) try {
			partialObserver.next(value);
		} catch (error) {
			handleUnhandledError(error);
		}
	};
	ConsumerObserver.prototype.error = function(err) {
		var partialObserver = this.partialObserver;
		if (partialObserver.error) try {
			partialObserver.error(err);
		} catch (error) {
			handleUnhandledError(error);
		}
		else handleUnhandledError(err);
	};
	ConsumerObserver.prototype.complete = function() {
		var partialObserver = this.partialObserver;
		if (partialObserver.complete) try {
			partialObserver.complete();
		} catch (error) {
			handleUnhandledError(error);
		}
	};
	return ConsumerObserver;
}();
var SafeSubscriber = function(_super) {
	__extends(SafeSubscriber, _super);
	function SafeSubscriber(observerOrNext, error, complete) {
		var _this = _super.call(this) || this;
		var partialObserver;
		if (isFunction(observerOrNext) || !observerOrNext) partialObserver = {
			next: observerOrNext !== null && observerOrNext !== void 0 ? observerOrNext : void 0,
			error: error !== null && error !== void 0 ? error : void 0,
			complete: complete !== null && complete !== void 0 ? complete : void 0
		};
		else {
			var context_1;
			if (_this && config.useDeprecatedNextContext) {
				context_1 = Object.create(observerOrNext);
				context_1.unsubscribe = function() {
					return _this.unsubscribe();
				};
				partialObserver = {
					next: observerOrNext.next && bind$1(observerOrNext.next, context_1),
					error: observerOrNext.error && bind$1(observerOrNext.error, context_1),
					complete: observerOrNext.complete && bind$1(observerOrNext.complete, context_1)
				};
			} else partialObserver = observerOrNext;
		}
		_this.destination = new ConsumerObserver(partialObserver);
		return _this;
	}
	return SafeSubscriber;
}(Subscriber);
function handleUnhandledError(error) {
	if (config.useDeprecatedSynchronousErrorHandling) captureError(error);
	else reportUnhandledError(error);
}
function defaultErrorHandler(err) {
	throw err;
}
function handleStoppedNotification(notification, subscriber) {
	var onStoppedNotification = config.onStoppedNotification;
	onStoppedNotification && timeoutProvider.setTimeout(function() {
		return onStoppedNotification(notification, subscriber);
	});
}
var EMPTY_OBSERVER = {
	closed: true,
	next: noop$1,
	error: defaultErrorHandler,
	complete: noop$1
};
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/symbol/observable.js
var observable = (function() {
	return typeof Symbol === "function" && Symbol.observable || "@@observable";
})();
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/identity.js
function identity(x) {
	return x;
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/pipe.js
function pipeFromArray(fns) {
	if (fns.length === 0) return identity;
	if (fns.length === 1) return fns[0];
	return function piped(input) {
		return fns.reduce(function(prev, fn) {
			return fn(prev);
		}, input);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/Observable.js
var Observable = function() {
	function Observable(subscribe) {
		if (subscribe) this._subscribe = subscribe;
	}
	Observable.prototype.lift = function(operator) {
		var observable = new Observable();
		observable.source = this;
		observable.operator = operator;
		return observable;
	};
	Observable.prototype.subscribe = function(observerOrNext, error, complete) {
		var _this = this;
		var subscriber = isSubscriber(observerOrNext) ? observerOrNext : new SafeSubscriber(observerOrNext, error, complete);
		errorContext(function() {
			var _a = _this, operator = _a.operator, source = _a.source;
			subscriber.add(operator ? operator.call(subscriber, source) : source ? _this._subscribe(subscriber) : _this._trySubscribe(subscriber));
		});
		return subscriber;
	};
	Observable.prototype._trySubscribe = function(sink) {
		try {
			return this._subscribe(sink);
		} catch (err) {
			sink.error(err);
		}
	};
	Observable.prototype.forEach = function(next, promiseCtor) {
		var _this = this;
		promiseCtor = getPromiseCtor(promiseCtor);
		return new promiseCtor(function(resolve, reject) {
			var subscriber = new SafeSubscriber({
				next: function(value) {
					try {
						next(value);
					} catch (err) {
						reject(err);
						subscriber.unsubscribe();
					}
				},
				error: reject,
				complete: resolve
			});
			_this.subscribe(subscriber);
		});
	};
	Observable.prototype._subscribe = function(subscriber) {
		var _a;
		return (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber);
	};
	Observable.prototype[observable] = function() {
		return this;
	};
	Observable.prototype.pipe = function() {
		var operations = [];
		for (var _i = 0; _i < arguments.length; _i++) operations[_i] = arguments[_i];
		return pipeFromArray(operations)(this);
	};
	Observable.prototype.toPromise = function(promiseCtor) {
		var _this = this;
		promiseCtor = getPromiseCtor(promiseCtor);
		return new promiseCtor(function(resolve, reject) {
			var value;
			_this.subscribe(function(x) {
				return value = x;
			}, function(err) {
				return reject(err);
			}, function() {
				return resolve(value);
			});
		});
	};
	Observable.create = function(subscribe) {
		return new Observable(subscribe);
	};
	return Observable;
}();
function getPromiseCtor(promiseCtor) {
	var _a;
	return (_a = promiseCtor !== null && promiseCtor !== void 0 ? promiseCtor : config.Promise) !== null && _a !== void 0 ? _a : Promise;
}
function isObserver(value) {
	return value && isFunction(value.next) && isFunction(value.error) && isFunction(value.complete);
}
function isSubscriber(value) {
	return value && value instanceof Subscriber || isObserver(value) && isSubscription(value);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/lift.js
function hasLift(source) {
	return isFunction(source === null || source === void 0 ? void 0 : source.lift);
}
function operate(init) {
	return function(source) {
		if (hasLift(source)) return source.lift(function(liftedSource) {
			try {
				return init(liftedSource, this);
			} catch (err) {
				this.error(err);
			}
		});
		throw new TypeError("Unable to lift unknown Observable type");
	};
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/OperatorSubscriber.js
function createOperatorSubscriber(destination, onNext, onComplete, onError, onFinalize) {
	return new OperatorSubscriber(destination, onNext, onComplete, onError, onFinalize);
}
var OperatorSubscriber = function(_super) {
	__extends(OperatorSubscriber, _super);
	function OperatorSubscriber(destination, onNext, onComplete, onError, onFinalize, shouldUnsubscribe) {
		var _this = _super.call(this, destination) || this;
		_this.onFinalize = onFinalize;
		_this.shouldUnsubscribe = shouldUnsubscribe;
		_this._next = onNext ? function(value) {
			try {
				onNext(value);
			} catch (err) {
				destination.error(err);
			}
		} : _super.prototype._next;
		_this._error = onError ? function(err) {
			try {
				onError(err);
			} catch (err) {
				destination.error(err);
			} finally {
				this.unsubscribe();
			}
		} : _super.prototype._error;
		_this._complete = onComplete ? function() {
			try {
				onComplete();
			} catch (err) {
				destination.error(err);
			} finally {
				this.unsubscribe();
			}
		} : _super.prototype._complete;
		return _this;
	}
	OperatorSubscriber.prototype.unsubscribe = function() {
		var _a;
		if (!this.shouldUnsubscribe || this.shouldUnsubscribe()) {
			var closed_1 = this.closed;
			_super.prototype.unsubscribe.call(this);
			!closed_1 && ((_a = this.onFinalize) === null || _a === void 0 || _a.call(this));
		}
	};
	return OperatorSubscriber;
}(Subscriber);
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/ObjectUnsubscribedError.js
var ObjectUnsubscribedError = createErrorClass(function(_super) {
	return function ObjectUnsubscribedErrorImpl() {
		_super(this);
		this.name = "ObjectUnsubscribedError";
		this.message = "object unsubscribed";
	};
});
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/Subject.js
var Subject = function(_super) {
	__extends(Subject, _super);
	function Subject() {
		var _this = _super.call(this) || this;
		_this.closed = false;
		_this.currentObservers = null;
		_this.observers = [];
		_this.isStopped = false;
		_this.hasError = false;
		_this.thrownError = null;
		return _this;
	}
	Subject.prototype.lift = function(operator) {
		var subject = new AnonymousSubject(this, this);
		subject.operator = operator;
		return subject;
	};
	Subject.prototype._throwIfClosed = function() {
		if (this.closed) throw new ObjectUnsubscribedError();
	};
	Subject.prototype.next = function(value) {
		var _this = this;
		errorContext(function() {
			var e_1, _a;
			_this._throwIfClosed();
			if (!_this.isStopped) {
				if (!_this.currentObservers) _this.currentObservers = Array.from(_this.observers);
				try {
					for (var _b = __values(_this.currentObservers), _c = _b.next(); !_c.done; _c = _b.next()) _c.value.next(value);
				} catch (e_1_1) {
					e_1 = { error: e_1_1 };
				} finally {
					try {
						if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
					} finally {
						if (e_1) throw e_1.error;
					}
				}
			}
		});
	};
	Subject.prototype.error = function(err) {
		var _this = this;
		errorContext(function() {
			_this._throwIfClosed();
			if (!_this.isStopped) {
				_this.hasError = _this.isStopped = true;
				_this.thrownError = err;
				var observers = _this.observers;
				while (observers.length) observers.shift().error(err);
			}
		});
	};
	Subject.prototype.complete = function() {
		var _this = this;
		errorContext(function() {
			_this._throwIfClosed();
			if (!_this.isStopped) {
				_this.isStopped = true;
				var observers = _this.observers;
				while (observers.length) observers.shift().complete();
			}
		});
	};
	Subject.prototype.unsubscribe = function() {
		this.isStopped = this.closed = true;
		this.observers = this.currentObservers = null;
	};
	Object.defineProperty(Subject.prototype, "observed", {
		get: function() {
			var _a;
			return ((_a = this.observers) === null || _a === void 0 ? void 0 : _a.length) > 0;
		},
		enumerable: false,
		configurable: true
	});
	Subject.prototype._trySubscribe = function(subscriber) {
		this._throwIfClosed();
		return _super.prototype._trySubscribe.call(this, subscriber);
	};
	Subject.prototype._subscribe = function(subscriber) {
		this._throwIfClosed();
		this._checkFinalizedStatuses(subscriber);
		return this._innerSubscribe(subscriber);
	};
	Subject.prototype._innerSubscribe = function(subscriber) {
		var _this = this;
		var _a = this, hasError = _a.hasError, isStopped = _a.isStopped, observers = _a.observers;
		if (hasError || isStopped) return EMPTY_SUBSCRIPTION;
		this.currentObservers = null;
		observers.push(subscriber);
		return new Subscription(function() {
			_this.currentObservers = null;
			arrRemove(observers, subscriber);
		});
	};
	Subject.prototype._checkFinalizedStatuses = function(subscriber) {
		var _a = this, hasError = _a.hasError, thrownError = _a.thrownError, isStopped = _a.isStopped;
		if (hasError) subscriber.error(thrownError);
		else if (isStopped) subscriber.complete();
	};
	Subject.prototype.asObservable = function() {
		var observable = new Observable();
		observable.source = this;
		return observable;
	};
	Subject.create = function(destination, source) {
		return new AnonymousSubject(destination, source);
	};
	return Subject;
}(Observable);
var AnonymousSubject = function(_super) {
	__extends(AnonymousSubject, _super);
	function AnonymousSubject(destination, source) {
		var _this = _super.call(this) || this;
		_this.destination = destination;
		_this.source = source;
		return _this;
	}
	AnonymousSubject.prototype.next = function(value) {
		var _a, _b;
		(_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.next) === null || _b === void 0 || _b.call(_a, value);
	};
	AnonymousSubject.prototype.error = function(err) {
		var _a, _b;
		(_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 || _b.call(_a, err);
	};
	AnonymousSubject.prototype.complete = function() {
		var _a, _b;
		(_b = (_a = this.destination) === null || _a === void 0 ? void 0 : _a.complete) === null || _b === void 0 || _b.call(_a);
	};
	AnonymousSubject.prototype._subscribe = function(subscriber) {
		var _a, _b;
		return (_b = (_a = this.source) === null || _a === void 0 ? void 0 : _a.subscribe(subscriber)) !== null && _b !== void 0 ? _b : EMPTY_SUBSCRIPTION;
	};
	return AnonymousSubject;
}(Subject);
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/BehaviorSubject.js
var BehaviorSubject = function(_super) {
	__extends(BehaviorSubject, _super);
	function BehaviorSubject(_value) {
		var _this = _super.call(this) || this;
		_this._value = _value;
		return _this;
	}
	Object.defineProperty(BehaviorSubject.prototype, "value", {
		get: function() {
			return this.getValue();
		},
		enumerable: false,
		configurable: true
	});
	BehaviorSubject.prototype._subscribe = function(subscriber) {
		var subscription = _super.prototype._subscribe.call(this, subscriber);
		!subscription.closed && subscriber.next(this._value);
		return subscription;
	};
	BehaviorSubject.prototype.getValue = function() {
		var _a = this, hasError = _a.hasError, thrownError = _a.thrownError, _value = _a._value;
		if (hasError) throw thrownError;
		this._throwIfClosed();
		return _value;
	};
	BehaviorSubject.prototype.next = function(value) {
		_super.prototype.next.call(this, this._value = value);
	};
	return BehaviorSubject;
}(Subject);
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduler/dateTimestampProvider.js
var dateTimestampProvider = {
	now: function() {
		return (dateTimestampProvider.delegate || Date).now();
	},
	delegate: void 0
};
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/ReplaySubject.js
var ReplaySubject = function(_super) {
	__extends(ReplaySubject, _super);
	function ReplaySubject(_bufferSize, _windowTime, _timestampProvider) {
		if (_bufferSize === void 0) _bufferSize = Infinity;
		if (_windowTime === void 0) _windowTime = Infinity;
		if (_timestampProvider === void 0) _timestampProvider = dateTimestampProvider;
		var _this = _super.call(this) || this;
		_this._bufferSize = _bufferSize;
		_this._windowTime = _windowTime;
		_this._timestampProvider = _timestampProvider;
		_this._buffer = [];
		_this._infiniteTimeWindow = true;
		_this._infiniteTimeWindow = _windowTime === Infinity;
		_this._bufferSize = Math.max(1, _bufferSize);
		_this._windowTime = Math.max(1, _windowTime);
		return _this;
	}
	ReplaySubject.prototype.next = function(value) {
		var _a = this, isStopped = _a.isStopped, _buffer = _a._buffer, _infiniteTimeWindow = _a._infiniteTimeWindow, _timestampProvider = _a._timestampProvider, _windowTime = _a._windowTime;
		if (!isStopped) {
			_buffer.push(value);
			!_infiniteTimeWindow && _buffer.push(_timestampProvider.now() + _windowTime);
		}
		this._trimBuffer();
		_super.prototype.next.call(this, value);
	};
	ReplaySubject.prototype._subscribe = function(subscriber) {
		this._throwIfClosed();
		this._trimBuffer();
		var subscription = this._innerSubscribe(subscriber);
		var _a = this, _infiniteTimeWindow = _a._infiniteTimeWindow;
		var copy = _a._buffer.slice();
		for (var i = 0; i < copy.length && !subscriber.closed; i += _infiniteTimeWindow ? 1 : 2) subscriber.next(copy[i]);
		this._checkFinalizedStatuses(subscriber);
		return subscription;
	};
	ReplaySubject.prototype._trimBuffer = function() {
		var _a = this, _bufferSize = _a._bufferSize, _timestampProvider = _a._timestampProvider, _buffer = _a._buffer, _infiniteTimeWindow = _a._infiniteTimeWindow;
		var adjustedBufferSize = (_infiniteTimeWindow ? 1 : 2) * _bufferSize;
		_bufferSize < Infinity && adjustedBufferSize < _buffer.length && _buffer.splice(0, _buffer.length - adjustedBufferSize);
		if (!_infiniteTimeWindow) {
			var now = _timestampProvider.now();
			var last = 0;
			for (var i = 1; i < _buffer.length && _buffer[i] <= now; i += 2) last = i;
			last && _buffer.splice(0, last + 1);
		}
	};
	return ReplaySubject;
}(Subject);
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduler/Action.js
var Action = function(_super) {
	__extends(Action, _super);
	function Action(scheduler, work) {
		return _super.call(this) || this;
	}
	Action.prototype.schedule = function(state, delay) {
		if (delay === void 0) delay = 0;
		return this;
	};
	return Action;
}(Subscription);
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduler/intervalProvider.js
var intervalProvider = {
	setInterval: function(handler, timeout) {
		var args = [];
		for (var _i = 2; _i < arguments.length; _i++) args[_i - 2] = arguments[_i];
		var delegate = intervalProvider.delegate;
		if (delegate === null || delegate === void 0 ? void 0 : delegate.setInterval) return delegate.setInterval.apply(delegate, __spreadArray([handler, timeout], __read(args)));
		return setInterval.apply(void 0, __spreadArray([handler, timeout], __read(args)));
	},
	clearInterval: function(handle) {
		var delegate = intervalProvider.delegate;
		return ((delegate === null || delegate === void 0 ? void 0 : delegate.clearInterval) || clearInterval)(handle);
	},
	delegate: void 0
};
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduler/AsyncAction.js
var AsyncAction = function(_super) {
	__extends(AsyncAction, _super);
	function AsyncAction(scheduler, work) {
		var _this = _super.call(this, scheduler, work) || this;
		_this.scheduler = scheduler;
		_this.work = work;
		_this.pending = false;
		return _this;
	}
	AsyncAction.prototype.schedule = function(state, delay) {
		var _a;
		if (delay === void 0) delay = 0;
		if (this.closed) return this;
		this.state = state;
		var id = this.id;
		var scheduler = this.scheduler;
		if (id != null) this.id = this.recycleAsyncId(scheduler, id, delay);
		this.pending = true;
		this.delay = delay;
		this.id = (_a = this.id) !== null && _a !== void 0 ? _a : this.requestAsyncId(scheduler, this.id, delay);
		return this;
	};
	AsyncAction.prototype.requestAsyncId = function(scheduler, _id, delay) {
		if (delay === void 0) delay = 0;
		return intervalProvider.setInterval(scheduler.flush.bind(scheduler, this), delay);
	};
	AsyncAction.prototype.recycleAsyncId = function(_scheduler, id, delay) {
		if (delay === void 0) delay = 0;
		if (delay != null && this.delay === delay && this.pending === false) return id;
		if (id != null) intervalProvider.clearInterval(id);
	};
	AsyncAction.prototype.execute = function(state, delay) {
		if (this.closed) return /* @__PURE__ */ new Error("executing a cancelled action");
		this.pending = false;
		var error = this._execute(state, delay);
		if (error) return error;
		else if (this.pending === false && this.id != null) this.id = this.recycleAsyncId(this.scheduler, this.id, null);
	};
	AsyncAction.prototype._execute = function(state, _delay) {
		var errored = false;
		var errorValue;
		try {
			this.work(state);
		} catch (e) {
			errored = true;
			errorValue = e ? e : /* @__PURE__ */ new Error("Scheduled action threw falsy error");
		}
		if (errored) {
			this.unsubscribe();
			return errorValue;
		}
	};
	AsyncAction.prototype.unsubscribe = function() {
		if (!this.closed) {
			var _a = this, id = _a.id, scheduler = _a.scheduler;
			var actions = scheduler.actions;
			this.work = this.state = this.scheduler = null;
			this.pending = false;
			arrRemove(actions, this);
			if (id != null) this.id = this.recycleAsyncId(scheduler, id, null);
			this.delay = null;
			_super.prototype.unsubscribe.call(this);
		}
	};
	return AsyncAction;
}(Action);
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/Scheduler.js
var Scheduler = function() {
	function Scheduler(schedulerActionCtor, now) {
		if (now === void 0) now = Scheduler.now;
		this.schedulerActionCtor = schedulerActionCtor;
		this.now = now;
	}
	Scheduler.prototype.schedule = function(work, delay, state) {
		if (delay === void 0) delay = 0;
		return new this.schedulerActionCtor(this, work).schedule(state, delay);
	};
	Scheduler.now = dateTimestampProvider.now;
	return Scheduler;
}();
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduler/AsyncScheduler.js
var AsyncScheduler = function(_super) {
	__extends(AsyncScheduler, _super);
	function AsyncScheduler(SchedulerAction, now) {
		if (now === void 0) now = Scheduler.now;
		var _this = _super.call(this, SchedulerAction, now) || this;
		_this.actions = [];
		_this._active = false;
		return _this;
	}
	AsyncScheduler.prototype.flush = function(action) {
		var actions = this.actions;
		if (this._active) {
			actions.push(action);
			return;
		}
		var error;
		this._active = true;
		do
			if (error = action.execute(action.state, action.delay)) break;
		while (action = actions.shift());
		this._active = false;
		if (error) {
			while (action = actions.shift()) action.unsubscribe();
			throw error;
		}
	};
	return AsyncScheduler;
}(Scheduler);
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduler/QueueAction.js
var QueueAction = function(_super) {
	__extends(QueueAction, _super);
	function QueueAction(scheduler, work) {
		var _this = _super.call(this, scheduler, work) || this;
		_this.scheduler = scheduler;
		_this.work = work;
		return _this;
	}
	QueueAction.prototype.schedule = function(state, delay) {
		if (delay === void 0) delay = 0;
		if (delay > 0) return _super.prototype.schedule.call(this, state, delay);
		this.delay = delay;
		this.state = state;
		this.scheduler.flush(this);
		return this;
	};
	QueueAction.prototype.execute = function(state, delay) {
		return delay > 0 || this.closed ? _super.prototype.execute.call(this, state, delay) : this._execute(state, delay);
	};
	QueueAction.prototype.requestAsyncId = function(scheduler, id, delay) {
		if (delay === void 0) delay = 0;
		if (delay != null && delay > 0 || delay == null && this.delay > 0) return _super.prototype.requestAsyncId.call(this, scheduler, id, delay);
		scheduler.flush(this);
		return 0;
	};
	return QueueAction;
}(AsyncAction);
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduler/queue.js
var queueScheduler = new (function(_super) {
	__extends(QueueScheduler, _super);
	function QueueScheduler() {
		return _super !== null && _super.apply(this, arguments) || this;
	}
	return QueueScheduler;
}(AsyncScheduler))(QueueAction);
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/observable/empty.js
var EMPTY = new Observable(function(subscriber) {
	return subscriber.complete();
});
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/isScheduler.js
function isScheduler(value) {
	return value && isFunction(value.schedule);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/args.js
function last(arr) {
	return arr[arr.length - 1];
}
function popScheduler(args) {
	return isScheduler(last(args)) ? args.pop() : void 0;
}
function popNumber(args, defaultValue) {
	return typeof last(args) === "number" ? args.pop() : defaultValue;
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/isArrayLike.js
var isArrayLike = (function(x) {
	return x && typeof x.length === "number" && typeof x !== "function";
});
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/isPromise.js
function isPromise(value) {
	return isFunction(value === null || value === void 0 ? void 0 : value.then);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/isInteropObservable.js
function isInteropObservable(input) {
	return isFunction(input[observable]);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/isAsyncIterable.js
function isAsyncIterable(obj) {
	return Symbol.asyncIterator && isFunction(obj === null || obj === void 0 ? void 0 : obj[Symbol.asyncIterator]);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/throwUnobservableError.js
function createInvalidObservableTypeError(input) {
	return /* @__PURE__ */ new TypeError("You provided " + (input !== null && typeof input === "object" ? "an invalid object" : "'" + input + "'") + " where a stream was expected. You can provide an Observable, Promise, ReadableStream, Array, AsyncIterable, or Iterable.");
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/symbol/iterator.js
function getSymbolIterator() {
	if (typeof Symbol !== "function" || !Symbol.iterator) return "@@iterator";
	return Symbol.iterator;
}
var iterator = getSymbolIterator();
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/isIterable.js
function isIterable(input) {
	return isFunction(input === null || input === void 0 ? void 0 : input[iterator]);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/isReadableStreamLike.js
function readableStreamLikeToAsyncGenerator(readableStream) {
	return __asyncGenerator(this, arguments, function readableStreamLikeToAsyncGenerator_1() {
		var reader, _a, value, done;
		return __generator(this, function(_b) {
			switch (_b.label) {
				case 0:
					reader = readableStream.getReader();
					_b.label = 1;
				case 1:
					_b.trys.push([
						1,
						,
						9,
						10
					]);
					_b.label = 2;
				case 2: return [4, __await(reader.read())];
				case 3:
					_a = _b.sent(), value = _a.value, done = _a.done;
					if (!done) return [3, 5];
					return [4, __await(void 0)];
				case 4: return [2, _b.sent()];
				case 5: return [4, __await(value)];
				case 6: return [4, _b.sent()];
				case 7:
					_b.sent();
					return [3, 2];
				case 8: return [3, 10];
				case 9:
					reader.releaseLock();
					return [7];
				case 10: return [2];
			}
		});
	});
}
function isReadableStreamLike(obj) {
	return isFunction(obj === null || obj === void 0 ? void 0 : obj.getReader);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/observable/innerFrom.js
function innerFrom(input) {
	if (input instanceof Observable) return input;
	if (input != null) {
		if (isInteropObservable(input)) return fromInteropObservable(input);
		if (isArrayLike(input)) return fromArrayLike(input);
		if (isPromise(input)) return fromPromise(input);
		if (isAsyncIterable(input)) return fromAsyncIterable(input);
		if (isIterable(input)) return fromIterable(input);
		if (isReadableStreamLike(input)) return fromReadableStreamLike(input);
	}
	throw createInvalidObservableTypeError(input);
}
function fromInteropObservable(obj) {
	return new Observable(function(subscriber) {
		var obs = obj[observable]();
		if (isFunction(obs.subscribe)) return obs.subscribe(subscriber);
		throw new TypeError("Provided object does not correctly implement Symbol.observable");
	});
}
function fromArrayLike(array) {
	return new Observable(function(subscriber) {
		for (var i = 0; i < array.length && !subscriber.closed; i++) subscriber.next(array[i]);
		subscriber.complete();
	});
}
function fromPromise(promise) {
	return new Observable(function(subscriber) {
		promise.then(function(value) {
			if (!subscriber.closed) {
				subscriber.next(value);
				subscriber.complete();
			}
		}, function(err) {
			return subscriber.error(err);
		}).then(null, reportUnhandledError);
	});
}
function fromIterable(iterable) {
	return new Observable(function(subscriber) {
		var e_1, _a;
		try {
			for (var iterable_1 = __values(iterable), iterable_1_1 = iterable_1.next(); !iterable_1_1.done; iterable_1_1 = iterable_1.next()) {
				var value = iterable_1_1.value;
				subscriber.next(value);
				if (subscriber.closed) return;
			}
		} catch (e_1_1) {
			e_1 = { error: e_1_1 };
		} finally {
			try {
				if (iterable_1_1 && !iterable_1_1.done && (_a = iterable_1.return)) _a.call(iterable_1);
			} finally {
				if (e_1) throw e_1.error;
			}
		}
		subscriber.complete();
	});
}
function fromAsyncIterable(asyncIterable) {
	return new Observable(function(subscriber) {
		process(asyncIterable, subscriber).catch(function(err) {
			return subscriber.error(err);
		});
	});
}
function fromReadableStreamLike(readableStream) {
	return fromAsyncIterable(readableStreamLikeToAsyncGenerator(readableStream));
}
function process(asyncIterable, subscriber) {
	var asyncIterable_1, asyncIterable_1_1;
	var e_2, _a;
	return __awaiter(this, void 0, void 0, function() {
		var value, e_2_1;
		return __generator(this, function(_b) {
			switch (_b.label) {
				case 0:
					_b.trys.push([
						0,
						5,
						6,
						11
					]);
					asyncIterable_1 = __asyncValues(asyncIterable);
					_b.label = 1;
				case 1: return [4, asyncIterable_1.next()];
				case 2:
					if (!(asyncIterable_1_1 = _b.sent(), !asyncIterable_1_1.done)) return [3, 4];
					value = asyncIterable_1_1.value;
					subscriber.next(value);
					if (subscriber.closed) return [2];
					_b.label = 3;
				case 3: return [3, 1];
				case 4: return [3, 11];
				case 5:
					e_2_1 = _b.sent();
					e_2 = { error: e_2_1 };
					return [3, 11];
				case 6:
					_b.trys.push([
						6,
						,
						9,
						10
					]);
					if (!(asyncIterable_1_1 && !asyncIterable_1_1.done && (_a = asyncIterable_1.return))) return [3, 8];
					return [4, _a.call(asyncIterable_1)];
				case 7:
					_b.sent();
					_b.label = 8;
				case 8: return [3, 10];
				case 9:
					if (e_2) throw e_2.error;
					return [7];
				case 10: return [7];
				case 11:
					subscriber.complete();
					return [2];
			}
		});
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/executeSchedule.js
function executeSchedule(parentSubscription, scheduler, work, delay, repeat) {
	if (delay === void 0) delay = 0;
	if (repeat === void 0) repeat = false;
	var scheduleSubscription = scheduler.schedule(function() {
		work();
		if (repeat) parentSubscription.add(this.schedule(null, delay));
		else this.unsubscribe();
	}, delay);
	parentSubscription.add(scheduleSubscription);
	if (!repeat) return scheduleSubscription;
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/observeOn.js
function observeOn(scheduler, delay) {
	if (delay === void 0) delay = 0;
	return operate(function(source, subscriber) {
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			return executeSchedule(subscriber, scheduler, function() {
				return subscriber.next(value);
			}, delay);
		}, function() {
			return executeSchedule(subscriber, scheduler, function() {
				return subscriber.complete();
			}, delay);
		}, function(err) {
			return executeSchedule(subscriber, scheduler, function() {
				return subscriber.error(err);
			}, delay);
		}));
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/subscribeOn.js
function subscribeOn(scheduler, delay) {
	if (delay === void 0) delay = 0;
	return operate(function(source, subscriber) {
		subscriber.add(scheduler.schedule(function() {
			return source.subscribe(subscriber);
		}, delay));
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduled/scheduleObservable.js
function scheduleObservable(input, scheduler) {
	return innerFrom(input).pipe(subscribeOn(scheduler), observeOn(scheduler));
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduled/schedulePromise.js
function schedulePromise(input, scheduler) {
	return innerFrom(input).pipe(subscribeOn(scheduler), observeOn(scheduler));
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduled/scheduleArray.js
function scheduleArray(input, scheduler) {
	return new Observable(function(subscriber) {
		var i = 0;
		return scheduler.schedule(function() {
			if (i === input.length) subscriber.complete();
			else {
				subscriber.next(input[i++]);
				if (!subscriber.closed) this.schedule();
			}
		});
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduled/scheduleIterable.js
function scheduleIterable(input, scheduler) {
	return new Observable(function(subscriber) {
		var iterator$1;
		executeSchedule(subscriber, scheduler, function() {
			iterator$1 = input[iterator]();
			executeSchedule(subscriber, scheduler, function() {
				var _a;
				var value;
				var done;
				try {
					_a = iterator$1.next(), value = _a.value, done = _a.done;
				} catch (err) {
					subscriber.error(err);
					return;
				}
				if (done) subscriber.complete();
				else subscriber.next(value);
			}, 0, true);
		});
		return function() {
			return isFunction(iterator$1 === null || iterator$1 === void 0 ? void 0 : iterator$1.return) && iterator$1.return();
		};
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduled/scheduleAsyncIterable.js
function scheduleAsyncIterable(input, scheduler) {
	if (!input) throw new Error("Iterable cannot be null");
	return new Observable(function(subscriber) {
		executeSchedule(subscriber, scheduler, function() {
			var iterator = input[Symbol.asyncIterator]();
			executeSchedule(subscriber, scheduler, function() {
				iterator.next().then(function(result) {
					if (result.done) subscriber.complete();
					else subscriber.next(result.value);
				});
			}, 0, true);
		});
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduled/scheduleReadableStreamLike.js
function scheduleReadableStreamLike(input, scheduler) {
	return scheduleAsyncIterable(readableStreamLikeToAsyncGenerator(input), scheduler);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/scheduled/scheduled.js
function scheduled(input, scheduler) {
	if (input != null) {
		if (isInteropObservable(input)) return scheduleObservable(input, scheduler);
		if (isArrayLike(input)) return scheduleArray(input, scheduler);
		if (isPromise(input)) return schedulePromise(input, scheduler);
		if (isAsyncIterable(input)) return scheduleAsyncIterable(input, scheduler);
		if (isIterable(input)) return scheduleIterable(input, scheduler);
		if (isReadableStreamLike(input)) return scheduleReadableStreamLike(input, scheduler);
	}
	throw createInvalidObservableTypeError(input);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/observable/from.js
function from(input, scheduler) {
	return scheduler ? scheduled(input, scheduler) : innerFrom(input);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/observable/of.js
function of() {
	var args = [];
	for (var _i = 0; _i < arguments.length; _i++) args[_i] = arguments[_i];
	return from(args, popScheduler(args));
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/isObservable.js
function isObservable(obj) {
	return !!obj && (obj instanceof Observable || isFunction(obj.lift) && isFunction(obj.subscribe));
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/map.js
function map(project, thisArg) {
	return operate(function(source, subscriber) {
		var index = 0;
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			subscriber.next(project.call(thisArg, value, index++));
		}));
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/util/mapOneOrManyArgs.js
var isArray = Array.isArray;
function callOrApply(fn, args) {
	return isArray(args) ? fn.apply(void 0, __spreadArray([], __read(args))) : fn(args);
}
function mapOneOrManyArgs(fn) {
	return map(function(args) {
		return callOrApply(fn, args);
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/mergeInternals.js
function mergeInternals(source, subscriber, project, concurrent, onBeforeNext, expand, innerSubScheduler, additionalFinalizer) {
	var buffer = [];
	var active = 0;
	var index = 0;
	var isComplete = false;
	var checkComplete = function() {
		if (isComplete && !buffer.length && !active) subscriber.complete();
	};
	var outerNext = function(value) {
		return active < concurrent ? doInnerSub(value) : buffer.push(value);
	};
	var doInnerSub = function(value) {
		expand && subscriber.next(value);
		active++;
		var innerComplete = false;
		innerFrom(project(value, index++)).subscribe(createOperatorSubscriber(subscriber, function(innerValue) {
			onBeforeNext === null || onBeforeNext === void 0 || onBeforeNext(innerValue);
			if (expand) outerNext(innerValue);
			else subscriber.next(innerValue);
		}, function() {
			innerComplete = true;
		}, void 0, function() {
			if (innerComplete) try {
				active--;
				var _loop_1 = function() {
					var bufferedValue = buffer.shift();
					if (innerSubScheduler) executeSchedule(subscriber, innerSubScheduler, function() {
						return doInnerSub(bufferedValue);
					});
					else doInnerSub(bufferedValue);
				};
				while (buffer.length && active < concurrent) _loop_1();
				checkComplete();
			} catch (err) {
				subscriber.error(err);
			}
		}));
	};
	source.subscribe(createOperatorSubscriber(subscriber, outerNext, function() {
		isComplete = true;
		checkComplete();
	}));
	return function() {
		additionalFinalizer === null || additionalFinalizer === void 0 || additionalFinalizer();
	};
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/mergeMap.js
function mergeMap(project, resultSelector, concurrent) {
	if (concurrent === void 0) concurrent = Infinity;
	if (isFunction(resultSelector)) return mergeMap(function(a, i) {
		return map(function(b, ii) {
			return resultSelector(a, b, i, ii);
		})(innerFrom(project(a, i)));
	}, concurrent);
	else if (typeof resultSelector === "number") concurrent = resultSelector;
	return operate(function(source, subscriber) {
		return mergeInternals(source, subscriber, project, concurrent);
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/mergeAll.js
function mergeAll(concurrent) {
	if (concurrent === void 0) concurrent = Infinity;
	return mergeMap(identity, concurrent);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/observable/defer.js
function defer(observableFactory) {
	return new Observable(function(subscriber) {
		innerFrom(observableFactory()).subscribe(subscriber);
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/observable/fromEvent.js
var nodeEventEmitterMethods = ["addListener", "removeListener"];
var eventTargetMethods = ["addEventListener", "removeEventListener"];
var jqueryMethods = ["on", "off"];
function fromEvent(target, eventName, options, resultSelector) {
	if (isFunction(options)) {
		resultSelector = options;
		options = void 0;
	}
	if (resultSelector) return fromEvent(target, eventName, options).pipe(mapOneOrManyArgs(resultSelector));
	var _a = __read(isEventTarget(target) ? eventTargetMethods.map(function(methodName) {
		return function(handler) {
			return target[methodName](eventName, handler, options);
		};
	}) : isNodeStyleEventEmitter(target) ? nodeEventEmitterMethods.map(toCommonHandlerRegistry(target, eventName)) : isJQueryStyleEventEmitter(target) ? jqueryMethods.map(toCommonHandlerRegistry(target, eventName)) : [], 2), add = _a[0], remove = _a[1];
	if (!add) {
		if (isArrayLike(target)) return mergeMap(function(subTarget) {
			return fromEvent(subTarget, eventName, options);
		})(innerFrom(target));
	}
	if (!add) throw new TypeError("Invalid event target");
	return new Observable(function(subscriber) {
		var handler = function() {
			var args = [];
			for (var _i = 0; _i < arguments.length; _i++) args[_i] = arguments[_i];
			return subscriber.next(1 < args.length ? args : args[0]);
		};
		add(handler);
		return function() {
			return remove(handler);
		};
	});
}
function toCommonHandlerRegistry(target, eventName) {
	return function(methodName) {
		return function(handler) {
			return target[methodName](eventName, handler);
		};
	};
}
function isNodeStyleEventEmitter(target) {
	return isFunction(target.addListener) && isFunction(target.removeListener);
}
function isJQueryStyleEventEmitter(target) {
	return isFunction(target.on) && isFunction(target.off);
}
function isEventTarget(target) {
	return isFunction(target.addEventListener) && isFunction(target.removeEventListener);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/observable/merge.js
function merge() {
	var args = [];
	for (var _i = 0; _i < arguments.length; _i++) args[_i] = arguments[_i];
	var scheduler = popScheduler(args);
	var concurrent = popNumber(args, Infinity);
	var sources = args;
	return !sources.length ? EMPTY : sources.length === 1 ? innerFrom(sources[0]) : mergeAll(concurrent)(from(sources, scheduler));
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/filter.js
function filter(predicate, thisArg) {
	return operate(function(source, subscriber) {
		var index = 0;
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			return predicate.call(thisArg, value, index++) && subscriber.next(value);
		}));
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/concatMap.js
function concatMap(project, resultSelector) {
	return isFunction(resultSelector) ? mergeMap(project, resultSelector, 1) : mergeMap(project, 1);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/take.js
function take(count) {
	return count <= 0 ? function() {
		return EMPTY;
	} : operate(function(source, subscriber) {
		var seen = 0;
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			if (++seen <= count) {
				subscriber.next(value);
				if (count <= seen) subscriber.complete();
			}
		}));
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/ignoreElements.js
function ignoreElements() {
	return operate(function(source, subscriber) {
		source.subscribe(createOperatorSubscriber(subscriber, noop$1));
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/distinctUntilChanged.js
function distinctUntilChanged(comparator, keySelector) {
	if (keySelector === void 0) keySelector = identity;
	comparator = comparator !== null && comparator !== void 0 ? comparator : defaultCompare;
	return operate(function(source, subscriber) {
		var previousKey;
		var first = true;
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			var currentKey = keySelector(value);
			if (first || !comparator(previousKey, currentKey)) {
				first = false;
				previousKey = currentKey;
				subscriber.next(value);
			}
		}));
	});
}
function defaultCompare(a, b) {
	return a === b;
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/share.js
function share(options) {
	if (options === void 0) options = {};
	var _a = options.connector, connector = _a === void 0 ? function() {
		return new Subject();
	} : _a, _b = options.resetOnError, resetOnError = _b === void 0 ? true : _b, _c = options.resetOnComplete, resetOnComplete = _c === void 0 ? true : _c, _d = options.resetOnRefCountZero, resetOnRefCountZero = _d === void 0 ? true : _d;
	return function(wrapperSource) {
		var connection;
		var resetConnection;
		var subject;
		var refCount = 0;
		var hasCompleted = false;
		var hasErrored = false;
		var cancelReset = function() {
			resetConnection === null || resetConnection === void 0 || resetConnection.unsubscribe();
			resetConnection = void 0;
		};
		var reset = function() {
			cancelReset();
			connection = subject = void 0;
			hasCompleted = hasErrored = false;
		};
		var resetAndUnsubscribe = function() {
			var conn = connection;
			reset();
			conn === null || conn === void 0 || conn.unsubscribe();
		};
		return operate(function(source, subscriber) {
			refCount++;
			if (!hasErrored && !hasCompleted) cancelReset();
			var dest = subject = subject !== null && subject !== void 0 ? subject : connector();
			subscriber.add(function() {
				refCount--;
				if (refCount === 0 && !hasErrored && !hasCompleted) resetConnection = handleReset(resetAndUnsubscribe, resetOnRefCountZero);
			});
			dest.subscribe(subscriber);
			if (!connection && refCount > 0) {
				connection = new SafeSubscriber({
					next: function(value) {
						return dest.next(value);
					},
					error: function(err) {
						hasErrored = true;
						cancelReset();
						resetConnection = handleReset(reset, resetOnError, err);
						dest.error(err);
					},
					complete: function() {
						hasCompleted = true;
						cancelReset();
						resetConnection = handleReset(reset, resetOnComplete);
						dest.complete();
					}
				});
				innerFrom(source).subscribe(connection);
			}
		})(wrapperSource);
	};
}
function handleReset(reset, on) {
	var args = [];
	for (var _i = 2; _i < arguments.length; _i++) args[_i - 2] = arguments[_i];
	if (on === true) {
		reset();
		return;
	}
	if (on === false) return;
	var onSubscriber = new SafeSubscriber({ next: function() {
		onSubscriber.unsubscribe();
		reset();
	} });
	return innerFrom(on.apply(void 0, __spreadArray([], __read(args)))).subscribe(onSubscriber);
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/shareReplay.js
function shareReplay(configOrBufferSize, windowTime, scheduler) {
	var _a, _b, _c;
	var bufferSize;
	var refCount = false;
	if (configOrBufferSize && typeof configOrBufferSize === "object") _a = configOrBufferSize.bufferSize, bufferSize = _a === void 0 ? Infinity : _a, _b = configOrBufferSize.windowTime, windowTime = _b === void 0 ? Infinity : _b, _c = configOrBufferSize.refCount, refCount = _c === void 0 ? false : _c, scheduler = configOrBufferSize.scheduler;
	else bufferSize = configOrBufferSize !== null && configOrBufferSize !== void 0 ? configOrBufferSize : Infinity;
	return share({
		connector: function() {
			return new ReplaySubject(bufferSize, windowTime, scheduler);
		},
		resetOnError: true,
		resetOnComplete: false,
		resetOnRefCountZero: refCount
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/switchMap.js
function switchMap(project, resultSelector) {
	return operate(function(source, subscriber) {
		var innerSubscriber = null;
		var index = 0;
		var isComplete = false;
		var checkComplete = function() {
			return isComplete && !innerSubscriber && subscriber.complete();
		};
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			innerSubscriber === null || innerSubscriber === void 0 || innerSubscriber.unsubscribe();
			var innerIndex = 0;
			var outerIndex = index++;
			innerFrom(project(value, outerIndex)).subscribe(innerSubscriber = createOperatorSubscriber(subscriber, function(innerValue) {
				return subscriber.next(resultSelector ? resultSelector(value, innerValue, outerIndex, innerIndex++) : innerValue);
			}, function() {
				innerSubscriber = null;
				checkComplete();
			}));
		}, function() {
			isComplete = true;
			checkComplete();
		}));
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/takeUntil.js
function takeUntil(notifier) {
	return operate(function(source, subscriber) {
		innerFrom(notifier).subscribe(createOperatorSubscriber(subscriber, function() {
			return subscriber.complete();
		}, noop$1));
		!subscriber.closed && source.subscribe(subscriber);
	});
}
//#endregion
//#region ../../node_modules/.pnpm/rxjs@7.8.2/node_modules/rxjs/dist/esm5/internal/operators/tap.js
function tap(observerOrNext, error, complete) {
	var tapObserver = isFunction(observerOrNext) || error || complete ? {
		next: observerOrNext,
		error,
		complete
	} : observerOrNext;
	return tapObserver ? operate(function(source, subscriber) {
		var _a;
		(_a = tapObserver.subscribe) === null || _a === void 0 || _a.call(tapObserver);
		var isUnsub = true;
		source.subscribe(createOperatorSubscriber(subscriber, function(value) {
			var _a;
			(_a = tapObserver.next) === null || _a === void 0 || _a.call(tapObserver, value);
			subscriber.next(value);
		}, function() {
			var _a;
			isUnsub = false;
			(_a = tapObserver.complete) === null || _a === void 0 || _a.call(tapObserver);
			subscriber.complete();
		}, function(err) {
			var _a;
			isUnsub = false;
			(_a = tapObserver.error) === null || _a === void 0 || _a.call(tapObserver, err);
			subscriber.error(err);
		}, function() {
			var _a, _b;
			if (isUnsub) (_a = tapObserver.unsubscribe) === null || _a === void 0 || _a.call(tapObserver);
			(_b = tapObserver.finalize) === null || _b === void 0 || _b.call(tapObserver);
		}));
	}) : identity;
}
//#endregion
//#region ../xdom/dist/1_domTemplate.js
var kebab$1 = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
function analyze(template) {
	const parts = slash(template).parts;
	const keys = [];
	const literals = [];
	for (const part of parts) if (part.kind === "literal") literals.push(part.value);
	else keys.push(part.name);
	return {
		keys,
		skeleton: literals.join("/")
	};
}
function fromDelegatedEvent(template, eventName, root = document) {
	const p = slash(template);
	return new Observable((subscriber) => {
		const listener = (event) => {
			let element = event.target instanceof HTMLElement ? event.target : null;
			while (element) {
				const result = p.match(element.id);
				if (result.matched) {
					const params = result.values;
					subscriber.next(Object.assign(event, {
						delegateElement: element,
						params
					}));
					return;
				}
				element = element.parentElement;
			}
		};
		root.addEventListener(eventName, listener);
		return () => root.removeEventListener(eventName, listener);
	});
}
var ROUTE_BOUNDARY_ATTR = "data-route-boundary";
/** The same name as `dataset` spells it. */
var ROUTE_BOUNDARY_KEY = "routeBoundary";
function fromDelegatedRoute(template, eventName, root = document) {
	const { keys, skeleton } = analyze(template);
	return new Observable((subscriber) => {
		const listener = (event) => {
			const segments = [];
			const params = {};
			let delegate;
			let el = event.target instanceof HTMLElement ? event.target : null;
			while (el) {
				const ds = el.dataset;
				if (ds.route !== void 0) {
					if (!delegate) delegate = el;
					segments.unshift(ds.route);
				}
				for (const key of keys) {
					const v = ds[key];
					if (v !== void 0 && params[key] === void 0) params[key] = v;
				}
				if (ds[ROUTE_BOUNDARY_KEY] !== void 0) break;
				el = el.parentElement;
			}
			if (delegate && segments.join("/") === skeleton && keys.every((k) => k in params)) subscriber.next(Object.assign(event, {
				delegateElement: delegate,
				params
			}));
		};
		root.addEventListener(eventName, listener);
		return () => root.removeEventListener(eventName, listener);
	});
}
var cache = /* @__PURE__ */ new Map();
function Dom(template) {
	const cached = cache.get(template);
	if (cached) return cached;
	const p = slash(template);
	const { skeleton } = analyze(template);
	const print = p.print;
	const streams = {};
	const routeStreams = {};
	const result = {
		template,
		id: (values) => print(values),
		with: (values) => ({ id: print(values) }),
		$: new Proxy({}, { get: (_, eventName) => streams[eventName] ??= fromDelegatedEvent(template, eventName).pipe(share()) }),
		route: new Proxy({}, { get: (_, eventName) => routeStreams[eventName] ??= fromDelegatedRoute(template, eventName).pipe(share()) }),
		boxAttrs: (values) => {
			const attrs = { "data-route": skeleton };
			for (const key of Object.keys(values)) attrs[`data-${kebab$1(key)}`] = String(values[key]);
			return attrs;
		}
	};
	cache.set(template, result);
	return result;
}
//#endregion
//#region src/3_paths.ts
var LOCAL = {
	grid: "/g/{gridId}",
	viewport: "/vp",
	header: "/h/{colId}",
	headerResize: "/resize",
	headerMove: "/move",
	row: "/r/{rowId}",
	expander: "/expand",
	rowCheck: "/check",
	rowMove: "/move",
	cell: "/c/{colId}",
	cellExpander: "/expand"
};
var grid$1 = slash(LOCAL.grid);
var header = grid$1.concatenate(slash(LOCAL.header));
var row = grid$1.concatenate(slash(LOCAL.row));
var cell = row.concatenate(slash(LOCAL.cell));
/** Frozen because a mutated route map is a silently mis-delegating grid. */
var PATHS = Object.freeze({
	grid: grid$1,
	viewport: grid$1.concatenate(slash(LOCAL.viewport)),
	header,
	headerResize: header.concatenate(slash(LOCAL.headerResize)),
	headerMove: header.concatenate(slash(LOCAL.headerMove)),
	row,
	expander: row.concatenate(slash(LOCAL.expander)),
	rowCheck: row.concatenate(slash(LOCAL.rowCheck)),
	rowMove: row.concatenate(slash(LOCAL.rowMove)),
	cell,
	cellExpander: cell.concatenate(slash(LOCAL.cellExpander))
});
/** The same set as raw text, because `Dom()` keys its cache by the template string. */
var TEMPLATES = Object.freeze({
	grid: PATHS.grid.template,
	viewport: PATHS.viewport.template,
	header: PATHS.header.template,
	headerResize: PATHS.headerResize.template,
	headerMove: PATHS.headerMove.template,
	row: PATHS.row.template,
	expander: PATHS.expander.template,
	rowCheck: PATHS.rowCheck.template,
	rowMove: PATHS.rowMove.template,
	cell: PATHS.cell.template,
	cellExpander: PATHS.cellExpander.template
});
var bind = (template) => Dom(template);
function gridDom(gridId) {
	return {
		gridId,
		grid: bind(TEMPLATES.grid),
		viewport: bind(TEMPLATES.viewport),
		header: bind(TEMPLATES.header),
		headerResize: bind(TEMPLATES.headerResize),
		headerMove: bind(TEMPLATES.headerMove),
		row: bind(TEMPLATES.row),
		expander: bind(TEMPLATES.expander),
		rowCheck: bind(TEMPLATES.rowCheck),
		rowMove: bind(TEMPLATES.rowMove),
		cell: bind(TEMPLATES.cell),
		cellExpander: bind(TEMPLATES.cellExpander)
	};
}
var kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
var partsOf = (template) => slash(template).parts;
/** The literal segments of a template, which is the value of its `data-route`. */
var skeletonOf = (template) => partsOf(template).flatMap((part) => part.kind === "literal" ? [part.value] : []).join("/");
function routeAttrs(template, values) {
	const attrs = { "data-route": skeletonOf(template) };
	for (const part of partsOf(template)) {
		if (part.kind === "literal") continue;
		const value = values[part.name];
		if (value !== void 0) attrs[`data-${kebab(part.name)}`] = value;
	}
	return attrs;
}
var gridAttrs = (gridId) => ({
	...routeAttrs(LOCAL.grid, { gridId }),
	[ROUTE_BOUNDARY_ATTR]: ""
});
var headerAttrs = (colId) => routeAttrs(LOCAL.header, { colId });
var resizeAttrs = () => routeAttrs(LOCAL.headerResize, {});
/** Shared by the header and the row handle: the ancestor segment tells them apart. */
var moveAttrs = () => routeAttrs(LOCAL.headerMove, {});
var rowAttrs = (rowId) => routeAttrs(LOCAL.row, { rowId });
var expandAttrs = () => routeAttrs(LOCAL.expander, {});
var cellAttrs = (colId) => routeAttrs(LOCAL.cell, { colId });
/** An attribute selector is a quoted string, so the two characters that can end it early go. */
var quote = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
function selectorFor(part, values = {}) {
	return Object.entries(routeAttrs(LOCAL[part], values)).map(([name, value]) => `[${name}="${quote(value)}"]`).join("");
}
var modifiersOf = (event) => ({
	alt: event.altKey,
	ctrl: event.ctrlKey,
	meta: event.metaKey,
	shift: event.shiftKey,
	button: "button" in event ? event.button : 0
});
var INTERACTIVE = [
	"a[href]",
	"button",
	"input",
	"select",
	"textarea",
	"[contenteditable]:not([contenteditable=\"false\"])",
	"[data-route]"
].join(", ");
var elementOf = (target) => typeof Element !== "undefined" && target instanceof Element ? target : null;
var interactiveIn = (event) => {
	const host = event.delegateElement;
	const target = elementOf(event.target);
	if (host === void 0 || target === null) return false;
	const found = target.closest(INTERACTIVE);
	return found !== null && found !== host && host.contains(found);
};
/** A modified click on a link is the browser's: a new tab, a download, a saved target. The grid
* raises nothing for it, and `8_grid.ts` is where that filter sits. */
var browserOwnsClick = (event) => {
	const target = elementOf(event.target);
	if (target === null) return false;
	return target.closest("a[href]") !== null && !isPlainClick(modifiersOf(event));
};
/** @feature view.scroll */
var intentOf = Object.freeze({
	"cell.click": (event) => ({
		phase: "intent",
		type: "cell.click",
		row: event.params.rowId,
		col: event.params.colId,
		mods: modifiersOf(event),
		interactive: interactiveIn(event)
	}),
	"cell.dblclick": (event) => ({
		phase: "intent",
		type: "cell.dblclick",
		row: event.params.rowId,
		col: event.params.colId,
		mods: modifiersOf(event),
		interactive: interactiveIn(event)
	}),
	"cell.pointerdown": (event) => ({
		phase: "intent",
		type: "cell.pointerdown",
		row: event.params.rowId,
		col: event.params.colId,
		mods: modifiersOf(event)
	}),
	"cell.pointerenter": (event) => ({
		phase: "intent",
		type: "cell.pointerenter",
		row: event.params.rowId,
		col: event.params.colId
	}),
	"cell.contextmenu": (event) => ({
		phase: "intent",
		type: "cell.contextmenu",
		row: event.params.rowId,
		col: event.params.colId,
		x: event.clientX,
		y: event.clientY,
		mods: modifiersOf(event)
	}),
	"header.contextmenu": (event) => ({
		phase: "intent",
		type: "header.contextmenu",
		col: event.params.colId,
		x: event.clientX,
		y: event.clientY,
		mods: modifiersOf(event)
	}),
	"header.click": (event) => ({
		phase: "intent",
		type: "header.click",
		col: event.params.colId,
		mods: modifiersOf(event)
	}),
	"header.pointerdown": (event, part) => ({
		phase: "intent",
		type: "header.pointerdown",
		col: event.params.colId,
		part,
		x: event.clientX,
		width: headerBoxOf(event.delegateElement),
		mods: modifiersOf(event)
	}),
	"row.contextmenu": (event) => ({
		phase: "intent",
		type: "row.contextmenu",
		row: event.params.rowId,
		x: event.clientX,
		y: event.clientY,
		mods: modifiersOf(event)
	}),
	"row.pointerdown": (event) => ({
		phase: "intent",
		type: "row.pointerdown",
		row: event.params.rowId,
		part: "handle",
		y: event.clientY
	}),
	/** Null is the leave edge, so no reducer needs a separate unhover case. */
	"row.hover": (event) => ({
		phase: "intent",
		type: "row.hover",
		row: event === null ? null : event.params.rowId
	}),
	"expander.click": (event) => ({
		phase: "intent",
		type: "expander.click",
		row: event.params.rowId,
		mods: modifiersOf(event)
	}),
	"checkbox.click": (event) => ({
		phase: "intent",
		type: "checkbox.click",
		row: event.params.rowId,
		mods: modifiersOf(event)
	}),
	key: (event) => ({
		phase: "intent",
		type: "key",
		key: event.key,
		mods: modifiersOf(event)
	}),
	"viewport.scroll": (box) => ({
		phase: "intent",
		type: "viewport.scroll",
		top: box.scrollTop,
		left: box.scrollLeft
	}),
	"viewport.resize": (box) => ({
		phase: "intent",
		type: "viewport.resize",
		width: box.width,
		height: box.height
	})
});
var HEADER_SEGMENT = skeletonOf(LOCAL.header);
/** The header cell's painted width, climbing out of whichever child the pointer actually matched. */
var headerBoxOf = (el) => {
	return (el?.closest(`[data-route="${HEADER_SEGMENT}"]`) ?? el)?.getBoundingClientRect().width ?? 0;
};
var ROW_SEGMENT = skeletonOf(LOCAL.row);
var SAFE_IDENT_CHAR = /^[A-Za-z0-9-]$/;
var ENCODED = /* @__PURE__ */ new Map();
/** @feature view.theme */
var encodeVarId = (id) => {
	const hit = ENCODED.get(id);
	if (hit !== void 0) return hit;
	const built = [...id].map((char) => char.length === 1 && SAFE_IDENT_CHAR.test(char) ? char : `_${(char.codePointAt(0) ?? 0).toString(16)}-`).join("");
	ENCODED.set(id, built);
	return built;
};
var rowHeightVar = (rowId) => `--sg-${ROW_SEGMENT}-h-${encodeVarId(rowId)}`;
/** Tree indent. Written once per row, read by every cell in it. */
var SG_DEPTH = "--sg-depth";
//#endregion
//#region src/4_slice.ts
var DEFAULT_COL_WIDTH$2 = 100;
var clamp$1 = (value, low, high) => value < low ? low : value > high ? high : value;
/**
* Splits `flat` into the three sticky runs. A key with no side is center.
* One pass with one bucket per key, so a pinned key leaves center exactly once and the three runs
* concatenate back to a permutation of the input.
* @feature row.pin
* @feature col.pin
*/
function partition(flat, side) {
	const start = [];
	const center = [];
	const end = [];
	for (const key of flat) {
		const at = side(key);
		if (at === "start") start.push(key);
		else if (at === "end") end.push(key);
		else center.push(key);
	}
	return {
		start,
		center,
		end
	};
}
/**
* The page slice of the center run. Pinned keys never reach here, which is what keeps them on
* every page.
* @feature page.paginate
*/
function paginate(center, page, enabled) {
	if (!enabled) return center;
	const size = Math.trunc(page.size);
	if (size <= 0) return [];
	const from = Math.max(0, Math.trunc(page.index)) * size;
	return center.slice(from, from + size);
}
/** Every method O(1), no allocation past the returned object. The common case, so it stays cheap. */
function uniformSizer(count, size) {
	const rowCount = Math.max(0, Math.trunc(count));
	const px = Math.max(0, size);
	return {
		count: rowCount,
		total: rowCount * px,
		offsetOf: (it) => clamp$1(Math.trunc(it), 0, rowCount) * px,
		sizeOf: (it) => it >= 0 && it < rowCount ? px : 0,
		indexAt: (it) => rowCount === 0 || px <= 0 ? 0 : clamp$1(Math.floor(it / px), 0, rowCount - 1)
	};
}
/**
* Variable row heights. Measurements arrive from an observer a batch at a time, so the cost lands
* once at construction rather than on every read during a scroll.
* @feature row.height
*/
function measuredSizer(count, estimate, measured) {
	const rowCount = Math.max(0, Math.trunc(count));
	const fallback = Math.max(0, estimate);
	const prefix = new Array(rowCount + 1);
	prefix[0] = 0;
	for (let index = 0; index < rowCount; index++) {
		const found = measured.get(index);
		prefix[index + 1] = (prefix[index] ?? 0) + (found === void 0 ? fallback : Math.max(0, found));
	}
	const at = (it) => prefix[it] ?? 0;
	const total = at(rowCount);
	return {
		count: rowCount,
		total,
		offsetOf: (it) => at(clamp$1(Math.trunc(it), 0, rowCount)),
		sizeOf: (it) => {
			const index = Math.trunc(it);
			return index >= 0 && index < rowCount ? at(index + 1) - at(index) : 0;
		},
		indexAt: (it) => {
			if (rowCount === 0) return 0;
			if (it < 0) return 0;
			if (it >= total) return rowCount - 1;
			let low = 0;
			let high = rowCount - 1;
			while (low < high) {
				const middle = low + high >> 1;
				if (at(middle + 1) > it) high = middle;
				else low = middle + 1;
			}
			return low;
		}
	};
}
/**
* The rendered index range for a viewport. Half-open `[start, end)`, clamped to `[0, count]`.
* Overscan lives at this edge and nowhere deeper: it is a repaint budget, not part of the model.
* @feature view.virtualize.row
*/
function windowOf(sizer, viewport, overscan) {
	const rowCount = sizer.count;
	if (rowCount === 0) return {
		start: 0,
		end: 0
	};
	const pad = Math.max(0, Math.trunc(overscan));
	const top = sizer.indexAt(viewport.start);
	if (viewport.extent <= 0) return {
		start: top,
		end: top
	};
	const bottomPx = viewport.start + viewport.extent;
	const last = sizer.indexAt(bottomPx);
	const end = sizer.offsetOf(last) >= bottomPx ? last : last + 1;
	return {
		start: clamp$1(top - pad, 0, rowCount),
		end: clamp$1(end + pad, 0, rowCount)
	};
}
function sliceKeys(keys, span) {
	if (span.start <= 0 && span.end >= keys.length) return keys;
	return keys.slice(Math.max(0, span.start), Math.max(0, span.end));
}
var DEFAULT_OVERSCAN = 4;
/** partition -> paginate -> size. Costs the relation. */
function planBase(input) {
	const { start, center, end } = partition(input.flat, input.side);
	const paged = paginate(center, input.page, input.paginate);
	const size = Math.trunc(input.page.size);
	return {
		start,
		end,
		paged,
		sizer: input.sizer(paged),
		pageCount: size > 0 ? Math.ceil(center.length / size) : 0
	};
}
/** virtualize. Costs the window. */
function planWindow(base, input) {
	const span = input.virtualize ? windowOf(base.sizer, input.viewport, input.overscan ?? DEFAULT_OVERSCAN) : {
		start: 0,
		end: base.paged.length
	};
	return {
		sizer: base.sizer,
		start: base.start,
		center: sliceKeys(base.paged, span),
		end: base.end,
		span,
		centerTotal: base.sizer.total,
		offsetTop: base.sizer.offsetOf(span.start),
		pageCount: base.pageCount
	};
}
/** partition -> paginate -> virtualize, in that order, once. */
function renderPlan(input) {
	return planWindow(planBase(input), input);
}
var NO_SPACERS = {
	lead: 0,
	trail: 0,
	tracked: false
};
/** Read off the plan's own sizer, so a spacer can never describe a run other than the one that was
* windowed. @feature view.virtualize.col */
function spacersOf(plan) {
	const lead = Math.max(0, plan.offsetTop);
	const trail = Math.max(0, plan.centerTotal - plan.sizer.offsetOf(plan.span.end));
	if (lead === 0 && trail === 0) return NO_SPACERS;
	return {
		lead,
		trail,
		tracked: true
	};
}
var trackPx = (value) => `${Math.round(Math.max(0, value) * 100) / 100}px`;
/** One `grid-template-columns` value. `maxWidth` takes the upper slot even when `flex` is set,
* because `minmax()` cannot hold both a flexible max and a cap. @feature col.size */
function trackList(cols) {
	if (cols.length === 0) return "none";
	return cols.map(trackOf).join(" ");
}
function trackOf(col) {
	const flex = col.flex;
	const base = flex !== void 0 && flex > 0 ? `${flex}fr` : trackPx(col.width ?? DEFAULT_COL_WIDTH$2);
	if (col.minWidth === void 0 && col.maxWidth === void 0) return base;
	return `minmax(${col.minWidth === void 0 ? "0px" : trackPx(col.minWidth)}, ${col.maxWidth === void 0 ? base : trackPx(col.maxWidth)})`;
}
//#endregion
//#region ../signals/dist/0_log.js
var noop = () => {};
var LOG = {
	on: false,
	emit: noop
};
var CAT_WRITE = ["signals", "write"];
var CAT_EMIT = ["signals", "emit"];
var CAT_SELECTOR = ["signals", "selector"];
var CAT_COMPUTE = ["signals", "compute"];
var CAT_INVALIDATE = ["signals", "invalidate"];
var CAT_SUBSCRIBE = ["signals", "subscribe"];
var CAT_UNSUBSCRIBE = ["signals", "unsubscribe"];
/**
* @license
* Lodash <https://lodash.com/>
* Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
* Released under MIT license <https://lodash.com/license>
* Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
* Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
*/
//#endregion
//#region ../../node_modules/.pnpm/immer@10.2.0/node_modules/immer/dist/immer.mjs
var import_lodash = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function() {
		/** Used as a safe reference for `undefined` in pre-ES5 environments. */
		var undefined;
		/** Used as the semantic version number. */
		var VERSION = "4.17.21";
		/** Used as the size to enable large array optimizations. */
		var LARGE_ARRAY_SIZE = 200;
		/** Error message constants. */
		var CORE_ERROR_TEXT = "Unsupported core-js use. Try https://npms.io/search?q=ponyfill.", FUNC_ERROR_TEXT = "Expected a function", INVALID_TEMPL_VAR_ERROR_TEXT = "Invalid `variable` option passed into `_.template`";
		/** Used to stand-in for `undefined` hash values. */
		var HASH_UNDEFINED = "__lodash_hash_undefined__";
		/** Used as the maximum memoize cache size. */
		var MAX_MEMOIZE_SIZE = 500;
		/** Used as the internal argument placeholder. */
		var PLACEHOLDER = "__lodash_placeholder__";
		/** Used to compose bitmasks for cloning. */
		var CLONE_DEEP_FLAG = 1, CLONE_FLAT_FLAG = 2, CLONE_SYMBOLS_FLAG = 4;
		/** Used to compose bitmasks for value comparisons. */
		var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
		/** Used to compose bitmasks for function metadata. */
		var WRAP_BIND_FLAG = 1, WRAP_BIND_KEY_FLAG = 2, WRAP_CURRY_BOUND_FLAG = 4, WRAP_CURRY_FLAG = 8, WRAP_CURRY_RIGHT_FLAG = 16, WRAP_PARTIAL_FLAG = 32, WRAP_PARTIAL_RIGHT_FLAG = 64, WRAP_ARY_FLAG = 128, WRAP_REARG_FLAG = 256, WRAP_FLIP_FLAG = 512;
		/** Used as default options for `_.truncate`. */
		var DEFAULT_TRUNC_LENGTH = 30, DEFAULT_TRUNC_OMISSION = "...";
		/** Used to detect hot functions by number of calls within a span of milliseconds. */
		var HOT_COUNT = 800, HOT_SPAN = 16;
		/** Used to indicate the type of lazy iteratees. */
		var LAZY_FILTER_FLAG = 1, LAZY_MAP_FLAG = 2, LAZY_WHILE_FLAG = 3;
		/** Used as references for various `Number` constants. */
		var INFINITY = 1 / 0, MAX_SAFE_INTEGER = 9007199254740991, MAX_INTEGER = 17976931348623157e292, NAN = NaN;
		/** Used as references for the maximum length and index of an array. */
		var MAX_ARRAY_LENGTH = 4294967295, MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1, HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;
		/** Used to associate wrap methods with their bit flags. */
		var wrapFlags = [
			["ary", WRAP_ARY_FLAG],
			["bind", WRAP_BIND_FLAG],
			["bindKey", WRAP_BIND_KEY_FLAG],
			["curry", WRAP_CURRY_FLAG],
			["curryRight", WRAP_CURRY_RIGHT_FLAG],
			["flip", WRAP_FLIP_FLAG],
			["partial", WRAP_PARTIAL_FLAG],
			["partialRight", WRAP_PARTIAL_RIGHT_FLAG],
			["rearg", WRAP_REARG_FLAG]
		];
		/** `Object#toString` result references. */
		var argsTag = "[object Arguments]", arrayTag = "[object Array]", asyncTag = "[object AsyncFunction]", boolTag = "[object Boolean]", dateTag = "[object Date]", domExcTag = "[object DOMException]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", nullTag = "[object Null]", objectTag = "[object Object]", promiseTag = "[object Promise]", proxyTag = "[object Proxy]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", undefinedTag = "[object Undefined]", weakMapTag = "[object WeakMap]", weakSetTag = "[object WeakSet]";
		var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
		/** Used to match empty string literals in compiled template source. */
		var reEmptyStringLeading = /\b__p \+= '';/g, reEmptyStringMiddle = /\b(__p \+=) '' \+/g, reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;
		/** Used to match HTML entities and HTML characters. */
		var reEscapedHtml = /&(?:amp|lt|gt|quot|#39);/g, reUnescapedHtml = /[&<>"']/g, reHasEscapedHtml = RegExp(reEscapedHtml.source), reHasUnescapedHtml = RegExp(reUnescapedHtml.source);
		/** Used to match template delimiters. */
		var reEscape = /<%-([\s\S]+?)%>/g, reEvaluate = /<%([\s\S]+?)%>/g, reInterpolate = /<%=([\s\S]+?)%>/g;
		/** Used to match property names within property paths. */
		var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/, rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
		/**
		* Used to match `RegExp`
		* [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
		*/
		var reRegExpChar = /[\\^$.*+?()[\]{}|]/g, reHasRegExpChar = RegExp(reRegExpChar.source);
		/** Used to match leading whitespace. */
		var reTrimStart = /^\s+/;
		/** Used to match a single whitespace character. */
		var reWhitespace = /\s/;
		/** Used to match wrap detail comments. */
		var reWrapComment = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/, reWrapDetails = /\{\n\/\* \[wrapped with (.+)\] \*/, reSplitDetails = /,? & /;
		/** Used to match words composed of alphanumeric characters. */
		var reAsciiWord = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g;
		/**
		* Used to validate the `validate` option in `_.template` variable.
		*
		* Forbids characters which could potentially change the meaning of the function argument definition:
		* - "()," (modification of function parameters)
		* - "=" (default value)
		* - "[]{}" (destructuring of function parameters)
		* - "/" (beginning of a comment)
		* - whitespace
		*/
		var reForbiddenIdentifierChars = /[()=,{}\[\]\/\s]/;
		/** Used to match backslashes in property paths. */
		var reEscapeChar = /\\(\\)?/g;
		/**
		* Used to match
		* [ES template delimiters](http://ecma-international.org/ecma-262/7.0/#sec-template-literal-lexical-components).
		*/
		var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
		/** Used to match `RegExp` flags from their coerced string values. */
		var reFlags = /\w*$/;
		/** Used to detect bad signed hexadecimal string values. */
		var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
		/** Used to detect binary string values. */
		var reIsBinary = /^0b[01]+$/i;
		/** Used to detect host constructors (Safari). */
		var reIsHostCtor = /^\[object .+?Constructor\]$/;
		/** Used to detect octal string values. */
		var reIsOctal = /^0o[0-7]+$/i;
		/** Used to detect unsigned integer values. */
		var reIsUint = /^(?:0|[1-9]\d*)$/;
		/** Used to match Latin Unicode letters (excluding mathematical operators). */
		var reLatin = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g;
		/** Used to ensure capturing order of template delimiters. */
		var reNoMatch = /($^)/;
		/** Used to match unescaped characters in compiled string literals. */
		var reUnescapedString = /['\n\r\u2028\u2029\\]/g;
		/** Used to compose unicode character classes. */
		var rsAstralRange = "\\ud800-\\udfff", rsComboRange = "\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff", rsDingbatRange = "\\u2700-\\u27bf", rsLowerRange = "a-z\\xdf-\\xf6\\xf8-\\xff", rsMathOpRange = "\\xac\\xb1\\xd7\\xf7", rsNonCharRange = "\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf", rsPunctuationRange = "\\u2000-\\u206f", rsSpaceRange = " \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000", rsUpperRange = "A-Z\\xc0-\\xd6\\xd8-\\xde", rsVarRange = "\\ufe0e\\ufe0f", rsBreakRange = rsMathOpRange + rsNonCharRange + rsPunctuationRange + rsSpaceRange;
		/** Used to compose unicode capture groups. */
		var rsApos = "['’]", rsAstral = "[" + rsAstralRange + "]", rsBreak = "[" + rsBreakRange + "]", rsCombo = "[" + rsComboRange + "]", rsDigits = "\\d+", rsDingbat = "[" + rsDingbatRange + "]", rsLower = "[" + rsLowerRange + "]", rsMisc = "[^" + rsAstralRange + rsBreakRange + rsDigits + rsDingbatRange + rsLowerRange + rsUpperRange + "]", rsFitz = "\\ud83c[\\udffb-\\udfff]", rsModifier = "(?:" + rsCombo + "|" + rsFitz + ")", rsNonAstral = "[^" + rsAstralRange + "]", rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}", rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]", rsUpper = "[" + rsUpperRange + "]", rsZWJ = "\\u200d";
		/** Used to compose unicode regexes. */
		var rsMiscLower = "(?:" + rsLower + "|" + rsMisc + ")", rsMiscUpper = "(?:" + rsUpper + "|" + rsMisc + ")", rsOptContrLower = "(?:" + rsApos + "(?:d|ll|m|re|s|t|ve))?", rsOptContrUpper = "(?:" + rsApos + "(?:D|LL|M|RE|S|T|VE))?", reOptMod = rsModifier + "?", rsOptVar = "[" + rsVarRange + "]?", rsOptJoin = "(?:" + rsZWJ + "(?:" + [
			rsNonAstral,
			rsRegional,
			rsSurrPair
		].join("|") + ")" + rsOptVar + reOptMod + ")*", rsOrdLower = "\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])", rsOrdUpper = "\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])", rsSeq = rsOptVar + reOptMod + rsOptJoin, rsEmoji = "(?:" + [
			rsDingbat,
			rsRegional,
			rsSurrPair
		].join("|") + ")" + rsSeq, rsSymbol = "(?:" + [
			rsNonAstral + rsCombo + "?",
			rsCombo,
			rsRegional,
			rsSurrPair,
			rsAstral
		].join("|") + ")";
		/** Used to match apostrophes. */
		var reApos = RegExp(rsApos, "g");
		/**
		* Used to match [combining diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks) and
		* [combining diacritical marks for symbols](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks_for_Symbols).
		*/
		var reComboMark = RegExp(rsCombo, "g");
		/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
		var reUnicode = RegExp(rsFitz + "(?=" + rsFitz + ")|" + rsSymbol + rsSeq, "g");
		/** Used to match complex or compound words. */
		var reUnicodeWord = RegExp([
			rsUpper + "?" + rsLower + "+" + rsOptContrLower + "(?=" + [
				rsBreak,
				rsUpper,
				"$"
			].join("|") + ")",
			rsMiscUpper + "+" + rsOptContrUpper + "(?=" + [
				rsBreak,
				rsUpper + rsMiscLower,
				"$"
			].join("|") + ")",
			rsUpper + "?" + rsMiscLower + "+" + rsOptContrLower,
			rsUpper + "+" + rsOptContrUpper,
			rsOrdUpper,
			rsOrdLower,
			rsDigits,
			rsEmoji
		].join("|"), "g");
		/** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */
		var reHasUnicode = RegExp("[" + rsZWJ + rsAstralRange + rsComboRange + rsVarRange + "]");
		/** Used to detect strings that need a more robust regexp to match words. */
		var reHasUnicodeWord = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/;
		/** Used to assign default `context` object properties. */
		var contextProps = [
			"Array",
			"Buffer",
			"DataView",
			"Date",
			"Error",
			"Float32Array",
			"Float64Array",
			"Function",
			"Int8Array",
			"Int16Array",
			"Int32Array",
			"Map",
			"Math",
			"Object",
			"Promise",
			"RegExp",
			"Set",
			"String",
			"Symbol",
			"TypeError",
			"Uint8Array",
			"Uint8ClampedArray",
			"Uint16Array",
			"Uint32Array",
			"WeakMap",
			"_",
			"clearTimeout",
			"isFinite",
			"parseInt",
			"setTimeout"
		];
		/** Used to make template sourceURLs easier to identify. */
		var templateCounter = -1;
		/** Used to identify `toStringTag` values of typed arrays. */
		var typedArrayTags = {};
		typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
		typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
		/** Used to identify `toStringTag` values supported by `_.clone`. */
		var cloneableTags = {};
		cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[setTag] = cloneableTags[stringTag] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
		cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
		/** Used to map Latin Unicode letters to basic Latin letters. */
		var deburredLetters = {
			"À": "A",
			"Á": "A",
			"Â": "A",
			"Ã": "A",
			"Ä": "A",
			"Å": "A",
			"à": "a",
			"á": "a",
			"â": "a",
			"ã": "a",
			"ä": "a",
			"å": "a",
			"Ç": "C",
			"ç": "c",
			"Ð": "D",
			"ð": "d",
			"È": "E",
			"É": "E",
			"Ê": "E",
			"Ë": "E",
			"è": "e",
			"é": "e",
			"ê": "e",
			"ë": "e",
			"Ì": "I",
			"Í": "I",
			"Î": "I",
			"Ï": "I",
			"ì": "i",
			"í": "i",
			"î": "i",
			"ï": "i",
			"Ñ": "N",
			"ñ": "n",
			"Ò": "O",
			"Ó": "O",
			"Ô": "O",
			"Õ": "O",
			"Ö": "O",
			"Ø": "O",
			"ò": "o",
			"ó": "o",
			"ô": "o",
			"õ": "o",
			"ö": "o",
			"ø": "o",
			"Ù": "U",
			"Ú": "U",
			"Û": "U",
			"Ü": "U",
			"ù": "u",
			"ú": "u",
			"û": "u",
			"ü": "u",
			"Ý": "Y",
			"ý": "y",
			"ÿ": "y",
			"Æ": "Ae",
			"æ": "ae",
			"Þ": "Th",
			"þ": "th",
			"ß": "ss",
			"Ā": "A",
			"Ă": "A",
			"Ą": "A",
			"ā": "a",
			"ă": "a",
			"ą": "a",
			"Ć": "C",
			"Ĉ": "C",
			"Ċ": "C",
			"Č": "C",
			"ć": "c",
			"ĉ": "c",
			"ċ": "c",
			"č": "c",
			"Ď": "D",
			"Đ": "D",
			"ď": "d",
			"đ": "d",
			"Ē": "E",
			"Ĕ": "E",
			"Ė": "E",
			"Ę": "E",
			"Ě": "E",
			"ē": "e",
			"ĕ": "e",
			"ė": "e",
			"ę": "e",
			"ě": "e",
			"Ĝ": "G",
			"Ğ": "G",
			"Ġ": "G",
			"Ģ": "G",
			"ĝ": "g",
			"ğ": "g",
			"ġ": "g",
			"ģ": "g",
			"Ĥ": "H",
			"Ħ": "H",
			"ĥ": "h",
			"ħ": "h",
			"Ĩ": "I",
			"Ī": "I",
			"Ĭ": "I",
			"Į": "I",
			"İ": "I",
			"ĩ": "i",
			"ī": "i",
			"ĭ": "i",
			"į": "i",
			"ı": "i",
			"Ĵ": "J",
			"ĵ": "j",
			"Ķ": "K",
			"ķ": "k",
			"ĸ": "k",
			"Ĺ": "L",
			"Ļ": "L",
			"Ľ": "L",
			"Ŀ": "L",
			"Ł": "L",
			"ĺ": "l",
			"ļ": "l",
			"ľ": "l",
			"ŀ": "l",
			"ł": "l",
			"Ń": "N",
			"Ņ": "N",
			"Ň": "N",
			"Ŋ": "N",
			"ń": "n",
			"ņ": "n",
			"ň": "n",
			"ŋ": "n",
			"Ō": "O",
			"Ŏ": "O",
			"Ő": "O",
			"ō": "o",
			"ŏ": "o",
			"ő": "o",
			"Ŕ": "R",
			"Ŗ": "R",
			"Ř": "R",
			"ŕ": "r",
			"ŗ": "r",
			"ř": "r",
			"Ś": "S",
			"Ŝ": "S",
			"Ş": "S",
			"Š": "S",
			"ś": "s",
			"ŝ": "s",
			"ş": "s",
			"š": "s",
			"Ţ": "T",
			"Ť": "T",
			"Ŧ": "T",
			"ţ": "t",
			"ť": "t",
			"ŧ": "t",
			"Ũ": "U",
			"Ū": "U",
			"Ŭ": "U",
			"Ů": "U",
			"Ű": "U",
			"Ų": "U",
			"ũ": "u",
			"ū": "u",
			"ŭ": "u",
			"ů": "u",
			"ű": "u",
			"ų": "u",
			"Ŵ": "W",
			"ŵ": "w",
			"Ŷ": "Y",
			"ŷ": "y",
			"Ÿ": "Y",
			"Ź": "Z",
			"Ż": "Z",
			"Ž": "Z",
			"ź": "z",
			"ż": "z",
			"ž": "z",
			"Ĳ": "IJ",
			"ĳ": "ij",
			"Œ": "Oe",
			"œ": "oe",
			"ŉ": "'n",
			"ſ": "s"
		};
		/** Used to map characters to HTML entities. */
		var htmlEscapes = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#39;"
		};
		/** Used to map HTML entities to characters. */
		var htmlUnescapes = {
			"&amp;": "&",
			"&lt;": "<",
			"&gt;": ">",
			"&quot;": "\"",
			"&#39;": "'"
		};
		/** Used to escape characters for inclusion in compiled string literals. */
		var stringEscapes = {
			"\\": "\\",
			"'": "'",
			"\n": "n",
			"\r": "r",
			"\u2028": "u2028",
			"\u2029": "u2029"
		};
		/** Built-in method references without a dependency on `root`. */
		var freeParseFloat = parseFloat, freeParseInt = parseInt;
		/** Detect free variable `global` from Node.js. */
		var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
		/** Detect free variable `self`. */
		var freeSelf = typeof self == "object" && self && self.Object === Object && self;
		/** Used as a reference to the global object. */
		var root = freeGlobal || freeSelf || Function("return this")();
		/** Detect free variable `exports`. */
		var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
		/** Detect free variable `module`. */
		var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
		/** Detect the popular CommonJS extension `module.exports`. */
		var moduleExports = freeModule && freeModule.exports === freeExports;
		/** Detect free variable `process` from Node.js. */
		var freeProcess = moduleExports && freeGlobal.process;
		/** Used to access faster Node.js helpers. */
		var nodeUtil = function() {
			try {
				var types = freeModule && freeModule.require && freeModule.require("util").types;
				if (types) return types;
				return freeProcess && freeProcess.binding && freeProcess.binding("util");
			} catch (e) {}
		}();
		var nodeIsArrayBuffer = nodeUtil && nodeUtil.isArrayBuffer, nodeIsDate = nodeUtil && nodeUtil.isDate, nodeIsMap = nodeUtil && nodeUtil.isMap, nodeIsRegExp = nodeUtil && nodeUtil.isRegExp, nodeIsSet = nodeUtil && nodeUtil.isSet, nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
		/**
		* A faster alternative to `Function#apply`, this function invokes `func`
		* with the `this` binding of `thisArg` and the arguments of `args`.
		*
		* @private
		* @param {Function} func The function to invoke.
		* @param {*} thisArg The `this` binding of `func`.
		* @param {Array} args The arguments to invoke `func` with.
		* @returns {*} Returns the result of `func`.
		*/
		function apply(func, thisArg, args) {
			switch (args.length) {
				case 0: return func.call(thisArg);
				case 1: return func.call(thisArg, args[0]);
				case 2: return func.call(thisArg, args[0], args[1]);
				case 3: return func.call(thisArg, args[0], args[1], args[2]);
			}
			return func.apply(thisArg, args);
		}
		/**
		* A specialized version of `baseAggregator` for arrays.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} setter The function to set `accumulator` values.
		* @param {Function} iteratee The iteratee to transform keys.
		* @param {Object} accumulator The initial aggregated object.
		* @returns {Function} Returns `accumulator`.
		*/
		function arrayAggregator(array, setter, iteratee, accumulator) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) {
				var value = array[index];
				setter(accumulator, value, iteratee(value), array);
			}
			return accumulator;
		}
		/**
		* A specialized version of `_.forEach` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {Array} Returns `array`.
		*/
		function arrayEach(array, iteratee) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) if (iteratee(array[index], index, array) === false) break;
			return array;
		}
		/**
		* A specialized version of `_.forEachRight` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {Array} Returns `array`.
		*/
		function arrayEachRight(array, iteratee) {
			var length = array == null ? 0 : array.length;
			while (length--) if (iteratee(array[length], length, array) === false) break;
			return array;
		}
		/**
		* A specialized version of `_.every` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} predicate The function invoked per iteration.
		* @returns {boolean} Returns `true` if all elements pass the predicate check,
		*  else `false`.
		*/
		function arrayEvery(array, predicate) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) if (!predicate(array[index], index, array)) return false;
			return true;
		}
		/**
		* A specialized version of `_.filter` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} predicate The function invoked per iteration.
		* @returns {Array} Returns the new filtered array.
		*/
		function arrayFilter(array, predicate) {
			var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
			while (++index < length) {
				var value = array[index];
				if (predicate(value, index, array)) result[resIndex++] = value;
			}
			return result;
		}
		/**
		* A specialized version of `_.includes` for arrays without support for
		* specifying an index to search from.
		*
		* @private
		* @param {Array} [array] The array to inspect.
		* @param {*} target The value to search for.
		* @returns {boolean} Returns `true` if `target` is found, else `false`.
		*/
		function arrayIncludes(array, value) {
			return !!(array == null ? 0 : array.length) && baseIndexOf(array, value, 0) > -1;
		}
		/**
		* This function is like `arrayIncludes` except that it accepts a comparator.
		*
		* @private
		* @param {Array} [array] The array to inspect.
		* @param {*} target The value to search for.
		* @param {Function} comparator The comparator invoked per element.
		* @returns {boolean} Returns `true` if `target` is found, else `false`.
		*/
		function arrayIncludesWith(array, value, comparator) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) if (comparator(value, array[index])) return true;
			return false;
		}
		/**
		* A specialized version of `_.map` for arrays without support for iteratee
		* shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {Array} Returns the new mapped array.
		*/
		function arrayMap(array, iteratee) {
			var index = -1, length = array == null ? 0 : array.length, result = Array(length);
			while (++index < length) result[index] = iteratee(array[index], index, array);
			return result;
		}
		/**
		* Appends the elements of `values` to `array`.
		*
		* @private
		* @param {Array} array The array to modify.
		* @param {Array} values The values to append.
		* @returns {Array} Returns `array`.
		*/
		function arrayPush(array, values) {
			var index = -1, length = values.length, offset = array.length;
			while (++index < length) array[offset + index] = values[index];
			return array;
		}
		/**
		* A specialized version of `_.reduce` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @param {*} [accumulator] The initial value.
		* @param {boolean} [initAccum] Specify using the first element of `array` as
		*  the initial value.
		* @returns {*} Returns the accumulated value.
		*/
		function arrayReduce(array, iteratee, accumulator, initAccum) {
			var index = -1, length = array == null ? 0 : array.length;
			if (initAccum && length) accumulator = array[++index];
			while (++index < length) accumulator = iteratee(accumulator, array[index], index, array);
			return accumulator;
		}
		/**
		* A specialized version of `_.reduceRight` for arrays without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @param {*} [accumulator] The initial value.
		* @param {boolean} [initAccum] Specify using the last element of `array` as
		*  the initial value.
		* @returns {*} Returns the accumulated value.
		*/
		function arrayReduceRight(array, iteratee, accumulator, initAccum) {
			var length = array == null ? 0 : array.length;
			if (initAccum && length) accumulator = array[--length];
			while (length--) accumulator = iteratee(accumulator, array[length], length, array);
			return accumulator;
		}
		/**
		* A specialized version of `_.some` for arrays without support for iteratee
		* shorthands.
		*
		* @private
		* @param {Array} [array] The array to iterate over.
		* @param {Function} predicate The function invoked per iteration.
		* @returns {boolean} Returns `true` if any element passes the predicate check,
		*  else `false`.
		*/
		function arraySome(array, predicate) {
			var index = -1, length = array == null ? 0 : array.length;
			while (++index < length) if (predicate(array[index], index, array)) return true;
			return false;
		}
		/**
		* Gets the size of an ASCII `string`.
		*
		* @private
		* @param {string} string The string inspect.
		* @returns {number} Returns the string size.
		*/
		var asciiSize = baseProperty("length");
		/**
		* Converts an ASCII `string` to an array.
		*
		* @private
		* @param {string} string The string to convert.
		* @returns {Array} Returns the converted array.
		*/
		function asciiToArray(string) {
			return string.split("");
		}
		/**
		* Splits an ASCII `string` into an array of its words.
		*
		* @private
		* @param {string} The string to inspect.
		* @returns {Array} Returns the words of `string`.
		*/
		function asciiWords(string) {
			return string.match(reAsciiWord) || [];
		}
		/**
		* The base implementation of methods like `_.findKey` and `_.findLastKey`,
		* without support for iteratee shorthands, which iterates over `collection`
		* using `eachFunc`.
		*
		* @private
		* @param {Array|Object} collection The collection to inspect.
		* @param {Function} predicate The function invoked per iteration.
		* @param {Function} eachFunc The function to iterate over `collection`.
		* @returns {*} Returns the found element or its key, else `undefined`.
		*/
		function baseFindKey(collection, predicate, eachFunc) {
			var result;
			eachFunc(collection, function(value, key, collection) {
				if (predicate(value, key, collection)) {
					result = key;
					return false;
				}
			});
			return result;
		}
		/**
		* The base implementation of `_.findIndex` and `_.findLastIndex` without
		* support for iteratee shorthands.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {Function} predicate The function invoked per iteration.
		* @param {number} fromIndex The index to search from.
		* @param {boolean} [fromRight] Specify iterating from right to left.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function baseFindIndex(array, predicate, fromIndex, fromRight) {
			var length = array.length, index = fromIndex + (fromRight ? 1 : -1);
			while (fromRight ? index-- : ++index < length) if (predicate(array[index], index, array)) return index;
			return -1;
		}
		/**
		* The base implementation of `_.indexOf` without `fromIndex` bounds checks.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} value The value to search for.
		* @param {number} fromIndex The index to search from.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function baseIndexOf(array, value, fromIndex) {
			return value === value ? strictIndexOf(array, value, fromIndex) : baseFindIndex(array, baseIsNaN, fromIndex);
		}
		/**
		* This function is like `baseIndexOf` except that it accepts a comparator.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} value The value to search for.
		* @param {number} fromIndex The index to search from.
		* @param {Function} comparator The comparator invoked per element.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function baseIndexOfWith(array, value, fromIndex, comparator) {
			var index = fromIndex - 1, length = array.length;
			while (++index < length) if (comparator(array[index], value)) return index;
			return -1;
		}
		/**
		* The base implementation of `_.isNaN` without support for number objects.
		*
		* @private
		* @param {*} value The value to check.
		* @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
		*/
		function baseIsNaN(value) {
			return value !== value;
		}
		/**
		* The base implementation of `_.mean` and `_.meanBy` without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} array The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {number} Returns the mean.
		*/
		function baseMean(array, iteratee) {
			var length = array == null ? 0 : array.length;
			return length ? baseSum(array, iteratee) / length : NAN;
		}
		/**
		* The base implementation of `_.property` without support for deep paths.
		*
		* @private
		* @param {string} key The key of the property to get.
		* @returns {Function} Returns the new accessor function.
		*/
		function baseProperty(key) {
			return function(object) {
				return object == null ? undefined : object[key];
			};
		}
		/**
		* The base implementation of `_.propertyOf` without support for deep paths.
		*
		* @private
		* @param {Object} object The object to query.
		* @returns {Function} Returns the new accessor function.
		*/
		function basePropertyOf(object) {
			return function(key) {
				return object == null ? undefined : object[key];
			};
		}
		/**
		* The base implementation of `_.reduce` and `_.reduceRight`, without support
		* for iteratee shorthands, which iterates over `collection` using `eachFunc`.
		*
		* @private
		* @param {Array|Object} collection The collection to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @param {*} accumulator The initial value.
		* @param {boolean} initAccum Specify using the first or last element of
		*  `collection` as the initial value.
		* @param {Function} eachFunc The function to iterate over `collection`.
		* @returns {*} Returns the accumulated value.
		*/
		function baseReduce(collection, iteratee, accumulator, initAccum, eachFunc) {
			eachFunc(collection, function(value, index, collection) {
				accumulator = initAccum ? (initAccum = false, value) : iteratee(accumulator, value, index, collection);
			});
			return accumulator;
		}
		/**
		* The base implementation of `_.sortBy` which uses `comparer` to define the
		* sort order of `array` and replaces criteria objects with their corresponding
		* values.
		*
		* @private
		* @param {Array} array The array to sort.
		* @param {Function} comparer The function to define sort order.
		* @returns {Array} Returns `array`.
		*/
		function baseSortBy(array, comparer) {
			var length = array.length;
			array.sort(comparer);
			while (length--) array[length] = array[length].value;
			return array;
		}
		/**
		* The base implementation of `_.sum` and `_.sumBy` without support for
		* iteratee shorthands.
		*
		* @private
		* @param {Array} array The array to iterate over.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {number} Returns the sum.
		*/
		function baseSum(array, iteratee) {
			var result, index = -1, length = array.length;
			while (++index < length) {
				var current = iteratee(array[index]);
				if (current !== undefined) result = result === undefined ? current : result + current;
			}
			return result;
		}
		/**
		* The base implementation of `_.times` without support for iteratee shorthands
		* or max array length checks.
		*
		* @private
		* @param {number} n The number of times to invoke `iteratee`.
		* @param {Function} iteratee The function invoked per iteration.
		* @returns {Array} Returns the array of results.
		*/
		function baseTimes(n, iteratee) {
			var index = -1, result = Array(n);
			while (++index < n) result[index] = iteratee(index);
			return result;
		}
		/**
		* The base implementation of `_.toPairs` and `_.toPairsIn` which creates an array
		* of key-value pairs for `object` corresponding to the property names of `props`.
		*
		* @private
		* @param {Object} object The object to query.
		* @param {Array} props The property names to get values for.
		* @returns {Object} Returns the key-value pairs.
		*/
		function baseToPairs(object, props) {
			return arrayMap(props, function(key) {
				return [key, object[key]];
			});
		}
		/**
		* The base implementation of `_.trim`.
		*
		* @private
		* @param {string} string The string to trim.
		* @returns {string} Returns the trimmed string.
		*/
		function baseTrim(string) {
			return string ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, "") : string;
		}
		/**
		* The base implementation of `_.unary` without support for storing metadata.
		*
		* @private
		* @param {Function} func The function to cap arguments for.
		* @returns {Function} Returns the new capped function.
		*/
		function baseUnary(func) {
			return function(value) {
				return func(value);
			};
		}
		/**
		* The base implementation of `_.values` and `_.valuesIn` which creates an
		* array of `object` property values corresponding to the property names
		* of `props`.
		*
		* @private
		* @param {Object} object The object to query.
		* @param {Array} props The property names to get values for.
		* @returns {Object} Returns the array of property values.
		*/
		function baseValues(object, props) {
			return arrayMap(props, function(key) {
				return object[key];
			});
		}
		/**
		* Checks if a `cache` value for `key` exists.
		*
		* @private
		* @param {Object} cache The cache to query.
		* @param {string} key The key of the entry to check.
		* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
		*/
		function cacheHas(cache, key) {
			return cache.has(key);
		}
		/**
		* Used by `_.trim` and `_.trimStart` to get the index of the first string symbol
		* that is not found in the character symbols.
		*
		* @private
		* @param {Array} strSymbols The string symbols to inspect.
		* @param {Array} chrSymbols The character symbols to find.
		* @returns {number} Returns the index of the first unmatched string symbol.
		*/
		function charsStartIndex(strSymbols, chrSymbols) {
			var index = -1, length = strSymbols.length;
			while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1);
			return index;
		}
		/**
		* Used by `_.trim` and `_.trimEnd` to get the index of the last string symbol
		* that is not found in the character symbols.
		*
		* @private
		* @param {Array} strSymbols The string symbols to inspect.
		* @param {Array} chrSymbols The character symbols to find.
		* @returns {number} Returns the index of the last unmatched string symbol.
		*/
		function charsEndIndex(strSymbols, chrSymbols) {
			var index = strSymbols.length;
			while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1);
			return index;
		}
		/**
		* Gets the number of `placeholder` occurrences in `array`.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} placeholder The placeholder to search for.
		* @returns {number} Returns the placeholder count.
		*/
		function countHolders(array, placeholder) {
			var length = array.length, result = 0;
			while (length--) if (array[length] === placeholder) ++result;
			return result;
		}
		/**
		* Used by `_.deburr` to convert Latin-1 Supplement and Latin Extended-A
		* letters to basic Latin letters.
		*
		* @private
		* @param {string} letter The matched letter to deburr.
		* @returns {string} Returns the deburred letter.
		*/
		var deburrLetter = basePropertyOf(deburredLetters);
		/**
		* Used by `_.escape` to convert characters to HTML entities.
		*
		* @private
		* @param {string} chr The matched character to escape.
		* @returns {string} Returns the escaped character.
		*/
		var escapeHtmlChar = basePropertyOf(htmlEscapes);
		/**
		* Used by `_.template` to escape characters for inclusion in compiled string literals.
		*
		* @private
		* @param {string} chr The matched character to escape.
		* @returns {string} Returns the escaped character.
		*/
		function escapeStringChar(chr) {
			return "\\" + stringEscapes[chr];
		}
		/**
		* Gets the value at `key` of `object`.
		*
		* @private
		* @param {Object} [object] The object to query.
		* @param {string} key The key of the property to get.
		* @returns {*} Returns the property value.
		*/
		function getValue(object, key) {
			return object == null ? undefined : object[key];
		}
		/**
		* Checks if `string` contains Unicode symbols.
		*
		* @private
		* @param {string} string The string to inspect.
		* @returns {boolean} Returns `true` if a symbol is found, else `false`.
		*/
		function hasUnicode(string) {
			return reHasUnicode.test(string);
		}
		/**
		* Checks if `string` contains a word composed of Unicode symbols.
		*
		* @private
		* @param {string} string The string to inspect.
		* @returns {boolean} Returns `true` if a word is found, else `false`.
		*/
		function hasUnicodeWord(string) {
			return reHasUnicodeWord.test(string);
		}
		/**
		* Converts `iterator` to an array.
		*
		* @private
		* @param {Object} iterator The iterator to convert.
		* @returns {Array} Returns the converted array.
		*/
		function iteratorToArray(iterator) {
			var data, result = [];
			while (!(data = iterator.next()).done) result.push(data.value);
			return result;
		}
		/**
		* Converts `map` to its key-value pairs.
		*
		* @private
		* @param {Object} map The map to convert.
		* @returns {Array} Returns the key-value pairs.
		*/
		function mapToArray(map) {
			var index = -1, result = Array(map.size);
			map.forEach(function(value, key) {
				result[++index] = [key, value];
			});
			return result;
		}
		/**
		* Creates a unary function that invokes `func` with its argument transformed.
		*
		* @private
		* @param {Function} func The function to wrap.
		* @param {Function} transform The argument transform.
		* @returns {Function} Returns the new function.
		*/
		function overArg(func, transform) {
			return function(arg) {
				return func(transform(arg));
			};
		}
		/**
		* Replaces all `placeholder` elements in `array` with an internal placeholder
		* and returns an array of their indexes.
		*
		* @private
		* @param {Array} array The array to modify.
		* @param {*} placeholder The placeholder to replace.
		* @returns {Array} Returns the new array of placeholder indexes.
		*/
		function replaceHolders(array, placeholder) {
			var index = -1, length = array.length, resIndex = 0, result = [];
			while (++index < length) {
				var value = array[index];
				if (value === placeholder || value === PLACEHOLDER) {
					array[index] = PLACEHOLDER;
					result[resIndex++] = index;
				}
			}
			return result;
		}
		/**
		* Converts `set` to an array of its values.
		*
		* @private
		* @param {Object} set The set to convert.
		* @returns {Array} Returns the values.
		*/
		function setToArray(set) {
			var index = -1, result = Array(set.size);
			set.forEach(function(value) {
				result[++index] = value;
			});
			return result;
		}
		/**
		* Converts `set` to its value-value pairs.
		*
		* @private
		* @param {Object} set The set to convert.
		* @returns {Array} Returns the value-value pairs.
		*/
		function setToPairs(set) {
			var index = -1, result = Array(set.size);
			set.forEach(function(value) {
				result[++index] = [value, value];
			});
			return result;
		}
		/**
		* A specialized version of `_.indexOf` which performs strict equality
		* comparisons of values, i.e. `===`.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} value The value to search for.
		* @param {number} fromIndex The index to search from.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function strictIndexOf(array, value, fromIndex) {
			var index = fromIndex - 1, length = array.length;
			while (++index < length) if (array[index] === value) return index;
			return -1;
		}
		/**
		* A specialized version of `_.lastIndexOf` which performs strict equality
		* comparisons of values, i.e. `===`.
		*
		* @private
		* @param {Array} array The array to inspect.
		* @param {*} value The value to search for.
		* @param {number} fromIndex The index to search from.
		* @returns {number} Returns the index of the matched value, else `-1`.
		*/
		function strictLastIndexOf(array, value, fromIndex) {
			var index = fromIndex + 1;
			while (index--) if (array[index] === value) return index;
			return index;
		}
		/**
		* Gets the number of symbols in `string`.
		*
		* @private
		* @param {string} string The string to inspect.
		* @returns {number} Returns the string size.
		*/
		function stringSize(string) {
			return hasUnicode(string) ? unicodeSize(string) : asciiSize(string);
		}
		/**
		* Converts `string` to an array.
		*
		* @private
		* @param {string} string The string to convert.
		* @returns {Array} Returns the converted array.
		*/
		function stringToArray(string) {
			return hasUnicode(string) ? unicodeToArray(string) : asciiToArray(string);
		}
		/**
		* Used by `_.trim` and `_.trimEnd` to get the index of the last non-whitespace
		* character of `string`.
		*
		* @private
		* @param {string} string The string to inspect.
		* @returns {number} Returns the index of the last non-whitespace character.
		*/
		function trimmedEndIndex(string) {
			var index = string.length;
			while (index-- && reWhitespace.test(string.charAt(index)));
			return index;
		}
		/**
		* Used by `_.unescape` to convert HTML entities to characters.
		*
		* @private
		* @param {string} chr The matched character to unescape.
		* @returns {string} Returns the unescaped character.
		*/
		var unescapeHtmlChar = basePropertyOf(htmlUnescapes);
		/**
		* Gets the size of a Unicode `string`.
		*
		* @private
		* @param {string} string The string inspect.
		* @returns {number} Returns the string size.
		*/
		function unicodeSize(string) {
			var result = reUnicode.lastIndex = 0;
			while (reUnicode.test(string)) ++result;
			return result;
		}
		/**
		* Converts a Unicode `string` to an array.
		*
		* @private
		* @param {string} string The string to convert.
		* @returns {Array} Returns the converted array.
		*/
		function unicodeToArray(string) {
			return string.match(reUnicode) || [];
		}
		/**
		* Splits a Unicode `string` into an array of its words.
		*
		* @private
		* @param {string} The string to inspect.
		* @returns {Array} Returns the words of `string`.
		*/
		function unicodeWords(string) {
			return string.match(reUnicodeWord) || [];
		}
		var _ = (function runInContext(context) {
			context = context == null ? root : _.defaults(root.Object(), context, _.pick(root, contextProps));
			/** Built-in constructor references. */
			var Array = context.Array, Date = context.Date, Error = context.Error, Function = context.Function, Math = context.Math, Object = context.Object, RegExp = context.RegExp, String = context.String, TypeError = context.TypeError;
			/** Used for built-in method references. */
			var arrayProto = Array.prototype, funcProto = Function.prototype, objectProto = Object.prototype;
			/** Used to detect overreaching core-js shims. */
			var coreJsData = context["__core-js_shared__"];
			/** Used to resolve the decompiled source of functions. */
			var funcToString = funcProto.toString;
			/** Used to check objects for own properties. */
			var hasOwnProperty = objectProto.hasOwnProperty;
			/** Used to generate unique IDs. */
			var idCounter = 0;
			/** Used to detect methods masquerading as native. */
			var maskSrcKey = function() {
				var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
				return uid ? "Symbol(src)_1." + uid : "";
			}();
			/**
			* Used to resolve the
			* [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
			* of values.
			*/
			var nativeObjectToString = objectProto.toString;
			/** Used to infer the `Object` constructor. */
			var objectCtorString = funcToString.call(Object);
			/** Used to restore the original `_` reference in `_.noConflict`. */
			var oldDash = root._;
			/** Used to detect if a method is native. */
			var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
			/** Built-in value references. */
			var Buffer = moduleExports ? context.Buffer : undefined, Symbol = context.Symbol, Uint8Array = context.Uint8Array, allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined, getPrototype = overArg(Object.getPrototypeOf, Object), objectCreate = Object.create, propertyIsEnumerable = objectProto.propertyIsEnumerable, splice = arrayProto.splice, spreadableSymbol = Symbol ? Symbol.isConcatSpreadable : undefined, symIterator = Symbol ? Symbol.iterator : undefined, symToStringTag = Symbol ? Symbol.toStringTag : undefined;
			var defineProperty = function() {
				try {
					var func = getNative(Object, "defineProperty");
					func({}, "", {});
					return func;
				} catch (e) {}
			}();
			/** Mocked built-ins. */
			var ctxClearTimeout = context.clearTimeout !== root.clearTimeout && context.clearTimeout, ctxNow = Date && Date.now !== root.Date.now && Date.now, ctxSetTimeout = context.setTimeout !== root.setTimeout && context.setTimeout;
			var nativeCeil = Math.ceil, nativeFloor = Math.floor, nativeGetSymbols = Object.getOwnPropertySymbols, nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined, nativeIsFinite = context.isFinite, nativeJoin = arrayProto.join, nativeKeys = overArg(Object.keys, Object), nativeMax = Math.max, nativeMin = Math.min, nativeNow = Date.now, nativeParseInt = context.parseInt, nativeRandom = Math.random, nativeReverse = arrayProto.reverse;
			var DataView = getNative(context, "DataView"), Map = getNative(context, "Map"), Promise = getNative(context, "Promise"), Set = getNative(context, "Set"), WeakMap = getNative(context, "WeakMap"), nativeCreate = getNative(Object, "create");
			/** Used to store function metadata. */
			var metaMap = WeakMap && new WeakMap();
			/** Used to lookup unminified function names. */
			var realNames = {};
			/** Used to detect maps, sets, and weakmaps. */
			var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map), promiseCtorString = toSource(Promise), setCtorString = toSource(Set), weakMapCtorString = toSource(WeakMap);
			/** Used to convert symbols to primitives and strings. */
			var symbolProto = Symbol ? Symbol.prototype : undefined, symbolValueOf = symbolProto ? symbolProto.valueOf : undefined, symbolToString = symbolProto ? symbolProto.toString : undefined;
			/**
			* Creates a `lodash` object which wraps `value` to enable implicit method
			* chain sequences. Methods that operate on and return arrays, collections,
			* and functions can be chained together. Methods that retrieve a single value
			* or may return a primitive value will automatically end the chain sequence
			* and return the unwrapped value. Otherwise, the value must be unwrapped
			* with `_#value`.
			*
			* Explicit chain sequences, which must be unwrapped with `_#value`, may be
			* enabled using `_.chain`.
			*
			* The execution of chained methods is lazy, that is, it's deferred until
			* `_#value` is implicitly or explicitly called.
			*
			* Lazy evaluation allows several methods to support shortcut fusion.
			* Shortcut fusion is an optimization to merge iteratee calls; this avoids
			* the creation of intermediate arrays and can greatly reduce the number of
			* iteratee executions. Sections of a chain sequence qualify for shortcut
			* fusion if the section is applied to an array and iteratees accept only
			* one argument. The heuristic for whether a section qualifies for shortcut
			* fusion is subject to change.
			*
			* Chaining is supported in custom builds as long as the `_#value` method is
			* directly or indirectly included in the build.
			*
			* In addition to lodash methods, wrappers have `Array` and `String` methods.
			*
			* The wrapper `Array` methods are:
			* `concat`, `join`, `pop`, `push`, `shift`, `sort`, `splice`, and `unshift`
			*
			* The wrapper `String` methods are:
			* `replace` and `split`
			*
			* The wrapper methods that support shortcut fusion are:
			* `at`, `compact`, `drop`, `dropRight`, `dropWhile`, `filter`, `find`,
			* `findLast`, `head`, `initial`, `last`, `map`, `reject`, `reverse`, `slice`,
			* `tail`, `take`, `takeRight`, `takeRightWhile`, `takeWhile`, and `toArray`
			*
			* The chainable wrapper methods are:
			* `after`, `ary`, `assign`, `assignIn`, `assignInWith`, `assignWith`, `at`,
			* `before`, `bind`, `bindAll`, `bindKey`, `castArray`, `chain`, `chunk`,
			* `commit`, `compact`, `concat`, `conforms`, `constant`, `countBy`, `create`,
			* `curry`, `debounce`, `defaults`, `defaultsDeep`, `defer`, `delay`,
			* `difference`, `differenceBy`, `differenceWith`, `drop`, `dropRight`,
			* `dropRightWhile`, `dropWhile`, `extend`, `extendWith`, `fill`, `filter`,
			* `flatMap`, `flatMapDeep`, `flatMapDepth`, `flatten`, `flattenDeep`,
			* `flattenDepth`, `flip`, `flow`, `flowRight`, `fromPairs`, `functions`,
			* `functionsIn`, `groupBy`, `initial`, `intersection`, `intersectionBy`,
			* `intersectionWith`, `invert`, `invertBy`, `invokeMap`, `iteratee`, `keyBy`,
			* `keys`, `keysIn`, `map`, `mapKeys`, `mapValues`, `matches`, `matchesProperty`,
			* `memoize`, `merge`, `mergeWith`, `method`, `methodOf`, `mixin`, `negate`,
			* `nthArg`, `omit`, `omitBy`, `once`, `orderBy`, `over`, `overArgs`,
			* `overEvery`, `overSome`, `partial`, `partialRight`, `partition`, `pick`,
			* `pickBy`, `plant`, `property`, `propertyOf`, `pull`, `pullAll`, `pullAllBy`,
			* `pullAllWith`, `pullAt`, `push`, `range`, `rangeRight`, `rearg`, `reject`,
			* `remove`, `rest`, `reverse`, `sampleSize`, `set`, `setWith`, `shuffle`,
			* `slice`, `sort`, `sortBy`, `splice`, `spread`, `tail`, `take`, `takeRight`,
			* `takeRightWhile`, `takeWhile`, `tap`, `throttle`, `thru`, `toArray`,
			* `toPairs`, `toPairsIn`, `toPath`, `toPlainObject`, `transform`, `unary`,
			* `union`, `unionBy`, `unionWith`, `uniq`, `uniqBy`, `uniqWith`, `unset`,
			* `unshift`, `unzip`, `unzipWith`, `update`, `updateWith`, `values`,
			* `valuesIn`, `without`, `wrap`, `xor`, `xorBy`, `xorWith`, `zip`,
			* `zipObject`, `zipObjectDeep`, and `zipWith`
			*
			* The wrapper methods that are **not** chainable by default are:
			* `add`, `attempt`, `camelCase`, `capitalize`, `ceil`, `clamp`, `clone`,
			* `cloneDeep`, `cloneDeepWith`, `cloneWith`, `conformsTo`, `deburr`,
			* `defaultTo`, `divide`, `each`, `eachRight`, `endsWith`, `eq`, `escape`,
			* `escapeRegExp`, `every`, `find`, `findIndex`, `findKey`, `findLast`,
			* `findLastIndex`, `findLastKey`, `first`, `floor`, `forEach`, `forEachRight`,
			* `forIn`, `forInRight`, `forOwn`, `forOwnRight`, `get`, `gt`, `gte`, `has`,
			* `hasIn`, `head`, `identity`, `includes`, `indexOf`, `inRange`, `invoke`,
			* `isArguments`, `isArray`, `isArrayBuffer`, `isArrayLike`, `isArrayLikeObject`,
			* `isBoolean`, `isBuffer`, `isDate`, `isElement`, `isEmpty`, `isEqual`,
			* `isEqualWith`, `isError`, `isFinite`, `isFunction`, `isInteger`, `isLength`,
			* `isMap`, `isMatch`, `isMatchWith`, `isNaN`, `isNative`, `isNil`, `isNull`,
			* `isNumber`, `isObject`, `isObjectLike`, `isPlainObject`, `isRegExp`,
			* `isSafeInteger`, `isSet`, `isString`, `isUndefined`, `isTypedArray`,
			* `isWeakMap`, `isWeakSet`, `join`, `kebabCase`, `last`, `lastIndexOf`,
			* `lowerCase`, `lowerFirst`, `lt`, `lte`, `max`, `maxBy`, `mean`, `meanBy`,
			* `min`, `minBy`, `multiply`, `noConflict`, `noop`, `now`, `nth`, `pad`,
			* `padEnd`, `padStart`, `parseInt`, `pop`, `random`, `reduce`, `reduceRight`,
			* `repeat`, `result`, `round`, `runInContext`, `sample`, `shift`, `size`,
			* `snakeCase`, `some`, `sortedIndex`, `sortedIndexBy`, `sortedLastIndex`,
			* `sortedLastIndexBy`, `startCase`, `startsWith`, `stubArray`, `stubFalse`,
			* `stubObject`, `stubString`, `stubTrue`, `subtract`, `sum`, `sumBy`,
			* `template`, `times`, `toFinite`, `toInteger`, `toJSON`, `toLength`,
			* `toLower`, `toNumber`, `toSafeInteger`, `toString`, `toUpper`, `trim`,
			* `trimEnd`, `trimStart`, `truncate`, `unescape`, `uniqueId`, `upperCase`,
			* `upperFirst`, `value`, and `words`
			*
			* @name _
			* @constructor
			* @category Seq
			* @param {*} value The value to wrap in a `lodash` instance.
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var wrapped = _([1, 2, 3]);
			*
			* // Returns an unwrapped value.
			* wrapped.reduce(_.add);
			* // => 6
			*
			* // Returns a wrapped value.
			* var squares = wrapped.map(square);
			*
			* _.isArray(squares);
			* // => false
			*
			* _.isArray(squares.value());
			* // => true
			*/
			function lodash(value) {
				if (isObjectLike(value) && !isArray(value) && !(value instanceof LazyWrapper)) {
					if (value instanceof LodashWrapper) return value;
					if (hasOwnProperty.call(value, "__wrapped__")) return wrapperClone(value);
				}
				return new LodashWrapper(value);
			}
			/**
			* The base implementation of `_.create` without support for assigning
			* properties to the created object.
			*
			* @private
			* @param {Object} proto The object to inherit from.
			* @returns {Object} Returns the new object.
			*/
			var baseCreate = function() {
				function object() {}
				return function(proto) {
					if (!isObject(proto)) return {};
					if (objectCreate) return objectCreate(proto);
					object.prototype = proto;
					var result = new object();
					object.prototype = undefined;
					return result;
				};
			}();
			/**
			* The function whose prototype chain sequence wrappers inherit from.
			*
			* @private
			*/
			function baseLodash() {}
			/**
			* The base constructor for creating `lodash` wrapper objects.
			*
			* @private
			* @param {*} value The value to wrap.
			* @param {boolean} [chainAll] Enable explicit method chain sequences.
			*/
			function LodashWrapper(value, chainAll) {
				this.__wrapped__ = value;
				this.__actions__ = [];
				this.__chain__ = !!chainAll;
				this.__index__ = 0;
				this.__values__ = undefined;
			}
			/**
			* By default, the template delimiters used by lodash are like those in
			* embedded Ruby (ERB) as well as ES2015 template strings. Change the
			* following template settings to use alternative delimiters.
			*
			* @static
			* @memberOf _
			* @type {Object}
			*/
			lodash.templateSettings = {
				/**
				* Used to detect `data` property values to be HTML-escaped.
				*
				* @memberOf _.templateSettings
				* @type {RegExp}
				*/
				"escape": reEscape,
				/**
				* Used to detect code to be evaluated.
				*
				* @memberOf _.templateSettings
				* @type {RegExp}
				*/
				"evaluate": reEvaluate,
				/**
				* Used to detect `data` property values to inject.
				*
				* @memberOf _.templateSettings
				* @type {RegExp}
				*/
				"interpolate": reInterpolate,
				/**
				* Used to reference the data object in the template text.
				*
				* @memberOf _.templateSettings
				* @type {string}
				*/
				"variable": "",
				/**
				* Used to import variables into the compiled template.
				*
				* @memberOf _.templateSettings
				* @type {Object}
				*/
				"imports": { 
				/**
				* A reference to the `lodash` function.
				*
				* @memberOf _.templateSettings.imports
				* @type {Function}
				*/
"_": lodash }
			};
			lodash.prototype = baseLodash.prototype;
			lodash.prototype.constructor = lodash;
			LodashWrapper.prototype = baseCreate(baseLodash.prototype);
			LodashWrapper.prototype.constructor = LodashWrapper;
			/**
			* Creates a lazy wrapper object which wraps `value` to enable lazy evaluation.
			*
			* @private
			* @constructor
			* @param {*} value The value to wrap.
			*/
			function LazyWrapper(value) {
				this.__wrapped__ = value;
				this.__actions__ = [];
				this.__dir__ = 1;
				this.__filtered__ = false;
				this.__iteratees__ = [];
				this.__takeCount__ = MAX_ARRAY_LENGTH;
				this.__views__ = [];
			}
			/**
			* Creates a clone of the lazy wrapper object.
			*
			* @private
			* @name clone
			* @memberOf LazyWrapper
			* @returns {Object} Returns the cloned `LazyWrapper` object.
			*/
			function lazyClone() {
				var result = new LazyWrapper(this.__wrapped__);
				result.__actions__ = copyArray(this.__actions__);
				result.__dir__ = this.__dir__;
				result.__filtered__ = this.__filtered__;
				result.__iteratees__ = copyArray(this.__iteratees__);
				result.__takeCount__ = this.__takeCount__;
				result.__views__ = copyArray(this.__views__);
				return result;
			}
			/**
			* Reverses the direction of lazy iteration.
			*
			* @private
			* @name reverse
			* @memberOf LazyWrapper
			* @returns {Object} Returns the new reversed `LazyWrapper` object.
			*/
			function lazyReverse() {
				if (this.__filtered__) {
					var result = new LazyWrapper(this);
					result.__dir__ = -1;
					result.__filtered__ = true;
				} else {
					result = this.clone();
					result.__dir__ *= -1;
				}
				return result;
			}
			/**
			* Extracts the unwrapped value from its lazy wrapper.
			*
			* @private
			* @name value
			* @memberOf LazyWrapper
			* @returns {*} Returns the unwrapped value.
			*/
			function lazyValue() {
				var array = this.__wrapped__.value(), dir = this.__dir__, isArr = isArray(array), isRight = dir < 0, arrLength = isArr ? array.length : 0, view = getView(0, arrLength, this.__views__), start = view.start, end = view.end, length = end - start, index = isRight ? end : start - 1, iteratees = this.__iteratees__, iterLength = iteratees.length, resIndex = 0, takeCount = nativeMin(length, this.__takeCount__);
				if (!isArr || !isRight && arrLength == length && takeCount == length) return baseWrapperValue(array, this.__actions__);
				var result = [];
				outer: while (length-- && resIndex < takeCount) {
					index += dir;
					var iterIndex = -1, value = array[index];
					while (++iterIndex < iterLength) {
						var data = iteratees[iterIndex], iteratee = data.iteratee, type = data.type, computed = iteratee(value);
						if (type == LAZY_MAP_FLAG) value = computed;
						else if (!computed) {
							if (type == LAZY_FILTER_FLAG) continue outer;
							else break outer;
						}
					}
					result[resIndex++] = value;
				}
				return result;
			}
			LazyWrapper.prototype = baseCreate(baseLodash.prototype);
			LazyWrapper.prototype.constructor = LazyWrapper;
			/**
			* Creates a hash object.
			*
			* @private
			* @constructor
			* @param {Array} [entries] The key-value pairs to cache.
			*/
			function Hash(entries) {
				var index = -1, length = entries == null ? 0 : entries.length;
				this.clear();
				while (++index < length) {
					var entry = entries[index];
					this.set(entry[0], entry[1]);
				}
			}
			/**
			* Removes all key-value entries from the hash.
			*
			* @private
			* @name clear
			* @memberOf Hash
			*/
			function hashClear() {
				this.__data__ = nativeCreate ? nativeCreate(null) : {};
				this.size = 0;
			}
			/**
			* Removes `key` and its value from the hash.
			*
			* @private
			* @name delete
			* @memberOf Hash
			* @param {Object} hash The hash to modify.
			* @param {string} key The key of the value to remove.
			* @returns {boolean} Returns `true` if the entry was removed, else `false`.
			*/
			function hashDelete(key) {
				var result = this.has(key) && delete this.__data__[key];
				this.size -= result ? 1 : 0;
				return result;
			}
			/**
			* Gets the hash value for `key`.
			*
			* @private
			* @name get
			* @memberOf Hash
			* @param {string} key The key of the value to get.
			* @returns {*} Returns the entry value.
			*/
			function hashGet(key) {
				var data = this.__data__;
				if (nativeCreate) {
					var result = data[key];
					return result === HASH_UNDEFINED ? undefined : result;
				}
				return hasOwnProperty.call(data, key) ? data[key] : undefined;
			}
			/**
			* Checks if a hash value for `key` exists.
			*
			* @private
			* @name has
			* @memberOf Hash
			* @param {string} key The key of the entry to check.
			* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
			*/
			function hashHas(key) {
				var data = this.__data__;
				return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
			}
			/**
			* Sets the hash `key` to `value`.
			*
			* @private
			* @name set
			* @memberOf Hash
			* @param {string} key The key of the value to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns the hash instance.
			*/
			function hashSet(key, value) {
				var data = this.__data__;
				this.size += this.has(key) ? 0 : 1;
				data[key] = nativeCreate && value === undefined ? HASH_UNDEFINED : value;
				return this;
			}
			Hash.prototype.clear = hashClear;
			Hash.prototype["delete"] = hashDelete;
			Hash.prototype.get = hashGet;
			Hash.prototype.has = hashHas;
			Hash.prototype.set = hashSet;
			/**
			* Creates an list cache object.
			*
			* @private
			* @constructor
			* @param {Array} [entries] The key-value pairs to cache.
			*/
			function ListCache(entries) {
				var index = -1, length = entries == null ? 0 : entries.length;
				this.clear();
				while (++index < length) {
					var entry = entries[index];
					this.set(entry[0], entry[1]);
				}
			}
			/**
			* Removes all key-value entries from the list cache.
			*
			* @private
			* @name clear
			* @memberOf ListCache
			*/
			function listCacheClear() {
				this.__data__ = [];
				this.size = 0;
			}
			/**
			* Removes `key` and its value from the list cache.
			*
			* @private
			* @name delete
			* @memberOf ListCache
			* @param {string} key The key of the value to remove.
			* @returns {boolean} Returns `true` if the entry was removed, else `false`.
			*/
			function listCacheDelete(key) {
				var data = this.__data__, index = assocIndexOf(data, key);
				if (index < 0) return false;
				if (index == data.length - 1) data.pop();
				else splice.call(data, index, 1);
				--this.size;
				return true;
			}
			/**
			* Gets the list cache value for `key`.
			*
			* @private
			* @name get
			* @memberOf ListCache
			* @param {string} key The key of the value to get.
			* @returns {*} Returns the entry value.
			*/
			function listCacheGet(key) {
				var data = this.__data__, index = assocIndexOf(data, key);
				return index < 0 ? undefined : data[index][1];
			}
			/**
			* Checks if a list cache value for `key` exists.
			*
			* @private
			* @name has
			* @memberOf ListCache
			* @param {string} key The key of the entry to check.
			* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
			*/
			function listCacheHas(key) {
				return assocIndexOf(this.__data__, key) > -1;
			}
			/**
			* Sets the list cache `key` to `value`.
			*
			* @private
			* @name set
			* @memberOf ListCache
			* @param {string} key The key of the value to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns the list cache instance.
			*/
			function listCacheSet(key, value) {
				var data = this.__data__, index = assocIndexOf(data, key);
				if (index < 0) {
					++this.size;
					data.push([key, value]);
				} else data[index][1] = value;
				return this;
			}
			ListCache.prototype.clear = listCacheClear;
			ListCache.prototype["delete"] = listCacheDelete;
			ListCache.prototype.get = listCacheGet;
			ListCache.prototype.has = listCacheHas;
			ListCache.prototype.set = listCacheSet;
			/**
			* Creates a map cache object to store key-value pairs.
			*
			* @private
			* @constructor
			* @param {Array} [entries] The key-value pairs to cache.
			*/
			function MapCache(entries) {
				var index = -1, length = entries == null ? 0 : entries.length;
				this.clear();
				while (++index < length) {
					var entry = entries[index];
					this.set(entry[0], entry[1]);
				}
			}
			/**
			* Removes all key-value entries from the map.
			*
			* @private
			* @name clear
			* @memberOf MapCache
			*/
			function mapCacheClear() {
				this.size = 0;
				this.__data__ = {
					"hash": new Hash(),
					"map": new (Map || ListCache)(),
					"string": new Hash()
				};
			}
			/**
			* Removes `key` and its value from the map.
			*
			* @private
			* @name delete
			* @memberOf MapCache
			* @param {string} key The key of the value to remove.
			* @returns {boolean} Returns `true` if the entry was removed, else `false`.
			*/
			function mapCacheDelete(key) {
				var result = getMapData(this, key)["delete"](key);
				this.size -= result ? 1 : 0;
				return result;
			}
			/**
			* Gets the map value for `key`.
			*
			* @private
			* @name get
			* @memberOf MapCache
			* @param {string} key The key of the value to get.
			* @returns {*} Returns the entry value.
			*/
			function mapCacheGet(key) {
				return getMapData(this, key).get(key);
			}
			/**
			* Checks if a map value for `key` exists.
			*
			* @private
			* @name has
			* @memberOf MapCache
			* @param {string} key The key of the entry to check.
			* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
			*/
			function mapCacheHas(key) {
				return getMapData(this, key).has(key);
			}
			/**
			* Sets the map `key` to `value`.
			*
			* @private
			* @name set
			* @memberOf MapCache
			* @param {string} key The key of the value to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns the map cache instance.
			*/
			function mapCacheSet(key, value) {
				var data = getMapData(this, key), size = data.size;
				data.set(key, value);
				this.size += data.size == size ? 0 : 1;
				return this;
			}
			MapCache.prototype.clear = mapCacheClear;
			MapCache.prototype["delete"] = mapCacheDelete;
			MapCache.prototype.get = mapCacheGet;
			MapCache.prototype.has = mapCacheHas;
			MapCache.prototype.set = mapCacheSet;
			/**
			*
			* Creates an array cache object to store unique values.
			*
			* @private
			* @constructor
			* @param {Array} [values] The values to cache.
			*/
			function SetCache(values) {
				var index = -1, length = values == null ? 0 : values.length;
				this.__data__ = new MapCache();
				while (++index < length) this.add(values[index]);
			}
			/**
			* Adds `value` to the array cache.
			*
			* @private
			* @name add
			* @memberOf SetCache
			* @alias push
			* @param {*} value The value to cache.
			* @returns {Object} Returns the cache instance.
			*/
			function setCacheAdd(value) {
				this.__data__.set(value, HASH_UNDEFINED);
				return this;
			}
			/**
			* Checks if `value` is in the array cache.
			*
			* @private
			* @name has
			* @memberOf SetCache
			* @param {*} value The value to search for.
			* @returns {number} Returns `true` if `value` is found, else `false`.
			*/
			function setCacheHas(value) {
				return this.__data__.has(value);
			}
			SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
			SetCache.prototype.has = setCacheHas;
			/**
			* Creates a stack cache object to store key-value pairs.
			*
			* @private
			* @constructor
			* @param {Array} [entries] The key-value pairs to cache.
			*/
			function Stack(entries) {
				var data = this.__data__ = new ListCache(entries);
				this.size = data.size;
			}
			/**
			* Removes all key-value entries from the stack.
			*
			* @private
			* @name clear
			* @memberOf Stack
			*/
			function stackClear() {
				this.__data__ = new ListCache();
				this.size = 0;
			}
			/**
			* Removes `key` and its value from the stack.
			*
			* @private
			* @name delete
			* @memberOf Stack
			* @param {string} key The key of the value to remove.
			* @returns {boolean} Returns `true` if the entry was removed, else `false`.
			*/
			function stackDelete(key) {
				var data = this.__data__, result = data["delete"](key);
				this.size = data.size;
				return result;
			}
			/**
			* Gets the stack value for `key`.
			*
			* @private
			* @name get
			* @memberOf Stack
			* @param {string} key The key of the value to get.
			* @returns {*} Returns the entry value.
			*/
			function stackGet(key) {
				return this.__data__.get(key);
			}
			/**
			* Checks if a stack value for `key` exists.
			*
			* @private
			* @name has
			* @memberOf Stack
			* @param {string} key The key of the entry to check.
			* @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
			*/
			function stackHas(key) {
				return this.__data__.has(key);
			}
			/**
			* Sets the stack `key` to `value`.
			*
			* @private
			* @name set
			* @memberOf Stack
			* @param {string} key The key of the value to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns the stack cache instance.
			*/
			function stackSet(key, value) {
				var data = this.__data__;
				if (data instanceof ListCache) {
					var pairs = data.__data__;
					if (!Map || pairs.length < 199) {
						pairs.push([key, value]);
						this.size = ++data.size;
						return this;
					}
					data = this.__data__ = new MapCache(pairs);
				}
				data.set(key, value);
				this.size = data.size;
				return this;
			}
			Stack.prototype.clear = stackClear;
			Stack.prototype["delete"] = stackDelete;
			Stack.prototype.get = stackGet;
			Stack.prototype.has = stackHas;
			Stack.prototype.set = stackSet;
			/**
			* Creates an array of the enumerable property names of the array-like `value`.
			*
			* @private
			* @param {*} value The value to query.
			* @param {boolean} inherited Specify returning inherited property names.
			* @returns {Array} Returns the array of property names.
			*/
			function arrayLikeKeys(value, inherited) {
				var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
				for (var key in value) if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || isIndex(key, length)))) result.push(key);
				return result;
			}
			/**
			* A specialized version of `_.sample` for arrays.
			*
			* @private
			* @param {Array} array The array to sample.
			* @returns {*} Returns the random element.
			*/
			function arraySample(array) {
				var length = array.length;
				return length ? array[baseRandom(0, length - 1)] : undefined;
			}
			/**
			* A specialized version of `_.sampleSize` for arrays.
			*
			* @private
			* @param {Array} array The array to sample.
			* @param {number} n The number of elements to sample.
			* @returns {Array} Returns the random elements.
			*/
			function arraySampleSize(array, n) {
				return shuffleSelf(copyArray(array), baseClamp(n, 0, array.length));
			}
			/**
			* A specialized version of `_.shuffle` for arrays.
			*
			* @private
			* @param {Array} array The array to shuffle.
			* @returns {Array} Returns the new shuffled array.
			*/
			function arrayShuffle(array) {
				return shuffleSelf(copyArray(array));
			}
			/**
			* This function is like `assignValue` except that it doesn't assign
			* `undefined` values.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {string} key The key of the property to assign.
			* @param {*} value The value to assign.
			*/
			function assignMergeValue(object, key, value) {
				if (value !== undefined && !eq(object[key], value) || value === undefined && !(key in object)) baseAssignValue(object, key, value);
			}
			/**
			* Assigns `value` to `key` of `object` if the existing value is not equivalent
			* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {string} key The key of the property to assign.
			* @param {*} value The value to assign.
			*/
			function assignValue(object, key, value) {
				var objValue = object[key];
				if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) || value === undefined && !(key in object)) baseAssignValue(object, key, value);
			}
			/**
			* Gets the index at which the `key` is found in `array` of key-value pairs.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {*} key The key to search for.
			* @returns {number} Returns the index of the matched value, else `-1`.
			*/
			function assocIndexOf(array, key) {
				var length = array.length;
				while (length--) if (eq(array[length][0], key)) return length;
				return -1;
			}
			/**
			* Aggregates elements of `collection` on `accumulator` with keys transformed
			* by `iteratee` and values set by `setter`.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} setter The function to set `accumulator` values.
			* @param {Function} iteratee The iteratee to transform keys.
			* @param {Object} accumulator The initial aggregated object.
			* @returns {Function} Returns `accumulator`.
			*/
			function baseAggregator(collection, setter, iteratee, accumulator) {
				baseEach(collection, function(value, key, collection) {
					setter(accumulator, value, iteratee(value), collection);
				});
				return accumulator;
			}
			/**
			* The base implementation of `_.assign` without support for multiple sources
			* or `customizer` functions.
			*
			* @private
			* @param {Object} object The destination object.
			* @param {Object} source The source object.
			* @returns {Object} Returns `object`.
			*/
			function baseAssign(object, source) {
				return object && copyObject(source, keys(source), object);
			}
			/**
			* The base implementation of `_.assignIn` without support for multiple sources
			* or `customizer` functions.
			*
			* @private
			* @param {Object} object The destination object.
			* @param {Object} source The source object.
			* @returns {Object} Returns `object`.
			*/
			function baseAssignIn(object, source) {
				return object && copyObject(source, keysIn(source), object);
			}
			/**
			* The base implementation of `assignValue` and `assignMergeValue` without
			* value checks.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {string} key The key of the property to assign.
			* @param {*} value The value to assign.
			*/
			function baseAssignValue(object, key, value) {
				if (key == "__proto__" && defineProperty) defineProperty(object, key, {
					"configurable": true,
					"enumerable": true,
					"value": value,
					"writable": true
				});
				else object[key] = value;
			}
			/**
			* The base implementation of `_.at` without support for individual paths.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {string[]} paths The property paths to pick.
			* @returns {Array} Returns the picked elements.
			*/
			function baseAt(object, paths) {
				var index = -1, length = paths.length, result = Array(length), skip = object == null;
				while (++index < length) result[index] = skip ? undefined : get(object, paths[index]);
				return result;
			}
			/**
			* The base implementation of `_.clamp` which doesn't coerce arguments.
			*
			* @private
			* @param {number} number The number to clamp.
			* @param {number} [lower] The lower bound.
			* @param {number} upper The upper bound.
			* @returns {number} Returns the clamped number.
			*/
			function baseClamp(number, lower, upper) {
				if (number === number) {
					if (upper !== undefined) number = number <= upper ? number : upper;
					if (lower !== undefined) number = number >= lower ? number : lower;
				}
				return number;
			}
			/**
			* The base implementation of `_.clone` and `_.cloneDeep` which tracks
			* traversed objects.
			*
			* @private
			* @param {*} value The value to clone.
			* @param {boolean} bitmask The bitmask flags.
			*  1 - Deep clone
			*  2 - Flatten inherited properties
			*  4 - Clone symbols
			* @param {Function} [customizer] The function to customize cloning.
			* @param {string} [key] The key of `value`.
			* @param {Object} [object] The parent object of `value`.
			* @param {Object} [stack] Tracks traversed objects and their clone counterparts.
			* @returns {*} Returns the cloned value.
			*/
			function baseClone(value, bitmask, customizer, key, object, stack) {
				var result, isDeep = bitmask & CLONE_DEEP_FLAG, isFlat = bitmask & CLONE_FLAT_FLAG, isFull = bitmask & CLONE_SYMBOLS_FLAG;
				if (customizer) result = object ? customizer(value, key, object, stack) : customizer(value);
				if (result !== undefined) return result;
				if (!isObject(value)) return value;
				var isArr = isArray(value);
				if (isArr) {
					result = initCloneArray(value);
					if (!isDeep) return copyArray(value, result);
				} else {
					var tag = getTag(value), isFunc = tag == funcTag || tag == genTag;
					if (isBuffer(value)) return cloneBuffer(value, isDeep);
					if (tag == objectTag || tag == argsTag || isFunc && !object) {
						result = isFlat || isFunc ? {} : initCloneObject(value);
						if (!isDeep) return isFlat ? copySymbolsIn(value, baseAssignIn(result, value)) : copySymbols(value, baseAssign(result, value));
					} else {
						if (!cloneableTags[tag]) return object ? value : {};
						result = initCloneByTag(value, tag, isDeep);
					}
				}
				stack || (stack = new Stack());
				var stacked = stack.get(value);
				if (stacked) return stacked;
				stack.set(value, result);
				if (isSet(value)) value.forEach(function(subValue) {
					result.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
				});
				else if (isMap(value)) value.forEach(function(subValue, key) {
					result.set(key, baseClone(subValue, bitmask, customizer, key, value, stack));
				});
				var props = isArr ? undefined : (isFull ? isFlat ? getAllKeysIn : getAllKeys : isFlat ? keysIn : keys)(value);
				arrayEach(props || value, function(subValue, key) {
					if (props) {
						key = subValue;
						subValue = value[key];
					}
					assignValue(result, key, baseClone(subValue, bitmask, customizer, key, value, stack));
				});
				return result;
			}
			/**
			* The base implementation of `_.conforms` which doesn't clone `source`.
			*
			* @private
			* @param {Object} source The object of property predicates to conform to.
			* @returns {Function} Returns the new spec function.
			*/
			function baseConforms(source) {
				var props = keys(source);
				return function(object) {
					return baseConformsTo(object, source, props);
				};
			}
			/**
			* The base implementation of `_.conformsTo` which accepts `props` to check.
			*
			* @private
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property predicates to conform to.
			* @returns {boolean} Returns `true` if `object` conforms, else `false`.
			*/
			function baseConformsTo(object, source, props) {
				var length = props.length;
				if (object == null) return !length;
				object = Object(object);
				while (length--) {
					var key = props[length], predicate = source[key], value = object[key];
					if (value === undefined && !(key in object) || !predicate(value)) return false;
				}
				return true;
			}
			/**
			* The base implementation of `_.delay` and `_.defer` which accepts `args`
			* to provide to `func`.
			*
			* @private
			* @param {Function} func The function to delay.
			* @param {number} wait The number of milliseconds to delay invocation.
			* @param {Array} args The arguments to provide to `func`.
			* @returns {number|Object} Returns the timer id or timeout object.
			*/
			function baseDelay(func, wait, args) {
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				return setTimeout(function() {
					func.apply(undefined, args);
				}, wait);
			}
			/**
			* The base implementation of methods like `_.difference` without support
			* for excluding multiple arrays or iteratee shorthands.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {Array} values The values to exclude.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			*/
			function baseDifference(array, values, iteratee, comparator) {
				var index = -1, includes = arrayIncludes, isCommon = true, length = array.length, result = [], valuesLength = values.length;
				if (!length) return result;
				if (iteratee) values = arrayMap(values, baseUnary(iteratee));
				if (comparator) {
					includes = arrayIncludesWith;
					isCommon = false;
				} else if (values.length >= LARGE_ARRAY_SIZE) {
					includes = cacheHas;
					isCommon = false;
					values = new SetCache(values);
				}
				outer: while (++index < length) {
					var value = array[index], computed = iteratee == null ? value : iteratee(value);
					value = comparator || value !== 0 ? value : 0;
					if (isCommon && computed === computed) {
						var valuesIndex = valuesLength;
						while (valuesIndex--) if (values[valuesIndex] === computed) continue outer;
						result.push(value);
					} else if (!includes(values, computed, comparator)) result.push(value);
				}
				return result;
			}
			/**
			* The base implementation of `_.forEach` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Array|Object} Returns `collection`.
			*/
			var baseEach = createBaseEach(baseForOwn);
			/**
			* The base implementation of `_.forEachRight` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Array|Object} Returns `collection`.
			*/
			var baseEachRight = createBaseEach(baseForOwnRight, true);
			/**
			* The base implementation of `_.every` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} predicate The function invoked per iteration.
			* @returns {boolean} Returns `true` if all elements pass the predicate check,
			*  else `false`
			*/
			function baseEvery(collection, predicate) {
				var result = true;
				baseEach(collection, function(value, index, collection) {
					result = !!predicate(value, index, collection);
					return result;
				});
				return result;
			}
			/**
			* The base implementation of methods like `_.max` and `_.min` which accepts a
			* `comparator` to determine the extremum value.
			*
			* @private
			* @param {Array} array The array to iterate over.
			* @param {Function} iteratee The iteratee invoked per iteration.
			* @param {Function} comparator The comparator used to compare values.
			* @returns {*} Returns the extremum value.
			*/
			function baseExtremum(array, iteratee, comparator) {
				var index = -1, length = array.length;
				while (++index < length) {
					var value = array[index], current = iteratee(value);
					if (current != null && (computed === undefined ? current === current && !isSymbol(current) : comparator(current, computed))) var computed = current, result = value;
				}
				return result;
			}
			/**
			* The base implementation of `_.fill` without an iteratee call guard.
			*
			* @private
			* @param {Array} array The array to fill.
			* @param {*} value The value to fill `array` with.
			* @param {number} [start=0] The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns `array`.
			*/
			function baseFill(array, value, start, end) {
				var length = array.length;
				start = toInteger(start);
				if (start < 0) start = -start > length ? 0 : length + start;
				end = end === undefined || end > length ? length : toInteger(end);
				if (end < 0) end += length;
				end = start > end ? 0 : toLength(end);
				while (start < end) array[start++] = value;
				return array;
			}
			/**
			* The base implementation of `_.filter` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} predicate The function invoked per iteration.
			* @returns {Array} Returns the new filtered array.
			*/
			function baseFilter(collection, predicate) {
				var result = [];
				baseEach(collection, function(value, index, collection) {
					if (predicate(value, index, collection)) result.push(value);
				});
				return result;
			}
			/**
			* The base implementation of `_.flatten` with support for restricting flattening.
			*
			* @private
			* @param {Array} array The array to flatten.
			* @param {number} depth The maximum recursion depth.
			* @param {boolean} [predicate=isFlattenable] The function invoked per iteration.
			* @param {boolean} [isStrict] Restrict to values that pass `predicate` checks.
			* @param {Array} [result=[]] The initial result value.
			* @returns {Array} Returns the new flattened array.
			*/
			function baseFlatten(array, depth, predicate, isStrict, result) {
				var index = -1, length = array.length;
				predicate || (predicate = isFlattenable);
				result || (result = []);
				while (++index < length) {
					var value = array[index];
					if (depth > 0 && predicate(value)) {
						if (depth > 1) baseFlatten(value, depth - 1, predicate, isStrict, result);
						else arrayPush(result, value);
					} else if (!isStrict) result[result.length] = value;
				}
				return result;
			}
			/**
			* The base implementation of `baseForOwn` which iterates over `object`
			* properties returned by `keysFunc` and invokes `iteratee` for each property.
			* Iteratee functions may exit iteration early by explicitly returning `false`.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @param {Function} keysFunc The function to get the keys of `object`.
			* @returns {Object} Returns `object`.
			*/
			var baseFor = createBaseFor();
			/**
			* This function is like `baseFor` except that it iterates over properties
			* in the opposite order.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @param {Function} keysFunc The function to get the keys of `object`.
			* @returns {Object} Returns `object`.
			*/
			var baseForRight = createBaseFor(true);
			/**
			* The base implementation of `_.forOwn` without support for iteratee shorthands.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Object} Returns `object`.
			*/
			function baseForOwn(object, iteratee) {
				return object && baseFor(object, iteratee, keys);
			}
			/**
			* The base implementation of `_.forOwnRight` without support for iteratee shorthands.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Object} Returns `object`.
			*/
			function baseForOwnRight(object, iteratee) {
				return object && baseForRight(object, iteratee, keys);
			}
			/**
			* The base implementation of `_.functions` which creates an array of
			* `object` function property names filtered from `props`.
			*
			* @private
			* @param {Object} object The object to inspect.
			* @param {Array} props The property names to filter.
			* @returns {Array} Returns the function names.
			*/
			function baseFunctions(object, props) {
				return arrayFilter(props, function(key) {
					return isFunction(object[key]);
				});
			}
			/**
			* The base implementation of `_.get` without support for default values.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the property to get.
			* @returns {*} Returns the resolved value.
			*/
			function baseGet(object, path) {
				path = castPath(path, object);
				var index = 0, length = path.length;
				while (object != null && index < length) object = object[toKey(path[index++])];
				return index && index == length ? object : undefined;
			}
			/**
			* The base implementation of `getAllKeys` and `getAllKeysIn` which uses
			* `keysFunc` and `symbolsFunc` to get the enumerable property names and
			* symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Function} keysFunc The function to get the keys of `object`.
			* @param {Function} symbolsFunc The function to get the symbols of `object`.
			* @returns {Array} Returns the array of property names and symbols.
			*/
			function baseGetAllKeys(object, keysFunc, symbolsFunc) {
				var result = keysFunc(object);
				return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
			}
			/**
			* The base implementation of `getTag` without fallbacks for buggy environments.
			*
			* @private
			* @param {*} value The value to query.
			* @returns {string} Returns the `toStringTag`.
			*/
			function baseGetTag(value) {
				if (value == null) return value === undefined ? undefinedTag : nullTag;
				return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
			}
			/**
			* The base implementation of `_.gt` which doesn't coerce arguments.
			*
			* @private
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is greater than `other`,
			*  else `false`.
			*/
			function baseGt(value, other) {
				return value > other;
			}
			/**
			* The base implementation of `_.has` without support for deep paths.
			*
			* @private
			* @param {Object} [object] The object to query.
			* @param {Array|string} key The key to check.
			* @returns {boolean} Returns `true` if `key` exists, else `false`.
			*/
			function baseHas(object, key) {
				return object != null && hasOwnProperty.call(object, key);
			}
			/**
			* The base implementation of `_.hasIn` without support for deep paths.
			*
			* @private
			* @param {Object} [object] The object to query.
			* @param {Array|string} key The key to check.
			* @returns {boolean} Returns `true` if `key` exists, else `false`.
			*/
			function baseHasIn(object, key) {
				return object != null && key in Object(object);
			}
			/**
			* The base implementation of `_.inRange` which doesn't coerce arguments.
			*
			* @private
			* @param {number} number The number to check.
			* @param {number} start The start of the range.
			* @param {number} end The end of the range.
			* @returns {boolean} Returns `true` if `number` is in the range, else `false`.
			*/
			function baseInRange(number, start, end) {
				return number >= nativeMin(start, end) && number < nativeMax(start, end);
			}
			/**
			* The base implementation of methods like `_.intersection`, without support
			* for iteratee shorthands, that accepts an array of arrays to inspect.
			*
			* @private
			* @param {Array} arrays The arrays to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of shared values.
			*/
			function baseIntersection(arrays, iteratee, comparator) {
				var includes = comparator ? arrayIncludesWith : arrayIncludes, length = arrays[0].length, othLength = arrays.length, othIndex = othLength, caches = Array(othLength), maxLength = Infinity, result = [];
				while (othIndex--) {
					var array = arrays[othIndex];
					if (othIndex && iteratee) array = arrayMap(array, baseUnary(iteratee));
					maxLength = nativeMin(array.length, maxLength);
					caches[othIndex] = !comparator && (iteratee || length >= 120 && array.length >= 120) ? new SetCache(othIndex && array) : undefined;
				}
				array = arrays[0];
				var index = -1, seen = caches[0];
				outer: while (++index < length && result.length < maxLength) {
					var value = array[index], computed = iteratee ? iteratee(value) : value;
					value = comparator || value !== 0 ? value : 0;
					if (!(seen ? cacheHas(seen, computed) : includes(result, computed, comparator))) {
						othIndex = othLength;
						while (--othIndex) {
							var cache = caches[othIndex];
							if (!(cache ? cacheHas(cache, computed) : includes(arrays[othIndex], computed, comparator))) continue outer;
						}
						if (seen) seen.push(computed);
						result.push(value);
					}
				}
				return result;
			}
			/**
			* The base implementation of `_.invert` and `_.invertBy` which inverts
			* `object` with values transformed by `iteratee` and set by `setter`.
			*
			* @private
			* @param {Object} object The object to iterate over.
			* @param {Function} setter The function to set `accumulator` values.
			* @param {Function} iteratee The iteratee to transform values.
			* @param {Object} accumulator The initial inverted object.
			* @returns {Function} Returns `accumulator`.
			*/
			function baseInverter(object, setter, iteratee, accumulator) {
				baseForOwn(object, function(value, key, object) {
					setter(accumulator, iteratee(value), key, object);
				});
				return accumulator;
			}
			/**
			* The base implementation of `_.invoke` without support for individual
			* method arguments.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the method to invoke.
			* @param {Array} args The arguments to invoke the method with.
			* @returns {*} Returns the result of the invoked method.
			*/
			function baseInvoke(object, path, args) {
				path = castPath(path, object);
				object = parent(object, path);
				var func = object == null ? object : object[toKey(last(path))];
				return func == null ? undefined : apply(func, object, args);
			}
			/**
			* The base implementation of `_.isArguments`.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an `arguments` object,
			*/
			function baseIsArguments(value) {
				return isObjectLike(value) && baseGetTag(value) == argsTag;
			}
			/**
			* The base implementation of `_.isArrayBuffer` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an array buffer, else `false`.
			*/
			function baseIsArrayBuffer(value) {
				return isObjectLike(value) && baseGetTag(value) == arrayBufferTag;
			}
			/**
			* The base implementation of `_.isDate` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a date object, else `false`.
			*/
			function baseIsDate(value) {
				return isObjectLike(value) && baseGetTag(value) == dateTag;
			}
			/**
			* The base implementation of `_.isEqual` which supports partial comparisons
			* and tracks traversed objects.
			*
			* @private
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @param {boolean} bitmask The bitmask flags.
			*  1 - Unordered comparison
			*  2 - Partial comparison
			* @param {Function} [customizer] The function to customize comparisons.
			* @param {Object} [stack] Tracks traversed `value` and `other` objects.
			* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
			*/
			function baseIsEqual(value, other, bitmask, customizer, stack) {
				if (value === other) return true;
				if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) return value !== value && other !== other;
				return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
			}
			/**
			* A specialized version of `baseIsEqual` for arrays and objects which performs
			* deep comparisons and tracks traversed objects enabling objects with circular
			* references to be compared.
			*
			* @private
			* @param {Object} object The object to compare.
			* @param {Object} other The other object to compare.
			* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
			* @param {Function} customizer The function to customize comparisons.
			* @param {Function} equalFunc The function to determine equivalents of values.
			* @param {Object} [stack] Tracks traversed `object` and `other` objects.
			* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
			*/
			function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
				var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
				objTag = objTag == argsTag ? objectTag : objTag;
				othTag = othTag == argsTag ? objectTag : othTag;
				var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
				if (isSameTag && isBuffer(object)) {
					if (!isBuffer(other)) return false;
					objIsArr = true;
					objIsObj = false;
				}
				if (isSameTag && !objIsObj) {
					stack || (stack = new Stack());
					return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
				}
				if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
					var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
					if (objIsWrapped || othIsWrapped) {
						var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
						stack || (stack = new Stack());
						return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
					}
				}
				if (!isSameTag) return false;
				stack || (stack = new Stack());
				return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
			}
			/**
			* The base implementation of `_.isMap` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a map, else `false`.
			*/
			function baseIsMap(value) {
				return isObjectLike(value) && getTag(value) == mapTag;
			}
			/**
			* The base implementation of `_.isMatch` without support for iteratee shorthands.
			*
			* @private
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property values to match.
			* @param {Array} matchData The property names, values, and compare flags to match.
			* @param {Function} [customizer] The function to customize comparisons.
			* @returns {boolean} Returns `true` if `object` is a match, else `false`.
			*/
			function baseIsMatch(object, source, matchData, customizer) {
				var index = matchData.length, length = index, noCustomizer = !customizer;
				if (object == null) return !length;
				object = Object(object);
				while (index--) {
					var data = matchData[index];
					if (noCustomizer && data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) return false;
				}
				while (++index < length) {
					data = matchData[index];
					var key = data[0], objValue = object[key], srcValue = data[1];
					if (noCustomizer && data[2]) {
						if (objValue === undefined && !(key in object)) return false;
					} else {
						var stack = new Stack();
						if (customizer) var result = customizer(objValue, srcValue, key, object, source, stack);
						if (!(result === undefined ? baseIsEqual(srcValue, objValue, 3, customizer, stack) : result)) return false;
					}
				}
				return true;
			}
			/**
			* The base implementation of `_.isNative` without bad shim checks.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a native function,
			*  else `false`.
			*/
			function baseIsNative(value) {
				if (!isObject(value) || isMasked(value)) return false;
				return (isFunction(value) ? reIsNative : reIsHostCtor).test(toSource(value));
			}
			/**
			* The base implementation of `_.isRegExp` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a regexp, else `false`.
			*/
			function baseIsRegExp(value) {
				return isObjectLike(value) && baseGetTag(value) == regexpTag;
			}
			/**
			* The base implementation of `_.isSet` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a set, else `false`.
			*/
			function baseIsSet(value) {
				return isObjectLike(value) && getTag(value) == setTag;
			}
			/**
			* The base implementation of `_.isTypedArray` without Node.js optimizations.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
			*/
			function baseIsTypedArray(value) {
				return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
			}
			/**
			* The base implementation of `_.iteratee`.
			*
			* @private
			* @param {*} [value=_.identity] The value to convert to an iteratee.
			* @returns {Function} Returns the iteratee.
			*/
			function baseIteratee(value) {
				if (typeof value == "function") return value;
				if (value == null) return identity;
				if (typeof value == "object") return isArray(value) ? baseMatchesProperty(value[0], value[1]) : baseMatches(value);
				return property(value);
			}
			/**
			* The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			*/
			function baseKeys(object) {
				if (!isPrototype(object)) return nativeKeys(object);
				var result = [];
				for (var key in Object(object)) if (hasOwnProperty.call(object, key) && key != "constructor") result.push(key);
				return result;
			}
			/**
			* The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			*/
			function baseKeysIn(object) {
				if (!isObject(object)) return nativeKeysIn(object);
				var isProto = isPrototype(object), result = [];
				for (var key in object) if (!(key == "constructor" && (isProto || !hasOwnProperty.call(object, key)))) result.push(key);
				return result;
			}
			/**
			* The base implementation of `_.lt` which doesn't coerce arguments.
			*
			* @private
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is less than `other`,
			*  else `false`.
			*/
			function baseLt(value, other) {
				return value < other;
			}
			/**
			* The base implementation of `_.map` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} iteratee The function invoked per iteration.
			* @returns {Array} Returns the new mapped array.
			*/
			function baseMap(collection, iteratee) {
				var index = -1, result = isArrayLike(collection) ? Array(collection.length) : [];
				baseEach(collection, function(value, key, collection) {
					result[++index] = iteratee(value, key, collection);
				});
				return result;
			}
			/**
			* The base implementation of `_.matches` which doesn't clone `source`.
			*
			* @private
			* @param {Object} source The object of property values to match.
			* @returns {Function} Returns the new spec function.
			*/
			function baseMatches(source) {
				var matchData = getMatchData(source);
				if (matchData.length == 1 && matchData[0][2]) return matchesStrictComparable(matchData[0][0], matchData[0][1]);
				return function(object) {
					return object === source || baseIsMatch(object, source, matchData);
				};
			}
			/**
			* The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
			*
			* @private
			* @param {string} path The path of the property to get.
			* @param {*} srcValue The value to match.
			* @returns {Function} Returns the new spec function.
			*/
			function baseMatchesProperty(path, srcValue) {
				if (isKey(path) && isStrictComparable(srcValue)) return matchesStrictComparable(toKey(path), srcValue);
				return function(object) {
					var objValue = get(object, path);
					return objValue === undefined && objValue === srcValue ? hasIn(object, path) : baseIsEqual(srcValue, objValue, 3);
				};
			}
			/**
			* The base implementation of `_.merge` without support for multiple sources.
			*
			* @private
			* @param {Object} object The destination object.
			* @param {Object} source The source object.
			* @param {number} srcIndex The index of `source`.
			* @param {Function} [customizer] The function to customize merged values.
			* @param {Object} [stack] Tracks traversed source values and their merged
			*  counterparts.
			*/
			function baseMerge(object, source, srcIndex, customizer, stack) {
				if (object === source) return;
				baseFor(source, function(srcValue, key) {
					stack || (stack = new Stack());
					if (isObject(srcValue)) baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
					else {
						var newValue = customizer ? customizer(safeGet(object, key), srcValue, key + "", object, source, stack) : undefined;
						if (newValue === undefined) newValue = srcValue;
						assignMergeValue(object, key, newValue);
					}
				}, keysIn);
			}
			/**
			* A specialized version of `baseMerge` for arrays and objects which performs
			* deep merges and tracks traversed objects enabling objects with circular
			* references to be merged.
			*
			* @private
			* @param {Object} object The destination object.
			* @param {Object} source The source object.
			* @param {string} key The key of the value to merge.
			* @param {number} srcIndex The index of `source`.
			* @param {Function} mergeFunc The function to merge values.
			* @param {Function} [customizer] The function to customize assigned values.
			* @param {Object} [stack] Tracks traversed source values and their merged
			*  counterparts.
			*/
			function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
				var objValue = safeGet(object, key), srcValue = safeGet(source, key), stacked = stack.get(srcValue);
				if (stacked) {
					assignMergeValue(object, key, stacked);
					return;
				}
				var newValue = customizer ? customizer(objValue, srcValue, key + "", object, source, stack) : undefined;
				var isCommon = newValue === undefined;
				if (isCommon) {
					var isArr = isArray(srcValue), isBuff = !isArr && isBuffer(srcValue), isTyped = !isArr && !isBuff && isTypedArray(srcValue);
					newValue = srcValue;
					if (isArr || isBuff || isTyped) {
						if (isArray(objValue)) newValue = objValue;
						else if (isArrayLikeObject(objValue)) newValue = copyArray(objValue);
						else if (isBuff) {
							isCommon = false;
							newValue = cloneBuffer(srcValue, true);
						} else if (isTyped) {
							isCommon = false;
							newValue = cloneTypedArray(srcValue, true);
						} else newValue = [];
					} else if (isPlainObject(srcValue) || isArguments(srcValue)) {
						newValue = objValue;
						if (isArguments(objValue)) newValue = toPlainObject(objValue);
						else if (!isObject(objValue) || isFunction(objValue)) newValue = initCloneObject(srcValue);
					} else isCommon = false;
				}
				if (isCommon) {
					stack.set(srcValue, newValue);
					mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
					stack["delete"](srcValue);
				}
				assignMergeValue(object, key, newValue);
			}
			/**
			* The base implementation of `_.nth` which doesn't coerce arguments.
			*
			* @private
			* @param {Array} array The array to query.
			* @param {number} n The index of the element to return.
			* @returns {*} Returns the nth element of `array`.
			*/
			function baseNth(array, n) {
				var length = array.length;
				if (!length) return;
				n += n < 0 ? length : 0;
				return isIndex(n, length) ? array[n] : undefined;
			}
			/**
			* The base implementation of `_.orderBy` without param guards.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function[]|Object[]|string[]} iteratees The iteratees to sort by.
			* @param {string[]} orders The sort orders of `iteratees`.
			* @returns {Array} Returns the new sorted array.
			*/
			function baseOrderBy(collection, iteratees, orders) {
				if (iteratees.length) iteratees = arrayMap(iteratees, function(iteratee) {
					if (isArray(iteratee)) return function(value) {
						return baseGet(value, iteratee.length === 1 ? iteratee[0] : iteratee);
					};
					return iteratee;
				});
				else iteratees = [identity];
				var index = -1;
				iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
				return baseSortBy(baseMap(collection, function(value, key, collection) {
					return {
						"criteria": arrayMap(iteratees, function(iteratee) {
							return iteratee(value);
						}),
						"index": ++index,
						"value": value
					};
				}), function(object, other) {
					return compareMultiple(object, other, orders);
				});
			}
			/**
			* The base implementation of `_.pick` without support for individual
			* property identifiers.
			*
			* @private
			* @param {Object} object The source object.
			* @param {string[]} paths The property paths to pick.
			* @returns {Object} Returns the new object.
			*/
			function basePick(object, paths) {
				return basePickBy(object, paths, function(value, path) {
					return hasIn(object, path);
				});
			}
			/**
			* The base implementation of  `_.pickBy` without support for iteratee shorthands.
			*
			* @private
			* @param {Object} object The source object.
			* @param {string[]} paths The property paths to pick.
			* @param {Function} predicate The function invoked per property.
			* @returns {Object} Returns the new object.
			*/
			function basePickBy(object, paths, predicate) {
				var index = -1, length = paths.length, result = {};
				while (++index < length) {
					var path = paths[index], value = baseGet(object, path);
					if (predicate(value, path)) baseSet(result, castPath(path, object), value);
				}
				return result;
			}
			/**
			* A specialized version of `baseProperty` which supports deep paths.
			*
			* @private
			* @param {Array|string} path The path of the property to get.
			* @returns {Function} Returns the new accessor function.
			*/
			function basePropertyDeep(path) {
				return function(object) {
					return baseGet(object, path);
				};
			}
			/**
			* The base implementation of `_.pullAllBy` without support for iteratee
			* shorthands.
			*
			* @private
			* @param {Array} array The array to modify.
			* @param {Array} values The values to remove.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns `array`.
			*/
			function basePullAll(array, values, iteratee, comparator) {
				var indexOf = comparator ? baseIndexOfWith : baseIndexOf, index = -1, length = values.length, seen = array;
				if (array === values) values = copyArray(values);
				if (iteratee) seen = arrayMap(array, baseUnary(iteratee));
				while (++index < length) {
					var fromIndex = 0, value = values[index], computed = iteratee ? iteratee(value) : value;
					while ((fromIndex = indexOf(seen, computed, fromIndex, comparator)) > -1) {
						if (seen !== array) splice.call(seen, fromIndex, 1);
						splice.call(array, fromIndex, 1);
					}
				}
				return array;
			}
			/**
			* The base implementation of `_.pullAt` without support for individual
			* indexes or capturing the removed elements.
			*
			* @private
			* @param {Array} array The array to modify.
			* @param {number[]} indexes The indexes of elements to remove.
			* @returns {Array} Returns `array`.
			*/
			function basePullAt(array, indexes) {
				var length = array ? indexes.length : 0, lastIndex = length - 1;
				while (length--) {
					var index = indexes[length];
					if (length == lastIndex || index !== previous) {
						var previous = index;
						if (isIndex(index)) splice.call(array, index, 1);
						else baseUnset(array, index);
					}
				}
				return array;
			}
			/**
			* The base implementation of `_.random` without support for returning
			* floating-point numbers.
			*
			* @private
			* @param {number} lower The lower bound.
			* @param {number} upper The upper bound.
			* @returns {number} Returns the random number.
			*/
			function baseRandom(lower, upper) {
				return lower + nativeFloor(nativeRandom() * (upper - lower + 1));
			}
			/**
			* The base implementation of `_.range` and `_.rangeRight` which doesn't
			* coerce arguments.
			*
			* @private
			* @param {number} start The start of the range.
			* @param {number} end The end of the range.
			* @param {number} step The value to increment or decrement by.
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Array} Returns the range of numbers.
			*/
			function baseRange(start, end, step, fromRight) {
				var index = -1, length = nativeMax(nativeCeil((end - start) / (step || 1)), 0), result = Array(length);
				while (length--) {
					result[fromRight ? length : ++index] = start;
					start += step;
				}
				return result;
			}
			/**
			* The base implementation of `_.repeat` which doesn't coerce arguments.
			*
			* @private
			* @param {string} string The string to repeat.
			* @param {number} n The number of times to repeat the string.
			* @returns {string} Returns the repeated string.
			*/
			function baseRepeat(string, n) {
				var result = "";
				if (!string || n < 1 || n > MAX_SAFE_INTEGER) return result;
				do {
					if (n % 2) result += string;
					n = nativeFloor(n / 2);
					if (n) string += string;
				} while (n);
				return result;
			}
			/**
			* The base implementation of `_.rest` which doesn't validate or coerce arguments.
			*
			* @private
			* @param {Function} func The function to apply a rest parameter to.
			* @param {number} [start=func.length-1] The start position of the rest parameter.
			* @returns {Function} Returns the new function.
			*/
			function baseRest(func, start) {
				return setToString(overRest(func, start, identity), func + "");
			}
			/**
			* The base implementation of `_.sample`.
			*
			* @private
			* @param {Array|Object} collection The collection to sample.
			* @returns {*} Returns the random element.
			*/
			function baseSample(collection) {
				return arraySample(values(collection));
			}
			/**
			* The base implementation of `_.sampleSize` without param guards.
			*
			* @private
			* @param {Array|Object} collection The collection to sample.
			* @param {number} n The number of elements to sample.
			* @returns {Array} Returns the random elements.
			*/
			function baseSampleSize(collection, n) {
				var array = values(collection);
				return shuffleSelf(array, baseClamp(n, 0, array.length));
			}
			/**
			* The base implementation of `_.set`.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {*} value The value to set.
			* @param {Function} [customizer] The function to customize path creation.
			* @returns {Object} Returns `object`.
			*/
			function baseSet(object, path, value, customizer) {
				if (!isObject(object)) return object;
				path = castPath(path, object);
				var index = -1, length = path.length, lastIndex = length - 1, nested = object;
				while (nested != null && ++index < length) {
					var key = toKey(path[index]), newValue = value;
					if (key === "__proto__" || key === "constructor" || key === "prototype") return object;
					if (index != lastIndex) {
						var objValue = nested[key];
						newValue = customizer ? customizer(objValue, key, nested) : undefined;
						if (newValue === undefined) newValue = isObject(objValue) ? objValue : isIndex(path[index + 1]) ? [] : {};
					}
					assignValue(nested, key, newValue);
					nested = nested[key];
				}
				return object;
			}
			/**
			* The base implementation of `setData` without support for hot loop shorting.
			*
			* @private
			* @param {Function} func The function to associate metadata with.
			* @param {*} data The metadata.
			* @returns {Function} Returns `func`.
			*/
			var baseSetData = !metaMap ? identity : function(func, data) {
				metaMap.set(func, data);
				return func;
			};
			/**
			* The base implementation of `setToString` without support for hot loop shorting.
			*
			* @private
			* @param {Function} func The function to modify.
			* @param {Function} string The `toString` result.
			* @returns {Function} Returns `func`.
			*/
			var baseSetToString = !defineProperty ? identity : function(func, string) {
				return defineProperty(func, "toString", {
					"configurable": true,
					"enumerable": false,
					"value": constant(string),
					"writable": true
				});
			};
			/**
			* The base implementation of `_.shuffle`.
			*
			* @private
			* @param {Array|Object} collection The collection to shuffle.
			* @returns {Array} Returns the new shuffled array.
			*/
			function baseShuffle(collection) {
				return shuffleSelf(values(collection));
			}
			/**
			* The base implementation of `_.slice` without an iteratee call guard.
			*
			* @private
			* @param {Array} array The array to slice.
			* @param {number} [start=0] The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns the slice of `array`.
			*/
			function baseSlice(array, start, end) {
				var index = -1, length = array.length;
				if (start < 0) start = -start > length ? 0 : length + start;
				end = end > length ? length : end;
				if (end < 0) end += length;
				length = start > end ? 0 : end - start >>> 0;
				start >>>= 0;
				var result = Array(length);
				while (++index < length) result[index] = array[index + start];
				return result;
			}
			/**
			* The base implementation of `_.some` without support for iteratee shorthands.
			*
			* @private
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} predicate The function invoked per iteration.
			* @returns {boolean} Returns `true` if any element passes the predicate check,
			*  else `false`.
			*/
			function baseSome(collection, predicate) {
				var result;
				baseEach(collection, function(value, index, collection) {
					result = predicate(value, index, collection);
					return !result;
				});
				return !!result;
			}
			/**
			* The base implementation of `_.sortedIndex` and `_.sortedLastIndex` which
			* performs a binary search of `array` to determine the index at which `value`
			* should be inserted into `array` in order to maintain its sort order.
			*
			* @private
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @param {boolean} [retHighest] Specify returning the highest qualified index.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			*/
			function baseSortedIndex(array, value, retHighest) {
				var low = 0, high = array == null ? low : array.length;
				if (typeof value == "number" && value === value && high <= HALF_MAX_ARRAY_LENGTH) {
					while (low < high) {
						var mid = low + high >>> 1, computed = array[mid];
						if (computed !== null && !isSymbol(computed) && (retHighest ? computed <= value : computed < value)) low = mid + 1;
						else high = mid;
					}
					return high;
				}
				return baseSortedIndexBy(array, value, identity, retHighest);
			}
			/**
			* The base implementation of `_.sortedIndexBy` and `_.sortedLastIndexBy`
			* which invokes `iteratee` for `value` and each element of `array` to compute
			* their sort ranking. The iteratee is invoked with one argument; (value).
			*
			* @private
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @param {Function} iteratee The iteratee invoked per element.
			* @param {boolean} [retHighest] Specify returning the highest qualified index.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			*/
			function baseSortedIndexBy(array, value, iteratee, retHighest) {
				var low = 0, high = array == null ? 0 : array.length;
				if (high === 0) return 0;
				value = iteratee(value);
				var valIsNaN = value !== value, valIsNull = value === null, valIsSymbol = isSymbol(value), valIsUndefined = value === undefined;
				while (low < high) {
					var mid = nativeFloor((low + high) / 2), computed = iteratee(array[mid]), othIsDefined = computed !== undefined, othIsNull = computed === null, othIsReflexive = computed === computed, othIsSymbol = isSymbol(computed);
					if (valIsNaN) var setLow = retHighest || othIsReflexive;
					else if (valIsUndefined) setLow = othIsReflexive && (retHighest || othIsDefined);
					else if (valIsNull) setLow = othIsReflexive && othIsDefined && (retHighest || !othIsNull);
					else if (valIsSymbol) setLow = othIsReflexive && othIsDefined && !othIsNull && (retHighest || !othIsSymbol);
					else if (othIsNull || othIsSymbol) setLow = false;
					else setLow = retHighest ? computed <= value : computed < value;
					if (setLow) low = mid + 1;
					else high = mid;
				}
				return nativeMin(high, MAX_ARRAY_INDEX);
			}
			/**
			* The base implementation of `_.sortedUniq` and `_.sortedUniqBy` without
			* support for iteratee shorthands.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			*/
			function baseSortedUniq(array, iteratee) {
				var index = -1, length = array.length, resIndex = 0, result = [];
				while (++index < length) {
					var value = array[index], computed = iteratee ? iteratee(value) : value;
					if (!index || !eq(computed, seen)) {
						var seen = computed;
						result[resIndex++] = value === 0 ? 0 : value;
					}
				}
				return result;
			}
			/**
			* The base implementation of `_.toNumber` which doesn't ensure correct
			* conversions of binary, hexadecimal, or octal string values.
			*
			* @private
			* @param {*} value The value to process.
			* @returns {number} Returns the number.
			*/
			function baseToNumber(value) {
				if (typeof value == "number") return value;
				if (isSymbol(value)) return NAN;
				return +value;
			}
			/**
			* The base implementation of `_.toString` which doesn't convert nullish
			* values to empty strings.
			*
			* @private
			* @param {*} value The value to process.
			* @returns {string} Returns the string.
			*/
			function baseToString(value) {
				if (typeof value == "string") return value;
				if (isArray(value)) return arrayMap(value, baseToString) + "";
				if (isSymbol(value)) return symbolToString ? symbolToString.call(value) : "";
				var result = value + "";
				return result == "0" && 1 / value == -Infinity ? "-0" : result;
			}
			/**
			* The base implementation of `_.uniqBy` without support for iteratee shorthands.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			*/
			function baseUniq(array, iteratee, comparator) {
				var index = -1, includes = arrayIncludes, length = array.length, isCommon = true, result = [], seen = result;
				if (comparator) {
					isCommon = false;
					includes = arrayIncludesWith;
				} else if (length >= LARGE_ARRAY_SIZE) {
					var set = iteratee ? null : createSet(array);
					if (set) return setToArray(set);
					isCommon = false;
					includes = cacheHas;
					seen = new SetCache();
				} else seen = iteratee ? [] : result;
				outer: while (++index < length) {
					var value = array[index], computed = iteratee ? iteratee(value) : value;
					value = comparator || value !== 0 ? value : 0;
					if (isCommon && computed === computed) {
						var seenIndex = seen.length;
						while (seenIndex--) if (seen[seenIndex] === computed) continue outer;
						if (iteratee) seen.push(computed);
						result.push(value);
					} else if (!includes(seen, computed, comparator)) {
						if (seen !== result) seen.push(computed);
						result.push(value);
					}
				}
				return result;
			}
			/**
			* The base implementation of `_.unset`.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {Array|string} path The property path to unset.
			* @returns {boolean} Returns `true` if the property is deleted, else `false`.
			*/
			function baseUnset(object, path) {
				path = castPath(path, object);
				object = parent(object, path);
				return object == null || delete object[toKey(last(path))];
			}
			/**
			* The base implementation of `_.update`.
			*
			* @private
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to update.
			* @param {Function} updater The function to produce the updated value.
			* @param {Function} [customizer] The function to customize path creation.
			* @returns {Object} Returns `object`.
			*/
			function baseUpdate(object, path, updater, customizer) {
				return baseSet(object, path, updater(baseGet(object, path)), customizer);
			}
			/**
			* The base implementation of methods like `_.dropWhile` and `_.takeWhile`
			* without support for iteratee shorthands.
			*
			* @private
			* @param {Array} array The array to query.
			* @param {Function} predicate The function invoked per iteration.
			* @param {boolean} [isDrop] Specify dropping elements instead of taking them.
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Array} Returns the slice of `array`.
			*/
			function baseWhile(array, predicate, isDrop, fromRight) {
				var length = array.length, index = fromRight ? length : -1;
				while ((fromRight ? index-- : ++index < length) && predicate(array[index], index, array));
				return isDrop ? baseSlice(array, fromRight ? 0 : index, fromRight ? index + 1 : length) : baseSlice(array, fromRight ? index + 1 : 0, fromRight ? length : index);
			}
			/**
			* The base implementation of `wrapperValue` which returns the result of
			* performing a sequence of actions on the unwrapped `value`, where each
			* successive action is supplied the return value of the previous.
			*
			* @private
			* @param {*} value The unwrapped value.
			* @param {Array} actions Actions to perform to resolve the unwrapped value.
			* @returns {*} Returns the resolved value.
			*/
			function baseWrapperValue(value, actions) {
				var result = value;
				if (result instanceof LazyWrapper) result = result.value();
				return arrayReduce(actions, function(result, action) {
					return action.func.apply(action.thisArg, arrayPush([result], action.args));
				}, result);
			}
			/**
			* The base implementation of methods like `_.xor`, without support for
			* iteratee shorthands, that accepts an array of arrays to inspect.
			*
			* @private
			* @param {Array} arrays The arrays to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of values.
			*/
			function baseXor(arrays, iteratee, comparator) {
				var length = arrays.length;
				if (length < 2) return length ? baseUniq(arrays[0]) : [];
				var index = -1, result = Array(length);
				while (++index < length) {
					var array = arrays[index], othIndex = -1;
					while (++othIndex < length) if (othIndex != index) result[index] = baseDifference(result[index] || array, arrays[othIndex], iteratee, comparator);
				}
				return baseUniq(baseFlatten(result, 1), iteratee, comparator);
			}
			/**
			* This base implementation of `_.zipObject` which assigns values using `assignFunc`.
			*
			* @private
			* @param {Array} props The property identifiers.
			* @param {Array} values The property values.
			* @param {Function} assignFunc The function to assign values.
			* @returns {Object} Returns the new object.
			*/
			function baseZipObject(props, values, assignFunc) {
				var index = -1, length = props.length, valsLength = values.length, result = {};
				while (++index < length) {
					var value = index < valsLength ? values[index] : undefined;
					assignFunc(result, props[index], value);
				}
				return result;
			}
			/**
			* Casts `value` to an empty array if it's not an array like object.
			*
			* @private
			* @param {*} value The value to inspect.
			* @returns {Array|Object} Returns the cast array-like object.
			*/
			function castArrayLikeObject(value) {
				return isArrayLikeObject(value) ? value : [];
			}
			/**
			* Casts `value` to `identity` if it's not a function.
			*
			* @private
			* @param {*} value The value to inspect.
			* @returns {Function} Returns cast function.
			*/
			function castFunction(value) {
				return typeof value == "function" ? value : identity;
			}
			/**
			* Casts `value` to a path array if it's not one.
			*
			* @private
			* @param {*} value The value to inspect.
			* @param {Object} [object] The object to query keys on.
			* @returns {Array} Returns the cast property path array.
			*/
			function castPath(value, object) {
				if (isArray(value)) return value;
				return isKey(value, object) ? [value] : stringToPath(toString(value));
			}
			/**
			* A `baseRest` alias which can be replaced with `identity` by module
			* replacement plugins.
			*
			* @private
			* @type {Function}
			* @param {Function} func The function to apply a rest parameter to.
			* @returns {Function} Returns the new function.
			*/
			var castRest = baseRest;
			/**
			* Casts `array` to a slice if it's needed.
			*
			* @private
			* @param {Array} array The array to inspect.
			* @param {number} start The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns the cast slice.
			*/
			function castSlice(array, start, end) {
				var length = array.length;
				end = end === undefined ? length : end;
				return !start && end >= length ? array : baseSlice(array, start, end);
			}
			/**
			* A simple wrapper around the global [`clearTimeout`](https://mdn.io/clearTimeout).
			*
			* @private
			* @param {number|Object} id The timer id or timeout object of the timer to clear.
			*/
			var clearTimeout = ctxClearTimeout || function(id) {
				return root.clearTimeout(id);
			};
			/**
			* Creates a clone of  `buffer`.
			*
			* @private
			* @param {Buffer} buffer The buffer to clone.
			* @param {boolean} [isDeep] Specify a deep clone.
			* @returns {Buffer} Returns the cloned buffer.
			*/
			function cloneBuffer(buffer, isDeep) {
				if (isDeep) return buffer.slice();
				var length = buffer.length, result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
				buffer.copy(result);
				return result;
			}
			/**
			* Creates a clone of `arrayBuffer`.
			*
			* @private
			* @param {ArrayBuffer} arrayBuffer The array buffer to clone.
			* @returns {ArrayBuffer} Returns the cloned array buffer.
			*/
			function cloneArrayBuffer(arrayBuffer) {
				var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
				new Uint8Array(result).set(new Uint8Array(arrayBuffer));
				return result;
			}
			/**
			* Creates a clone of `dataView`.
			*
			* @private
			* @param {Object} dataView The data view to clone.
			* @param {boolean} [isDeep] Specify a deep clone.
			* @returns {Object} Returns the cloned data view.
			*/
			function cloneDataView(dataView, isDeep) {
				var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
				return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
			}
			/**
			* Creates a clone of `regexp`.
			*
			* @private
			* @param {Object} regexp The regexp to clone.
			* @returns {Object} Returns the cloned regexp.
			*/
			function cloneRegExp(regexp) {
				var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
				result.lastIndex = regexp.lastIndex;
				return result;
			}
			/**
			* Creates a clone of the `symbol` object.
			*
			* @private
			* @param {Object} symbol The symbol object to clone.
			* @returns {Object} Returns the cloned symbol object.
			*/
			function cloneSymbol(symbol) {
				return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
			}
			/**
			* Creates a clone of `typedArray`.
			*
			* @private
			* @param {Object} typedArray The typed array to clone.
			* @param {boolean} [isDeep] Specify a deep clone.
			* @returns {Object} Returns the cloned typed array.
			*/
			function cloneTypedArray(typedArray, isDeep) {
				var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
				return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
			}
			/**
			* Compares values to sort them in ascending order.
			*
			* @private
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {number} Returns the sort order indicator for `value`.
			*/
			function compareAscending(value, other) {
				if (value !== other) {
					var valIsDefined = value !== undefined, valIsNull = value === null, valIsReflexive = value === value, valIsSymbol = isSymbol(value);
					var othIsDefined = other !== undefined, othIsNull = other === null, othIsReflexive = other === other, othIsSymbol = isSymbol(other);
					if (!othIsNull && !othIsSymbol && !valIsSymbol && value > other || valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol || valIsNull && othIsDefined && othIsReflexive || !valIsDefined && othIsReflexive || !valIsReflexive) return 1;
					if (!valIsNull && !valIsSymbol && !othIsSymbol && value < other || othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol || othIsNull && valIsDefined && valIsReflexive || !othIsDefined && valIsReflexive || !othIsReflexive) return -1;
				}
				return 0;
			}
			/**
			* Used by `_.orderBy` to compare multiple properties of a value to another
			* and stable sort them.
			*
			* If `orders` is unspecified, all values are sorted in ascending order. Otherwise,
			* specify an order of "desc" for descending or "asc" for ascending sort order
			* of corresponding values.
			*
			* @private
			* @param {Object} object The object to compare.
			* @param {Object} other The other object to compare.
			* @param {boolean[]|string[]} orders The order to sort by for each property.
			* @returns {number} Returns the sort order indicator for `object`.
			*/
			function compareMultiple(object, other, orders) {
				var index = -1, objCriteria = object.criteria, othCriteria = other.criteria, length = objCriteria.length, ordersLength = orders.length;
				while (++index < length) {
					var result = compareAscending(objCriteria[index], othCriteria[index]);
					if (result) {
						if (index >= ordersLength) return result;
						return result * (orders[index] == "desc" ? -1 : 1);
					}
				}
				return object.index - other.index;
			}
			/**
			* Creates an array that is the composition of partially applied arguments,
			* placeholders, and provided arguments into a single array of arguments.
			*
			* @private
			* @param {Array} args The provided arguments.
			* @param {Array} partials The arguments to prepend to those provided.
			* @param {Array} holders The `partials` placeholder indexes.
			* @params {boolean} [isCurried] Specify composing for a curried function.
			* @returns {Array} Returns the new array of composed arguments.
			*/
			function composeArgs(args, partials, holders, isCurried) {
				var argsIndex = -1, argsLength = args.length, holdersLength = holders.length, leftIndex = -1, leftLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result = Array(leftLength + rangeLength), isUncurried = !isCurried;
				while (++leftIndex < leftLength) result[leftIndex] = partials[leftIndex];
				while (++argsIndex < holdersLength) if (isUncurried || argsIndex < argsLength) result[holders[argsIndex]] = args[argsIndex];
				while (rangeLength--) result[leftIndex++] = args[argsIndex++];
				return result;
			}
			/**
			* This function is like `composeArgs` except that the arguments composition
			* is tailored for `_.partialRight`.
			*
			* @private
			* @param {Array} args The provided arguments.
			* @param {Array} partials The arguments to append to those provided.
			* @param {Array} holders The `partials` placeholder indexes.
			* @params {boolean} [isCurried] Specify composing for a curried function.
			* @returns {Array} Returns the new array of composed arguments.
			*/
			function composeArgsRight(args, partials, holders, isCurried) {
				var argsIndex = -1, argsLength = args.length, holdersIndex = -1, holdersLength = holders.length, rightIndex = -1, rightLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result = Array(rangeLength + rightLength), isUncurried = !isCurried;
				while (++argsIndex < rangeLength) result[argsIndex] = args[argsIndex];
				var offset = argsIndex;
				while (++rightIndex < rightLength) result[offset + rightIndex] = partials[rightIndex];
				while (++holdersIndex < holdersLength) if (isUncurried || argsIndex < argsLength) result[offset + holders[holdersIndex]] = args[argsIndex++];
				return result;
			}
			/**
			* Copies the values of `source` to `array`.
			*
			* @private
			* @param {Array} source The array to copy values from.
			* @param {Array} [array=[]] The array to copy values to.
			* @returns {Array} Returns `array`.
			*/
			function copyArray(source, array) {
				var index = -1, length = source.length;
				array || (array = Array(length));
				while (++index < length) array[index] = source[index];
				return array;
			}
			/**
			* Copies properties of `source` to `object`.
			*
			* @private
			* @param {Object} source The object to copy properties from.
			* @param {Array} props The property identifiers to copy.
			* @param {Object} [object={}] The object to copy properties to.
			* @param {Function} [customizer] The function to customize copied values.
			* @returns {Object} Returns `object`.
			*/
			function copyObject(source, props, object, customizer) {
				var isNew = !object;
				object || (object = {});
				var index = -1, length = props.length;
				while (++index < length) {
					var key = props[index];
					var newValue = customizer ? customizer(object[key], source[key], key, object, source) : undefined;
					if (newValue === undefined) newValue = source[key];
					if (isNew) baseAssignValue(object, key, newValue);
					else assignValue(object, key, newValue);
				}
				return object;
			}
			/**
			* Copies own symbols of `source` to `object`.
			*
			* @private
			* @param {Object} source The object to copy symbols from.
			* @param {Object} [object={}] The object to copy symbols to.
			* @returns {Object} Returns `object`.
			*/
			function copySymbols(source, object) {
				return copyObject(source, getSymbols(source), object);
			}
			/**
			* Copies own and inherited symbols of `source` to `object`.
			*
			* @private
			* @param {Object} source The object to copy symbols from.
			* @param {Object} [object={}] The object to copy symbols to.
			* @returns {Object} Returns `object`.
			*/
			function copySymbolsIn(source, object) {
				return copyObject(source, getSymbolsIn(source), object);
			}
			/**
			* Creates a function like `_.groupBy`.
			*
			* @private
			* @param {Function} setter The function to set accumulator values.
			* @param {Function} [initializer] The accumulator object initializer.
			* @returns {Function} Returns the new aggregator function.
			*/
			function createAggregator(setter, initializer) {
				return function(collection, iteratee) {
					var func = isArray(collection) ? arrayAggregator : baseAggregator, accumulator = initializer ? initializer() : {};
					return func(collection, setter, getIteratee(iteratee, 2), accumulator);
				};
			}
			/**
			* Creates a function like `_.assign`.
			*
			* @private
			* @param {Function} assigner The function to assign values.
			* @returns {Function} Returns the new assigner function.
			*/
			function createAssigner(assigner) {
				return baseRest(function(object, sources) {
					var index = -1, length = sources.length, customizer = length > 1 ? sources[length - 1] : undefined, guard = length > 2 ? sources[2] : undefined;
					customizer = assigner.length > 3 && typeof customizer == "function" ? (length--, customizer) : undefined;
					if (guard && isIterateeCall(sources[0], sources[1], guard)) {
						customizer = length < 3 ? undefined : customizer;
						length = 1;
					}
					object = Object(object);
					while (++index < length) {
						var source = sources[index];
						if (source) assigner(object, source, index, customizer);
					}
					return object;
				});
			}
			/**
			* Creates a `baseEach` or `baseEachRight` function.
			*
			* @private
			* @param {Function} eachFunc The function to iterate over a collection.
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Function} Returns the new base function.
			*/
			function createBaseEach(eachFunc, fromRight) {
				return function(collection, iteratee) {
					if (collection == null) return collection;
					if (!isArrayLike(collection)) return eachFunc(collection, iteratee);
					var length = collection.length, index = fromRight ? length : -1, iterable = Object(collection);
					while (fromRight ? index-- : ++index < length) if (iteratee(iterable[index], index, iterable) === false) break;
					return collection;
				};
			}
			/**
			* Creates a base function for methods like `_.forIn` and `_.forOwn`.
			*
			* @private
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Function} Returns the new base function.
			*/
			function createBaseFor(fromRight) {
				return function(object, iteratee, keysFunc) {
					var index = -1, iterable = Object(object), props = keysFunc(object), length = props.length;
					while (length--) {
						var key = props[fromRight ? length : ++index];
						if (iteratee(iterable[key], key, iterable) === false) break;
					}
					return object;
				};
			}
			/**
			* Creates a function that wraps `func` to invoke it with the optional `this`
			* binding of `thisArg`.
			*
			* @private
			* @param {Function} func The function to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {*} [thisArg] The `this` binding of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createBind(func, bitmask, thisArg) {
				var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
				function wrapper() {
					return (this && this !== root && this instanceof wrapper ? Ctor : func).apply(isBind ? thisArg : this, arguments);
				}
				return wrapper;
			}
			/**
			* Creates a function like `_.lowerFirst`.
			*
			* @private
			* @param {string} methodName The name of the `String` case method to use.
			* @returns {Function} Returns the new case function.
			*/
			function createCaseFirst(methodName) {
				return function(string) {
					string = toString(string);
					var strSymbols = hasUnicode(string) ? stringToArray(string) : undefined;
					var chr = strSymbols ? strSymbols[0] : string.charAt(0);
					var trailing = strSymbols ? castSlice(strSymbols, 1).join("") : string.slice(1);
					return chr[methodName]() + trailing;
				};
			}
			/**
			* Creates a function like `_.camelCase`.
			*
			* @private
			* @param {Function} callback The function to combine each word.
			* @returns {Function} Returns the new compounder function.
			*/
			function createCompounder(callback) {
				return function(string) {
					return arrayReduce(words(deburr(string).replace(reApos, "")), callback, "");
				};
			}
			/**
			* Creates a function that produces an instance of `Ctor` regardless of
			* whether it was invoked as part of a `new` expression or by `call` or `apply`.
			*
			* @private
			* @param {Function} Ctor The constructor to wrap.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createCtor(Ctor) {
				return function() {
					var args = arguments;
					switch (args.length) {
						case 0: return new Ctor();
						case 1: return new Ctor(args[0]);
						case 2: return new Ctor(args[0], args[1]);
						case 3: return new Ctor(args[0], args[1], args[2]);
						case 4: return new Ctor(args[0], args[1], args[2], args[3]);
						case 5: return new Ctor(args[0], args[1], args[2], args[3], args[4]);
						case 6: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
						case 7: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
					}
					var thisBinding = baseCreate(Ctor.prototype), result = Ctor.apply(thisBinding, args);
					return isObject(result) ? result : thisBinding;
				};
			}
			/**
			* Creates a function that wraps `func` to enable currying.
			*
			* @private
			* @param {Function} func The function to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {number} arity The arity of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createCurry(func, bitmask, arity) {
				var Ctor = createCtor(func);
				function wrapper() {
					var length = arguments.length, args = Array(length), index = length, placeholder = getHolder(wrapper);
					while (index--) args[index] = arguments[index];
					var holders = length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder ? [] : replaceHolders(args, placeholder);
					length -= holders.length;
					if (length < arity) return createRecurry(func, bitmask, createHybrid, wrapper.placeholder, undefined, args, holders, undefined, undefined, arity - length);
					return apply(this && this !== root && this instanceof wrapper ? Ctor : func, this, args);
				}
				return wrapper;
			}
			/**
			* Creates a `_.find` or `_.findLast` function.
			*
			* @private
			* @param {Function} findIndexFunc The function to find the collection index.
			* @returns {Function} Returns the new find function.
			*/
			function createFind(findIndexFunc) {
				return function(collection, predicate, fromIndex) {
					var iterable = Object(collection);
					if (!isArrayLike(collection)) {
						var iteratee = getIteratee(predicate, 3);
						collection = keys(collection);
						predicate = function(key) {
							return iteratee(iterable[key], key, iterable);
						};
					}
					var index = findIndexFunc(collection, predicate, fromIndex);
					return index > -1 ? iterable[iteratee ? collection[index] : index] : undefined;
				};
			}
			/**
			* Creates a `_.flow` or `_.flowRight` function.
			*
			* @private
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Function} Returns the new flow function.
			*/
			function createFlow(fromRight) {
				return flatRest(function(funcs) {
					var length = funcs.length, index = length, prereq = LodashWrapper.prototype.thru;
					if (fromRight) funcs.reverse();
					while (index--) {
						var func = funcs[index];
						if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
						if (prereq && !wrapper && getFuncName(func) == "wrapper") var wrapper = new LodashWrapper([], true);
					}
					index = wrapper ? index : length;
					while (++index < length) {
						func = funcs[index];
						var funcName = getFuncName(func), data = funcName == "wrapper" ? getData(func) : undefined;
						if (data && isLaziable(data[0]) && data[1] == (WRAP_ARY_FLAG | WRAP_CURRY_FLAG | WRAP_PARTIAL_FLAG | WRAP_REARG_FLAG) && !data[4].length && data[9] == 1) wrapper = wrapper[getFuncName(data[0])].apply(wrapper, data[3]);
						else wrapper = func.length == 1 && isLaziable(func) ? wrapper[funcName]() : wrapper.thru(func);
					}
					return function() {
						var args = arguments, value = args[0];
						if (wrapper && args.length == 1 && isArray(value)) return wrapper.plant(value).value();
						var index = 0, result = length ? funcs[index].apply(this, args) : value;
						while (++index < length) result = funcs[index].call(this, result);
						return result;
					};
				});
			}
			/**
			* Creates a function that wraps `func` to invoke it with optional `this`
			* binding of `thisArg`, partial application, and currying.
			*
			* @private
			* @param {Function|string} func The function or method name to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {*} [thisArg] The `this` binding of `func`.
			* @param {Array} [partials] The arguments to prepend to those provided to
			*  the new function.
			* @param {Array} [holders] The `partials` placeholder indexes.
			* @param {Array} [partialsRight] The arguments to append to those provided
			*  to the new function.
			* @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
			* @param {Array} [argPos] The argument positions of the new function.
			* @param {number} [ary] The arity cap of `func`.
			* @param {number} [arity] The arity of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createHybrid(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
				var isAry = bitmask & WRAP_ARY_FLAG, isBind = bitmask & WRAP_BIND_FLAG, isBindKey = bitmask & WRAP_BIND_KEY_FLAG, isCurried = bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG), isFlip = bitmask & WRAP_FLIP_FLAG, Ctor = isBindKey ? undefined : createCtor(func);
				function wrapper() {
					var length = arguments.length, args = Array(length), index = length;
					while (index--) args[index] = arguments[index];
					if (isCurried) var placeholder = getHolder(wrapper), holdersCount = countHolders(args, placeholder);
					if (partials) args = composeArgs(args, partials, holders, isCurried);
					if (partialsRight) args = composeArgsRight(args, partialsRight, holdersRight, isCurried);
					length -= holdersCount;
					if (isCurried && length < arity) {
						var newHolders = replaceHolders(args, placeholder);
						return createRecurry(func, bitmask, createHybrid, wrapper.placeholder, thisArg, args, newHolders, argPos, ary, arity - length);
					}
					var thisBinding = isBind ? thisArg : this, fn = isBindKey ? thisBinding[func] : func;
					length = args.length;
					if (argPos) args = reorder(args, argPos);
					else if (isFlip && length > 1) args.reverse();
					if (isAry && ary < length) args.length = ary;
					if (this && this !== root && this instanceof wrapper) fn = Ctor || createCtor(fn);
					return fn.apply(thisBinding, args);
				}
				return wrapper;
			}
			/**
			* Creates a function like `_.invertBy`.
			*
			* @private
			* @param {Function} setter The function to set accumulator values.
			* @param {Function} toIteratee The function to resolve iteratees.
			* @returns {Function} Returns the new inverter function.
			*/
			function createInverter(setter, toIteratee) {
				return function(object, iteratee) {
					return baseInverter(object, setter, toIteratee(iteratee), {});
				};
			}
			/**
			* Creates a function that performs a mathematical operation on two values.
			*
			* @private
			* @param {Function} operator The function to perform the operation.
			* @param {number} [defaultValue] The value used for `undefined` arguments.
			* @returns {Function} Returns the new mathematical operation function.
			*/
			function createMathOperation(operator, defaultValue) {
				return function(value, other) {
					var result;
					if (value === undefined && other === undefined) return defaultValue;
					if (value !== undefined) result = value;
					if (other !== undefined) {
						if (result === undefined) return other;
						if (typeof value == "string" || typeof other == "string") {
							value = baseToString(value);
							other = baseToString(other);
						} else {
							value = baseToNumber(value);
							other = baseToNumber(other);
						}
						result = operator(value, other);
					}
					return result;
				};
			}
			/**
			* Creates a function like `_.over`.
			*
			* @private
			* @param {Function} arrayFunc The function to iterate over iteratees.
			* @returns {Function} Returns the new over function.
			*/
			function createOver(arrayFunc) {
				return flatRest(function(iteratees) {
					iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
					return baseRest(function(args) {
						var thisArg = this;
						return arrayFunc(iteratees, function(iteratee) {
							return apply(iteratee, thisArg, args);
						});
					});
				});
			}
			/**
			* Creates the padding for `string` based on `length`. The `chars` string
			* is truncated if the number of characters exceeds `length`.
			*
			* @private
			* @param {number} length The padding length.
			* @param {string} [chars=' '] The string used as padding.
			* @returns {string} Returns the padding for `string`.
			*/
			function createPadding(length, chars) {
				chars = chars === undefined ? " " : baseToString(chars);
				var charsLength = chars.length;
				if (charsLength < 2) return charsLength ? baseRepeat(chars, length) : chars;
				var result = baseRepeat(chars, nativeCeil(length / stringSize(chars)));
				return hasUnicode(chars) ? castSlice(stringToArray(result), 0, length).join("") : result.slice(0, length);
			}
			/**
			* Creates a function that wraps `func` to invoke it with the `this` binding
			* of `thisArg` and `partials` prepended to the arguments it receives.
			*
			* @private
			* @param {Function} func The function to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {*} thisArg The `this` binding of `func`.
			* @param {Array} partials The arguments to prepend to those provided to
			*  the new function.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createPartial(func, bitmask, thisArg, partials) {
				var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
				function wrapper() {
					var argsIndex = -1, argsLength = arguments.length, leftIndex = -1, leftLength = partials.length, args = Array(leftLength + argsLength), fn = this && this !== root && this instanceof wrapper ? Ctor : func;
					while (++leftIndex < leftLength) args[leftIndex] = partials[leftIndex];
					while (argsLength--) args[leftIndex++] = arguments[++argsIndex];
					return apply(fn, isBind ? thisArg : this, args);
				}
				return wrapper;
			}
			/**
			* Creates a `_.range` or `_.rangeRight` function.
			*
			* @private
			* @param {boolean} [fromRight] Specify iterating from right to left.
			* @returns {Function} Returns the new range function.
			*/
			function createRange(fromRight) {
				return function(start, end, step) {
					if (step && typeof step != "number" && isIterateeCall(start, end, step)) end = step = undefined;
					start = toFinite(start);
					if (end === undefined) {
						end = start;
						start = 0;
					} else end = toFinite(end);
					step = step === undefined ? start < end ? 1 : -1 : toFinite(step);
					return baseRange(start, end, step, fromRight);
				};
			}
			/**
			* Creates a function that performs a relational operation on two values.
			*
			* @private
			* @param {Function} operator The function to perform the operation.
			* @returns {Function} Returns the new relational operation function.
			*/
			function createRelationalOperation(operator) {
				return function(value, other) {
					if (!(typeof value == "string" && typeof other == "string")) {
						value = toNumber(value);
						other = toNumber(other);
					}
					return operator(value, other);
				};
			}
			/**
			* Creates a function that wraps `func` to continue currying.
			*
			* @private
			* @param {Function} func The function to wrap.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @param {Function} wrapFunc The function to create the `func` wrapper.
			* @param {*} placeholder The placeholder value.
			* @param {*} [thisArg] The `this` binding of `func`.
			* @param {Array} [partials] The arguments to prepend to those provided to
			*  the new function.
			* @param {Array} [holders] The `partials` placeholder indexes.
			* @param {Array} [argPos] The argument positions of the new function.
			* @param {number} [ary] The arity cap of `func`.
			* @param {number} [arity] The arity of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createRecurry(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary, arity) {
				var isCurry = bitmask & WRAP_CURRY_FLAG, newHolders = isCurry ? holders : undefined, newHoldersRight = isCurry ? undefined : holders, newPartials = isCurry ? partials : undefined, newPartialsRight = isCurry ? undefined : partials;
				bitmask |= isCurry ? WRAP_PARTIAL_FLAG : WRAP_PARTIAL_RIGHT_FLAG;
				bitmask &= ~(isCurry ? WRAP_PARTIAL_RIGHT_FLAG : WRAP_PARTIAL_FLAG);
				if (!(bitmask & WRAP_CURRY_BOUND_FLAG)) bitmask &= ~(WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG);
				var newData = [
					func,
					bitmask,
					thisArg,
					newPartials,
					newHolders,
					newPartialsRight,
					newHoldersRight,
					argPos,
					ary,
					arity
				];
				var result = wrapFunc.apply(undefined, newData);
				if (isLaziable(func)) setData(result, newData);
				result.placeholder = placeholder;
				return setWrapToString(result, func, bitmask);
			}
			/**
			* Creates a function like `_.round`.
			*
			* @private
			* @param {string} methodName The name of the `Math` method to use when rounding.
			* @returns {Function} Returns the new round function.
			*/
			function createRound(methodName) {
				var func = Math[methodName];
				return function(number, precision) {
					number = toNumber(number);
					precision = precision == null ? 0 : nativeMin(toInteger(precision), 292);
					if (precision && nativeIsFinite(number)) {
						var pair = (toString(number) + "e").split("e");
						pair = (toString(func(pair[0] + "e" + (+pair[1] + precision))) + "e").split("e");
						return +(pair[0] + "e" + (+pair[1] - precision));
					}
					return func(number);
				};
			}
			/**
			* Creates a set object of `values`.
			*
			* @private
			* @param {Array} values The values to add to the set.
			* @returns {Object} Returns the new set.
			*/
			var createSet = !(Set && 1 / setToArray(new Set([, -0]))[1] == INFINITY) ? noop : function(values) {
				return new Set(values);
			};
			/**
			* Creates a `_.toPairs` or `_.toPairsIn` function.
			*
			* @private
			* @param {Function} keysFunc The function to get the keys of a given object.
			* @returns {Function} Returns the new pairs function.
			*/
			function createToPairs(keysFunc) {
				return function(object) {
					var tag = getTag(object);
					if (tag == mapTag) return mapToArray(object);
					if (tag == setTag) return setToPairs(object);
					return baseToPairs(object, keysFunc(object));
				};
			}
			/**
			* Creates a function that either curries or invokes `func` with optional
			* `this` binding and partially applied arguments.
			*
			* @private
			* @param {Function|string} func The function or method name to wrap.
			* @param {number} bitmask The bitmask flags.
			*    1 - `_.bind`
			*    2 - `_.bindKey`
			*    4 - `_.curry` or `_.curryRight` of a bound function
			*    8 - `_.curry`
			*   16 - `_.curryRight`
			*   32 - `_.partial`
			*   64 - `_.partialRight`
			*  128 - `_.rearg`
			*  256 - `_.ary`
			*  512 - `_.flip`
			* @param {*} [thisArg] The `this` binding of `func`.
			* @param {Array} [partials] The arguments to be partially applied.
			* @param {Array} [holders] The `partials` placeholder indexes.
			* @param {Array} [argPos] The argument positions of the new function.
			* @param {number} [ary] The arity cap of `func`.
			* @param {number} [arity] The arity of `func`.
			* @returns {Function} Returns the new wrapped function.
			*/
			function createWrap(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
				var isBindKey = bitmask & WRAP_BIND_KEY_FLAG;
				if (!isBindKey && typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				var length = partials ? partials.length : 0;
				if (!length) {
					bitmask &= ~(WRAP_PARTIAL_FLAG | WRAP_PARTIAL_RIGHT_FLAG);
					partials = holders = undefined;
				}
				ary = ary === undefined ? ary : nativeMax(toInteger(ary), 0);
				arity = arity === undefined ? arity : toInteger(arity);
				length -= holders ? holders.length : 0;
				if (bitmask & WRAP_PARTIAL_RIGHT_FLAG) {
					var partialsRight = partials, holdersRight = holders;
					partials = holders = undefined;
				}
				var data = isBindKey ? undefined : getData(func);
				var newData = [
					func,
					bitmask,
					thisArg,
					partials,
					holders,
					partialsRight,
					holdersRight,
					argPos,
					ary,
					arity
				];
				if (data) mergeData(newData, data);
				func = newData[0];
				bitmask = newData[1];
				thisArg = newData[2];
				partials = newData[3];
				holders = newData[4];
				arity = newData[9] = newData[9] === undefined ? isBindKey ? 0 : func.length : nativeMax(newData[9] - length, 0);
				if (!arity && bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG)) bitmask &= ~(WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG);
				if (!bitmask || bitmask == WRAP_BIND_FLAG) var result = createBind(func, bitmask, thisArg);
				else if (bitmask == WRAP_CURRY_FLAG || bitmask == WRAP_CURRY_RIGHT_FLAG) result = createCurry(func, bitmask, arity);
				else if ((bitmask == WRAP_PARTIAL_FLAG || bitmask == (WRAP_BIND_FLAG | WRAP_PARTIAL_FLAG)) && !holders.length) result = createPartial(func, bitmask, thisArg, partials);
				else result = createHybrid.apply(undefined, newData);
				return setWrapToString((data ? baseSetData : setData)(result, newData), func, bitmask);
			}
			/**
			* Used by `_.defaults` to customize its `_.assignIn` use to assign properties
			* of source objects to the destination object for all destination properties
			* that resolve to `undefined`.
			*
			* @private
			* @param {*} objValue The destination value.
			* @param {*} srcValue The source value.
			* @param {string} key The key of the property to assign.
			* @param {Object} object The parent object of `objValue`.
			* @returns {*} Returns the value to assign.
			*/
			function customDefaultsAssignIn(objValue, srcValue, key, object) {
				if (objValue === undefined || eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key)) return srcValue;
				return objValue;
			}
			/**
			* Used by `_.defaultsDeep` to customize its `_.merge` use to merge source
			* objects into destination objects that are passed thru.
			*
			* @private
			* @param {*} objValue The destination value.
			* @param {*} srcValue The source value.
			* @param {string} key The key of the property to merge.
			* @param {Object} object The parent object of `objValue`.
			* @param {Object} source The parent object of `srcValue`.
			* @param {Object} [stack] Tracks traversed source values and their merged
			*  counterparts.
			* @returns {*} Returns the value to assign.
			*/
			function customDefaultsMerge(objValue, srcValue, key, object, source, stack) {
				if (isObject(objValue) && isObject(srcValue)) {
					stack.set(srcValue, objValue);
					baseMerge(objValue, srcValue, undefined, customDefaultsMerge, stack);
					stack["delete"](srcValue);
				}
				return objValue;
			}
			/**
			* Used by `_.omit` to customize its `_.cloneDeep` use to only clone plain
			* objects.
			*
			* @private
			* @param {*} value The value to inspect.
			* @param {string} key The key of the property to inspect.
			* @returns {*} Returns the uncloned value or `undefined` to defer cloning to `_.cloneDeep`.
			*/
			function customOmitClone(value) {
				return isPlainObject(value) ? undefined : value;
			}
			/**
			* A specialized version of `baseIsEqualDeep` for arrays with support for
			* partial deep comparisons.
			*
			* @private
			* @param {Array} array The array to compare.
			* @param {Array} other The other array to compare.
			* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
			* @param {Function} customizer The function to customize comparisons.
			* @param {Function} equalFunc The function to determine equivalents of values.
			* @param {Object} stack Tracks traversed `array` and `other` objects.
			* @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
			*/
			function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
				var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
				if (arrLength != othLength && !(isPartial && othLength > arrLength)) return false;
				var arrStacked = stack.get(array);
				var othStacked = stack.get(other);
				if (arrStacked && othStacked) return arrStacked == other && othStacked == array;
				var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : undefined;
				stack.set(array, other);
				stack.set(other, array);
				while (++index < arrLength) {
					var arrValue = array[index], othValue = other[index];
					if (customizer) var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
					if (compared !== undefined) {
						if (compared) continue;
						result = false;
						break;
					}
					if (seen) {
						if (!arraySome(other, function(othValue, othIndex) {
							if (!cacheHas(seen, othIndex) && (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) return seen.push(othIndex);
						})) {
							result = false;
							break;
						}
					} else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
						result = false;
						break;
					}
				}
				stack["delete"](array);
				stack["delete"](other);
				return result;
			}
			/**
			* A specialized version of `baseIsEqualDeep` for comparing objects of
			* the same `toStringTag`.
			*
			* **Note:** This function only supports comparing values with tags of
			* `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
			*
			* @private
			* @param {Object} object The object to compare.
			* @param {Object} other The other object to compare.
			* @param {string} tag The `toStringTag` of the objects to compare.
			* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
			* @param {Function} customizer The function to customize comparisons.
			* @param {Function} equalFunc The function to determine equivalents of values.
			* @param {Object} stack Tracks traversed `object` and `other` objects.
			* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
			*/
			function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
				switch (tag) {
					case dataViewTag:
						if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) return false;
						object = object.buffer;
						other = other.buffer;
					case arrayBufferTag:
						if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array(object), new Uint8Array(other))) return false;
						return true;
					case boolTag:
					case dateTag:
					case numberTag: return eq(+object, +other);
					case errorTag: return object.name == other.name && object.message == other.message;
					case regexpTag:
					case stringTag: return object == other + "";
					case mapTag: var convert = mapToArray;
					case setTag:
						var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
						convert || (convert = setToArray);
						if (object.size != other.size && !isPartial) return false;
						var stacked = stack.get(object);
						if (stacked) return stacked == other;
						bitmask |= COMPARE_UNORDERED_FLAG;
						stack.set(object, other);
						var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
						stack["delete"](object);
						return result;
					case symbolTag: if (symbolValueOf) return symbolValueOf.call(object) == symbolValueOf.call(other);
				}
				return false;
			}
			/**
			* A specialized version of `baseIsEqualDeep` for objects with support for
			* partial deep comparisons.
			*
			* @private
			* @param {Object} object The object to compare.
			* @param {Object} other The other object to compare.
			* @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
			* @param {Function} customizer The function to customize comparisons.
			* @param {Function} equalFunc The function to determine equivalents of values.
			* @param {Object} stack Tracks traversed `object` and `other` objects.
			* @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
			*/
			function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
				var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length;
				if (objLength != getAllKeys(other).length && !isPartial) return false;
				var index = objLength;
				while (index--) {
					var key = objProps[index];
					if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) return false;
				}
				var objStacked = stack.get(object);
				var othStacked = stack.get(other);
				if (objStacked && othStacked) return objStacked == other && othStacked == object;
				var result = true;
				stack.set(object, other);
				stack.set(other, object);
				var skipCtor = isPartial;
				while (++index < objLength) {
					key = objProps[index];
					var objValue = object[key], othValue = other[key];
					if (customizer) var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
					if (!(compared === undefined ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
						result = false;
						break;
					}
					skipCtor || (skipCtor = key == "constructor");
				}
				if (result && !skipCtor) {
					var objCtor = object.constructor, othCtor = other.constructor;
					if (objCtor != othCtor && "constructor" in object && "constructor" in other && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) result = false;
				}
				stack["delete"](object);
				stack["delete"](other);
				return result;
			}
			/**
			* A specialized version of `baseRest` which flattens the rest array.
			*
			* @private
			* @param {Function} func The function to apply a rest parameter to.
			* @returns {Function} Returns the new function.
			*/
			function flatRest(func) {
				return setToString(overRest(func, undefined, flatten), func + "");
			}
			/**
			* Creates an array of own enumerable property names and symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names and symbols.
			*/
			function getAllKeys(object) {
				return baseGetAllKeys(object, keys, getSymbols);
			}
			/**
			* Creates an array of own and inherited enumerable property names and
			* symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names and symbols.
			*/
			function getAllKeysIn(object) {
				return baseGetAllKeys(object, keysIn, getSymbolsIn);
			}
			/**
			* Gets metadata for `func`.
			*
			* @private
			* @param {Function} func The function to query.
			* @returns {*} Returns the metadata for `func`.
			*/
			var getData = !metaMap ? noop : function(func) {
				return metaMap.get(func);
			};
			/**
			* Gets the name of `func`.
			*
			* @private
			* @param {Function} func The function to query.
			* @returns {string} Returns the function name.
			*/
			function getFuncName(func) {
				var result = func.name + "", array = realNames[result], length = hasOwnProperty.call(realNames, result) ? array.length : 0;
				while (length--) {
					var data = array[length], otherFunc = data.func;
					if (otherFunc == null || otherFunc == func) return data.name;
				}
				return result;
			}
			/**
			* Gets the argument placeholder value for `func`.
			*
			* @private
			* @param {Function} func The function to inspect.
			* @returns {*} Returns the placeholder value.
			*/
			function getHolder(func) {
				return (hasOwnProperty.call(lodash, "placeholder") ? lodash : func).placeholder;
			}
			/**
			* Gets the appropriate "iteratee" function. If `_.iteratee` is customized,
			* this function returns the custom method, otherwise it returns `baseIteratee`.
			* If arguments are provided, the chosen function is invoked with them and
			* its result is returned.
			*
			* @private
			* @param {*} [value] The value to convert to an iteratee.
			* @param {number} [arity] The arity of the created iteratee.
			* @returns {Function} Returns the chosen function or its result.
			*/
			function getIteratee() {
				var result = lodash.iteratee || iteratee;
				result = result === iteratee ? baseIteratee : result;
				return arguments.length ? result(arguments[0], arguments[1]) : result;
			}
			/**
			* Gets the data for `map`.
			*
			* @private
			* @param {Object} map The map to query.
			* @param {string} key The reference key.
			* @returns {*} Returns the map data.
			*/
			function getMapData(map, key) {
				var data = map.__data__;
				return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
			}
			/**
			* Gets the property names, values, and compare flags of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the match data of `object`.
			*/
			function getMatchData(object) {
				var result = keys(object), length = result.length;
				while (length--) {
					var key = result[length], value = object[key];
					result[length] = [
						key,
						value,
						isStrictComparable(value)
					];
				}
				return result;
			}
			/**
			* Gets the native function at `key` of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {string} key The key of the method to get.
			* @returns {*} Returns the function if it's native, else `undefined`.
			*/
			function getNative(object, key) {
				var value = getValue(object, key);
				return baseIsNative(value) ? value : undefined;
			}
			/**
			* A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
			*
			* @private
			* @param {*} value The value to query.
			* @returns {string} Returns the raw `toStringTag`.
			*/
			function getRawTag(value) {
				var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
				try {
					value[symToStringTag] = undefined;
					var unmasked = true;
				} catch (e) {}
				var result = nativeObjectToString.call(value);
				if (unmasked) {
					if (isOwn) value[symToStringTag] = tag;
					else delete value[symToStringTag];
				}
				return result;
			}
			/**
			* Creates an array of the own enumerable symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of symbols.
			*/
			var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
				if (object == null) return [];
				object = Object(object);
				return arrayFilter(nativeGetSymbols(object), function(symbol) {
					return propertyIsEnumerable.call(object, symbol);
				});
			};
			/**
			* Creates an array of the own and inherited enumerable symbols of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of symbols.
			*/
			var getSymbolsIn = !nativeGetSymbols ? stubArray : function(object) {
				var result = [];
				while (object) {
					arrayPush(result, getSymbols(object));
					object = getPrototype(object);
				}
				return result;
			};
			/**
			* Gets the `toStringTag` of `value`.
			*
			* @private
			* @param {*} value The value to query.
			* @returns {string} Returns the `toStringTag`.
			*/
			var getTag = baseGetTag;
			if (DataView && getTag(new DataView(/* @__PURE__ */ new ArrayBuffer(1))) != dataViewTag || Map && getTag(new Map()) != mapTag || Promise && getTag(Promise.resolve()) != promiseTag || Set && getTag(new Set()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) getTag = function(value) {
				var result = baseGetTag(value), Ctor = result == objectTag ? value.constructor : undefined, ctorString = Ctor ? toSource(Ctor) : "";
				if (ctorString) switch (ctorString) {
					case dataViewCtorString: return dataViewTag;
					case mapCtorString: return mapTag;
					case promiseCtorString: return promiseTag;
					case setCtorString: return setTag;
					case weakMapCtorString: return weakMapTag;
				}
				return result;
			};
			/**
			* Gets the view, applying any `transforms` to the `start` and `end` positions.
			*
			* @private
			* @param {number} start The start of the view.
			* @param {number} end The end of the view.
			* @param {Array} transforms The transformations to apply to the view.
			* @returns {Object} Returns an object containing the `start` and `end`
			*  positions of the view.
			*/
			function getView(start, end, transforms) {
				var index = -1, length = transforms.length;
				while (++index < length) {
					var data = transforms[index], size = data.size;
					switch (data.type) {
						case "drop":
							start += size;
							break;
						case "dropRight":
							end -= size;
							break;
						case "take":
							end = nativeMin(end, start + size);
							break;
						case "takeRight": start = nativeMax(start, end - size);
					}
				}
				return {
					"start": start,
					"end": end
				};
			}
			/**
			* Extracts wrapper details from the `source` body comment.
			*
			* @private
			* @param {string} source The source to inspect.
			* @returns {Array} Returns the wrapper details.
			*/
			function getWrapDetails(source) {
				var match = source.match(reWrapDetails);
				return match ? match[1].split(reSplitDetails) : [];
			}
			/**
			* Checks if `path` exists on `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Array|string} path The path to check.
			* @param {Function} hasFunc The function to check properties.
			* @returns {boolean} Returns `true` if `path` exists, else `false`.
			*/
			function hasPath(object, path, hasFunc) {
				path = castPath(path, object);
				var index = -1, length = path.length, result = false;
				while (++index < length) {
					var key = toKey(path[index]);
					if (!(result = object != null && hasFunc(object, key))) break;
					object = object[key];
				}
				if (result || ++index != length) return result;
				length = object == null ? 0 : object.length;
				return !!length && isLength(length) && isIndex(key, length) && (isArray(object) || isArguments(object));
			}
			/**
			* Initializes an array clone.
			*
			* @private
			* @param {Array} array The array to clone.
			* @returns {Array} Returns the initialized clone.
			*/
			function initCloneArray(array) {
				var length = array.length, result = new array.constructor(length);
				if (length && typeof array[0] == "string" && hasOwnProperty.call(array, "index")) {
					result.index = array.index;
					result.input = array.input;
				}
				return result;
			}
			/**
			* Initializes an object clone.
			*
			* @private
			* @param {Object} object The object to clone.
			* @returns {Object} Returns the initialized clone.
			*/
			function initCloneObject(object) {
				return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {};
			}
			/**
			* Initializes an object clone based on its `toStringTag`.
			*
			* **Note:** This function only supports cloning values with tags of
			* `Boolean`, `Date`, `Error`, `Map`, `Number`, `RegExp`, `Set`, or `String`.
			*
			* @private
			* @param {Object} object The object to clone.
			* @param {string} tag The `toStringTag` of the object to clone.
			* @param {boolean} [isDeep] Specify a deep clone.
			* @returns {Object} Returns the initialized clone.
			*/
			function initCloneByTag(object, tag, isDeep) {
				var Ctor = object.constructor;
				switch (tag) {
					case arrayBufferTag: return cloneArrayBuffer(object);
					case boolTag:
					case dateTag: return new Ctor(+object);
					case dataViewTag: return cloneDataView(object, isDeep);
					case float32Tag:
					case float64Tag:
					case int8Tag:
					case int16Tag:
					case int32Tag:
					case uint8Tag:
					case uint8ClampedTag:
					case uint16Tag:
					case uint32Tag: return cloneTypedArray(object, isDeep);
					case mapTag: return new Ctor();
					case numberTag:
					case stringTag: return new Ctor(object);
					case regexpTag: return cloneRegExp(object);
					case setTag: return new Ctor();
					case symbolTag: return cloneSymbol(object);
				}
			}
			/**
			* Inserts wrapper `details` in a comment at the top of the `source` body.
			*
			* @private
			* @param {string} source The source to modify.
			* @returns {Array} details The details to insert.
			* @returns {string} Returns the modified source.
			*/
			function insertWrapDetails(source, details) {
				var length = details.length;
				if (!length) return source;
				var lastIndex = length - 1;
				details[lastIndex] = (length > 1 ? "& " : "") + details[lastIndex];
				details = details.join(length > 2 ? ", " : " ");
				return source.replace(reWrapComment, "{\n/* [wrapped with " + details + "] */\n");
			}
			/**
			* Checks if `value` is a flattenable `arguments` object or array.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is flattenable, else `false`.
			*/
			function isFlattenable(value) {
				return isArray(value) || isArguments(value) || !!(spreadableSymbol && value && value[spreadableSymbol]);
			}
			/**
			* Checks if `value` is a valid array-like index.
			*
			* @private
			* @param {*} value The value to check.
			* @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
			* @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
			*/
			function isIndex(value, length) {
				var type = typeof value;
				length = length == null ? MAX_SAFE_INTEGER : length;
				return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
			}
			/**
			* Checks if the given arguments are from an iteratee call.
			*
			* @private
			* @param {*} value The potential iteratee value argument.
			* @param {*} index The potential iteratee index or key argument.
			* @param {*} object The potential iteratee object argument.
			* @returns {boolean} Returns `true` if the arguments are from an iteratee call,
			*  else `false`.
			*/
			function isIterateeCall(value, index, object) {
				if (!isObject(object)) return false;
				var type = typeof index;
				if (type == "number" ? isArrayLike(object) && isIndex(index, object.length) : type == "string" && index in object) return eq(object[index], value);
				return false;
			}
			/**
			* Checks if `value` is a property name and not a property path.
			*
			* @private
			* @param {*} value The value to check.
			* @param {Object} [object] The object to query keys on.
			* @returns {boolean} Returns `true` if `value` is a property name, else `false`.
			*/
			function isKey(value, object) {
				if (isArray(value)) return false;
				var type = typeof value;
				if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) return true;
				return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object(object);
			}
			/**
			* Checks if `value` is suitable for use as unique object key.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is suitable, else `false`.
			*/
			function isKeyable(value) {
				var type = typeof value;
				return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
			}
			/**
			* Checks if `func` has a lazy counterpart.
			*
			* @private
			* @param {Function} func The function to check.
			* @returns {boolean} Returns `true` if `func` has a lazy counterpart,
			*  else `false`.
			*/
			function isLaziable(func) {
				var funcName = getFuncName(func), other = lodash[funcName];
				if (typeof other != "function" || !(funcName in LazyWrapper.prototype)) return false;
				if (func === other) return true;
				var data = getData(other);
				return !!data && func === data[0];
			}
			/**
			* Checks if `func` has its source masked.
			*
			* @private
			* @param {Function} func The function to check.
			* @returns {boolean} Returns `true` if `func` is masked, else `false`.
			*/
			function isMasked(func) {
				return !!maskSrcKey && maskSrcKey in func;
			}
			/**
			* Checks if `func` is capable of being masked.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `func` is maskable, else `false`.
			*/
			var isMaskable = coreJsData ? isFunction : stubFalse;
			/**
			* Checks if `value` is likely a prototype object.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
			*/
			function isPrototype(value) {
				var Ctor = value && value.constructor;
				return value === (typeof Ctor == "function" && Ctor.prototype || objectProto);
			}
			/**
			* Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
			*
			* @private
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` if suitable for strict
			*  equality comparisons, else `false`.
			*/
			function isStrictComparable(value) {
				return value === value && !isObject(value);
			}
			/**
			* A specialized version of `matchesProperty` for source values suitable
			* for strict equality comparisons, i.e. `===`.
			*
			* @private
			* @param {string} key The key of the property to get.
			* @param {*} srcValue The value to match.
			* @returns {Function} Returns the new spec function.
			*/
			function matchesStrictComparable(key, srcValue) {
				return function(object) {
					if (object == null) return false;
					return object[key] === srcValue && (srcValue !== undefined || key in Object(object));
				};
			}
			/**
			* A specialized version of `_.memoize` which clears the memoized function's
			* cache when it exceeds `MAX_MEMOIZE_SIZE`.
			*
			* @private
			* @param {Function} func The function to have its output memoized.
			* @returns {Function} Returns the new memoized function.
			*/
			function memoizeCapped(func) {
				var result = memoize(func, function(key) {
					if (cache.size === MAX_MEMOIZE_SIZE) cache.clear();
					return key;
				});
				var cache = result.cache;
				return result;
			}
			/**
			* Merges the function metadata of `source` into `data`.
			*
			* Merging metadata reduces the number of wrappers used to invoke a function.
			* This is possible because methods like `_.bind`, `_.curry`, and `_.partial`
			* may be applied regardless of execution order. Methods like `_.ary` and
			* `_.rearg` modify function arguments, making the order in which they are
			* executed important, preventing the merging of metadata. However, we make
			* an exception for a safe combined case where curried functions have `_.ary`
			* and or `_.rearg` applied.
			*
			* @private
			* @param {Array} data The destination metadata.
			* @param {Array} source The source metadata.
			* @returns {Array} Returns `data`.
			*/
			function mergeData(data, source) {
				var bitmask = data[1], srcBitmask = source[1], newBitmask = bitmask | srcBitmask, isCommon = newBitmask < (WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG | WRAP_ARY_FLAG);
				var isCombo = srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_CURRY_FLAG || srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_REARG_FLAG && data[7].length <= source[8] || srcBitmask == (WRAP_ARY_FLAG | WRAP_REARG_FLAG) && source[7].length <= source[8] && bitmask == WRAP_CURRY_FLAG;
				if (!(isCommon || isCombo)) return data;
				if (srcBitmask & WRAP_BIND_FLAG) {
					data[2] = source[2];
					newBitmask |= bitmask & WRAP_BIND_FLAG ? 0 : WRAP_CURRY_BOUND_FLAG;
				}
				var value = source[3];
				if (value) {
					var partials = data[3];
					data[3] = partials ? composeArgs(partials, value, source[4]) : value;
					data[4] = partials ? replaceHolders(data[3], PLACEHOLDER) : source[4];
				}
				value = source[5];
				if (value) {
					partials = data[5];
					data[5] = partials ? composeArgsRight(partials, value, source[6]) : value;
					data[6] = partials ? replaceHolders(data[5], PLACEHOLDER) : source[6];
				}
				value = source[7];
				if (value) data[7] = value;
				if (srcBitmask & WRAP_ARY_FLAG) data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
				if (data[9] == null) data[9] = source[9];
				data[0] = source[0];
				data[1] = newBitmask;
				return data;
			}
			/**
			* This function is like
			* [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
			* except that it includes inherited enumerable properties.
			*
			* @private
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			*/
			function nativeKeysIn(object) {
				var result = [];
				if (object != null) for (var key in Object(object)) result.push(key);
				return result;
			}
			/**
			* Converts `value` to a string using `Object.prototype.toString`.
			*
			* @private
			* @param {*} value The value to convert.
			* @returns {string} Returns the converted string.
			*/
			function objectToString(value) {
				return nativeObjectToString.call(value);
			}
			/**
			* A specialized version of `baseRest` which transforms the rest array.
			*
			* @private
			* @param {Function} func The function to apply a rest parameter to.
			* @param {number} [start=func.length-1] The start position of the rest parameter.
			* @param {Function} transform The rest array transform.
			* @returns {Function} Returns the new function.
			*/
			function overRest(func, start, transform) {
				start = nativeMax(start === undefined ? func.length - 1 : start, 0);
				return function() {
					var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array(length);
					while (++index < length) array[index] = args[start + index];
					index = -1;
					var otherArgs = Array(start + 1);
					while (++index < start) otherArgs[index] = args[index];
					otherArgs[start] = transform(array);
					return apply(func, this, otherArgs);
				};
			}
			/**
			* Gets the parent value at `path` of `object`.
			*
			* @private
			* @param {Object} object The object to query.
			* @param {Array} path The path to get the parent value of.
			* @returns {*} Returns the parent value.
			*/
			function parent(object, path) {
				return path.length < 2 ? object : baseGet(object, baseSlice(path, 0, -1));
			}
			/**
			* Reorder `array` according to the specified indexes where the element at
			* the first index is assigned as the first element, the element at
			* the second index is assigned as the second element, and so on.
			*
			* @private
			* @param {Array} array The array to reorder.
			* @param {Array} indexes The arranged array indexes.
			* @returns {Array} Returns `array`.
			*/
			function reorder(array, indexes) {
				var arrLength = array.length, length = nativeMin(indexes.length, arrLength), oldArray = copyArray(array);
				while (length--) {
					var index = indexes[length];
					array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
				}
				return array;
			}
			/**
			* Gets the value at `key`, unless `key` is "__proto__" or "constructor".
			*
			* @private
			* @param {Object} object The object to query.
			* @param {string} key The key of the property to get.
			* @returns {*} Returns the property value.
			*/
			function safeGet(object, key) {
				if (key === "constructor" && typeof object[key] === "function") return;
				if (key == "__proto__") return;
				return object[key];
			}
			/**
			* Sets metadata for `func`.
			*
			* **Note:** If this function becomes hot, i.e. is invoked a lot in a short
			* period of time, it will trip its breaker and transition to an identity
			* function to avoid garbage collection pauses in V8. See
			* [V8 issue 2070](https://bugs.chromium.org/p/v8/issues/detail?id=2070)
			* for more details.
			*
			* @private
			* @param {Function} func The function to associate metadata with.
			* @param {*} data The metadata.
			* @returns {Function} Returns `func`.
			*/
			var setData = shortOut(baseSetData);
			/**
			* A simple wrapper around the global [`setTimeout`](https://mdn.io/setTimeout).
			*
			* @private
			* @param {Function} func The function to delay.
			* @param {number} wait The number of milliseconds to delay invocation.
			* @returns {number|Object} Returns the timer id or timeout object.
			*/
			var setTimeout = ctxSetTimeout || function(func, wait) {
				return root.setTimeout(func, wait);
			};
			/**
			* Sets the `toString` method of `func` to return `string`.
			*
			* @private
			* @param {Function} func The function to modify.
			* @param {Function} string The `toString` result.
			* @returns {Function} Returns `func`.
			*/
			var setToString = shortOut(baseSetToString);
			/**
			* Sets the `toString` method of `wrapper` to mimic the source of `reference`
			* with wrapper details in a comment at the top of the source body.
			*
			* @private
			* @param {Function} wrapper The function to modify.
			* @param {Function} reference The reference function.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @returns {Function} Returns `wrapper`.
			*/
			function setWrapToString(wrapper, reference, bitmask) {
				var source = reference + "";
				return setToString(wrapper, insertWrapDetails(source, updateWrapDetails(getWrapDetails(source), bitmask)));
			}
			/**
			* Creates a function that'll short out and invoke `identity` instead
			* of `func` when it's called `HOT_COUNT` or more times in `HOT_SPAN`
			* milliseconds.
			*
			* @private
			* @param {Function} func The function to restrict.
			* @returns {Function} Returns the new shortable function.
			*/
			function shortOut(func) {
				var count = 0, lastCalled = 0;
				return function() {
					var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
					lastCalled = stamp;
					if (remaining > 0) {
						if (++count >= HOT_COUNT) return arguments[0];
					} else count = 0;
					return func.apply(undefined, arguments);
				};
			}
			/**
			* A specialized version of `_.shuffle` which mutates and sets the size of `array`.
			*
			* @private
			* @param {Array} array The array to shuffle.
			* @param {number} [size=array.length] The size of `array`.
			* @returns {Array} Returns `array`.
			*/
			function shuffleSelf(array, size) {
				var index = -1, length = array.length, lastIndex = length - 1;
				size = size === undefined ? length : size;
				while (++index < size) {
					var rand = baseRandom(index, lastIndex), value = array[rand];
					array[rand] = array[index];
					array[index] = value;
				}
				array.length = size;
				return array;
			}
			/**
			* Converts `string` to a property path array.
			*
			* @private
			* @param {string} string The string to convert.
			* @returns {Array} Returns the property path array.
			*/
			var stringToPath = memoizeCapped(function(string) {
				var result = [];
				if (string.charCodeAt(0) === 46) result.push("");
				string.replace(rePropName, function(match, number, quote, subString) {
					result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
				});
				return result;
			});
			/**
			* Converts `value` to a string key if it's not a string or symbol.
			*
			* @private
			* @param {*} value The value to inspect.
			* @returns {string|symbol} Returns the key.
			*/
			function toKey(value) {
				if (typeof value == "string" || isSymbol(value)) return value;
				var result = value + "";
				return result == "0" && 1 / value == -Infinity ? "-0" : result;
			}
			/**
			* Converts `func` to its source code.
			*
			* @private
			* @param {Function} func The function to convert.
			* @returns {string} Returns the source code.
			*/
			function toSource(func) {
				if (func != null) {
					try {
						return funcToString.call(func);
					} catch (e) {}
					try {
						return func + "";
					} catch (e) {}
				}
				return "";
			}
			/**
			* Updates wrapper `details` based on `bitmask` flags.
			*
			* @private
			* @returns {Array} details The details to modify.
			* @param {number} bitmask The bitmask flags. See `createWrap` for more details.
			* @returns {Array} Returns `details`.
			*/
			function updateWrapDetails(details, bitmask) {
				arrayEach(wrapFlags, function(pair) {
					var value = "_." + pair[0];
					if (bitmask & pair[1] && !arrayIncludes(details, value)) details.push(value);
				});
				return details.sort();
			}
			/**
			* Creates a clone of `wrapper`.
			*
			* @private
			* @param {Object} wrapper The wrapper to clone.
			* @returns {Object} Returns the cloned wrapper.
			*/
			function wrapperClone(wrapper) {
				if (wrapper instanceof LazyWrapper) return wrapper.clone();
				var result = new LodashWrapper(wrapper.__wrapped__, wrapper.__chain__);
				result.__actions__ = copyArray(wrapper.__actions__);
				result.__index__ = wrapper.__index__;
				result.__values__ = wrapper.__values__;
				return result;
			}
			/**
			* Creates an array of elements split into groups the length of `size`.
			* If `array` can't be split evenly, the final chunk will be the remaining
			* elements.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to process.
			* @param {number} [size=1] The length of each chunk
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the new array of chunks.
			* @example
			*
			* _.chunk(['a', 'b', 'c', 'd'], 2);
			* // => [['a', 'b'], ['c', 'd']]
			*
			* _.chunk(['a', 'b', 'c', 'd'], 3);
			* // => [['a', 'b', 'c'], ['d']]
			*/
			function chunk(array, size, guard) {
				if (guard ? isIterateeCall(array, size, guard) : size === undefined) size = 1;
				else size = nativeMax(toInteger(size), 0);
				var length = array == null ? 0 : array.length;
				if (!length || size < 1) return [];
				var index = 0, resIndex = 0, result = Array(nativeCeil(length / size));
				while (index < length) result[resIndex++] = baseSlice(array, index, index += size);
				return result;
			}
			/**
			* Creates an array with all falsey values removed. The values `false`, `null`,
			* `0`, `""`, `undefined`, and `NaN` are falsey.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to compact.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* _.compact([0, 1, false, 2, '', 3]);
			* // => [1, 2, 3]
			*/
			function compact(array) {
				var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
				while (++index < length) {
					var value = array[index];
					if (value) result[resIndex++] = value;
				}
				return result;
			}
			/**
			* Creates a new array concatenating `array` with any additional arrays
			* and/or values.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to concatenate.
			* @param {...*} [values] The values to concatenate.
			* @returns {Array} Returns the new concatenated array.
			* @example
			*
			* var array = [1];
			* var other = _.concat(array, 2, [3], [[4]]);
			*
			* console.log(other);
			* // => [1, 2, 3, [4]]
			*
			* console.log(array);
			* // => [1]
			*/
			function concat() {
				var length = arguments.length;
				if (!length) return [];
				var args = Array(length - 1), array = arguments[0], index = length;
				while (index--) args[index - 1] = arguments[index];
				return arrayPush(isArray(array) ? copyArray(array) : [array], baseFlatten(args, 1));
			}
			/**
			* Creates an array of `array` values not included in the other given arrays
			* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons. The order and references of result values are
			* determined by the first array.
			*
			* **Note:** Unlike `_.pullAll`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {...Array} [values] The values to exclude.
			* @returns {Array} Returns the new array of filtered values.
			* @see _.without, _.xor
			* @example
			*
			* _.difference([2, 1], [2, 3]);
			* // => [1]
			*/
			var difference = baseRest(function(array, values) {
				return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true)) : [];
			});
			/**
			* This method is like `_.difference` except that it accepts `iteratee` which
			* is invoked for each element of `array` and `values` to generate the criterion
			* by which they're compared. The order and references of result values are
			* determined by the first array. The iteratee is invoked with one argument:
			* (value).
			*
			* **Note:** Unlike `_.pullAllBy`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {...Array} [values] The values to exclude.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* _.differenceBy([2.1, 1.2], [2.3, 3.4], Math.floor);
			* // => [1.2]
			*
			* // The `_.property` iteratee shorthand.
			* _.differenceBy([{ 'x': 2 }, { 'x': 1 }], [{ 'x': 1 }], 'x');
			* // => [{ 'x': 2 }]
			*/
			var differenceBy = baseRest(function(array, values) {
				var iteratee = last(values);
				if (isArrayLikeObject(iteratee)) iteratee = undefined;
				return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true), getIteratee(iteratee, 2)) : [];
			});
			/**
			* This method is like `_.difference` except that it accepts `comparator`
			* which is invoked to compare elements of `array` to `values`. The order and
			* references of result values are determined by the first array. The comparator
			* is invoked with two arguments: (arrVal, othVal).
			*
			* **Note:** Unlike `_.pullAllWith`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {...Array} [values] The values to exclude.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
			*
			* _.differenceWith(objects, [{ 'x': 1, 'y': 2 }], _.isEqual);
			* // => [{ 'x': 2, 'y': 1 }]
			*/
			var differenceWith = baseRest(function(array, values) {
				var comparator = last(values);
				if (isArrayLikeObject(comparator)) comparator = undefined;
				return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true), undefined, comparator) : [];
			});
			/**
			* Creates a slice of `array` with `n` elements dropped from the beginning.
			*
			* @static
			* @memberOf _
			* @since 0.5.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=1] The number of elements to drop.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.drop([1, 2, 3]);
			* // => [2, 3]
			*
			* _.drop([1, 2, 3], 2);
			* // => [3]
			*
			* _.drop([1, 2, 3], 5);
			* // => []
			*
			* _.drop([1, 2, 3], 0);
			* // => [1, 2, 3]
			*/
			function drop(array, n, guard) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				n = guard || n === undefined ? 1 : toInteger(n);
				return baseSlice(array, n < 0 ? 0 : n, length);
			}
			/**
			* Creates a slice of `array` with `n` elements dropped from the end.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=1] The number of elements to drop.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.dropRight([1, 2, 3]);
			* // => [1, 2]
			*
			* _.dropRight([1, 2, 3], 2);
			* // => [1]
			*
			* _.dropRight([1, 2, 3], 5);
			* // => []
			*
			* _.dropRight([1, 2, 3], 0);
			* // => [1, 2, 3]
			*/
			function dropRight(array, n, guard) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				n = guard || n === undefined ? 1 : toInteger(n);
				n = length - n;
				return baseSlice(array, 0, n < 0 ? 0 : n);
			}
			/**
			* Creates a slice of `array` excluding elements dropped from the end.
			* Elements are dropped until `predicate` returns falsey. The predicate is
			* invoked with three arguments: (value, index, array).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': true },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': false }
			* ];
			*
			* _.dropRightWhile(users, function(o) { return !o.active; });
			* // => objects for ['barney']
			*
			* // The `_.matches` iteratee shorthand.
			* _.dropRightWhile(users, { 'user': 'pebbles', 'active': false });
			* // => objects for ['barney', 'fred']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.dropRightWhile(users, ['active', false]);
			* // => objects for ['barney']
			*
			* // The `_.property` iteratee shorthand.
			* _.dropRightWhile(users, 'active');
			* // => objects for ['barney', 'fred', 'pebbles']
			*/
			function dropRightWhile(array, predicate) {
				return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true, true) : [];
			}
			/**
			* Creates a slice of `array` excluding elements dropped from the beginning.
			* Elements are dropped until `predicate` returns falsey. The predicate is
			* invoked with three arguments: (value, index, array).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': false },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': true }
			* ];
			*
			* _.dropWhile(users, function(o) { return !o.active; });
			* // => objects for ['pebbles']
			*
			* // The `_.matches` iteratee shorthand.
			* _.dropWhile(users, { 'user': 'barney', 'active': false });
			* // => objects for ['fred', 'pebbles']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.dropWhile(users, ['active', false]);
			* // => objects for ['pebbles']
			*
			* // The `_.property` iteratee shorthand.
			* _.dropWhile(users, 'active');
			* // => objects for ['barney', 'fred', 'pebbles']
			*/
			function dropWhile(array, predicate) {
				return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true) : [];
			}
			/**
			* Fills elements of `array` with `value` from `start` up to, but not
			* including, `end`.
			*
			* **Note:** This method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 3.2.0
			* @category Array
			* @param {Array} array The array to fill.
			* @param {*} value The value to fill `array` with.
			* @param {number} [start=0] The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = [1, 2, 3];
			*
			* _.fill(array, 'a');
			* console.log(array);
			* // => ['a', 'a', 'a']
			*
			* _.fill(Array(3), 2);
			* // => [2, 2, 2]
			*
			* _.fill([4, 6, 8, 10], '*', 1, 3);
			* // => [4, '*', '*', 10]
			*/
			function fill(array, value, start, end) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				if (start && typeof start != "number" && isIterateeCall(array, value, start)) {
					start = 0;
					end = length;
				}
				return baseFill(array, value, start, end);
			}
			/**
			* This method is like `_.find` except that it returns the index of the first
			* element `predicate` returns truthy for instead of the element itself.
			*
			* @static
			* @memberOf _
			* @since 1.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param {number} [fromIndex=0] The index to search from.
			* @returns {number} Returns the index of the found element, else `-1`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': false },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': true }
			* ];
			*
			* _.findIndex(users, function(o) { return o.user == 'barney'; });
			* // => 0
			*
			* // The `_.matches` iteratee shorthand.
			* _.findIndex(users, { 'user': 'fred', 'active': false });
			* // => 1
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.findIndex(users, ['active', false]);
			* // => 0
			*
			* // The `_.property` iteratee shorthand.
			* _.findIndex(users, 'active');
			* // => 2
			*/
			function findIndex(array, predicate, fromIndex) {
				var length = array == null ? 0 : array.length;
				if (!length) return -1;
				var index = fromIndex == null ? 0 : toInteger(fromIndex);
				if (index < 0) index = nativeMax(length + index, 0);
				return baseFindIndex(array, getIteratee(predicate, 3), index);
			}
			/**
			* This method is like `_.findIndex` except that it iterates over elements
			* of `collection` from right to left.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param {number} [fromIndex=array.length-1] The index to search from.
			* @returns {number} Returns the index of the found element, else `-1`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': true },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': false }
			* ];
			*
			* _.findLastIndex(users, function(o) { return o.user == 'pebbles'; });
			* // => 2
			*
			* // The `_.matches` iteratee shorthand.
			* _.findLastIndex(users, { 'user': 'barney', 'active': true });
			* // => 0
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.findLastIndex(users, ['active', false]);
			* // => 2
			*
			* // The `_.property` iteratee shorthand.
			* _.findLastIndex(users, 'active');
			* // => 0
			*/
			function findLastIndex(array, predicate, fromIndex) {
				var length = array == null ? 0 : array.length;
				if (!length) return -1;
				var index = length - 1;
				if (fromIndex !== undefined) {
					index = toInteger(fromIndex);
					index = fromIndex < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
				}
				return baseFindIndex(array, getIteratee(predicate, 3), index, true);
			}
			/**
			* Flattens `array` a single level deep.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to flatten.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* _.flatten([1, [2, [3, [4]], 5]]);
			* // => [1, 2, [3, [4]], 5]
			*/
			function flatten(array) {
				return (array == null ? 0 : array.length) ? baseFlatten(array, 1) : [];
			}
			/**
			* Recursively flattens `array`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to flatten.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* _.flattenDeep([1, [2, [3, [4]], 5]]);
			* // => [1, 2, 3, 4, 5]
			*/
			function flattenDeep(array) {
				return (array == null ? 0 : array.length) ? baseFlatten(array, INFINITY) : [];
			}
			/**
			* Recursively flatten `array` up to `depth` times.
			*
			* @static
			* @memberOf _
			* @since 4.4.0
			* @category Array
			* @param {Array} array The array to flatten.
			* @param {number} [depth=1] The maximum recursion depth.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* var array = [1, [2, [3, [4]], 5]];
			*
			* _.flattenDepth(array, 1);
			* // => [1, 2, [3, [4]], 5]
			*
			* _.flattenDepth(array, 2);
			* // => [1, 2, 3, [4], 5]
			*/
			function flattenDepth(array, depth) {
				if (!(array == null ? 0 : array.length)) return [];
				depth = depth === undefined ? 1 : toInteger(depth);
				return baseFlatten(array, depth);
			}
			/**
			* The inverse of `_.toPairs`; this method returns an object composed
			* from key-value `pairs`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} pairs The key-value pairs.
			* @returns {Object} Returns the new object.
			* @example
			*
			* _.fromPairs([['a', 1], ['b', 2]]);
			* // => { 'a': 1, 'b': 2 }
			*/
			function fromPairs(pairs) {
				var index = -1, length = pairs == null ? 0 : pairs.length, result = {};
				while (++index < length) {
					var pair = pairs[index];
					result[pair[0]] = pair[1];
				}
				return result;
			}
			/**
			* Gets the first element of `array`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @alias first
			* @category Array
			* @param {Array} array The array to query.
			* @returns {*} Returns the first element of `array`.
			* @example
			*
			* _.head([1, 2, 3]);
			* // => 1
			*
			* _.head([]);
			* // => undefined
			*/
			function head(array) {
				return array && array.length ? array[0] : undefined;
			}
			/**
			* Gets the index at which the first occurrence of `value` is found in `array`
			* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons. If `fromIndex` is negative, it's used as the
			* offset from the end of `array`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {*} value The value to search for.
			* @param {number} [fromIndex=0] The index to search from.
			* @returns {number} Returns the index of the matched value, else `-1`.
			* @example
			*
			* _.indexOf([1, 2, 1, 2], 2);
			* // => 1
			*
			* // Search from the `fromIndex`.
			* _.indexOf([1, 2, 1, 2], 2, 2);
			* // => 3
			*/
			function indexOf(array, value, fromIndex) {
				var length = array == null ? 0 : array.length;
				if (!length) return -1;
				var index = fromIndex == null ? 0 : toInteger(fromIndex);
				if (index < 0) index = nativeMax(length + index, 0);
				return baseIndexOf(array, value, index);
			}
			/**
			* Gets all but the last element of `array`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to query.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.initial([1, 2, 3]);
			* // => [1, 2]
			*/
			function initial(array) {
				return (array == null ? 0 : array.length) ? baseSlice(array, 0, -1) : [];
			}
			/**
			* Creates an array of unique values that are included in all given arrays
			* using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons. The order and references of result values are
			* determined by the first array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @returns {Array} Returns the new array of intersecting values.
			* @example
			*
			* _.intersection([2, 1], [2, 3]);
			* // => [2]
			*/
			var intersection = baseRest(function(arrays) {
				var mapped = arrayMap(arrays, castArrayLikeObject);
				return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped) : [];
			});
			/**
			* This method is like `_.intersection` except that it accepts `iteratee`
			* which is invoked for each element of each `arrays` to generate the criterion
			* by which they're compared. The order and references of result values are
			* determined by the first array. The iteratee is invoked with one argument:
			* (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new array of intersecting values.
			* @example
			*
			* _.intersectionBy([2.1, 1.2], [2.3, 3.4], Math.floor);
			* // => [2.1]
			*
			* // The `_.property` iteratee shorthand.
			* _.intersectionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
			* // => [{ 'x': 1 }]
			*/
			var intersectionBy = baseRest(function(arrays) {
				var iteratee = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
				if (iteratee === last(mapped)) iteratee = undefined;
				else mapped.pop();
				return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, getIteratee(iteratee, 2)) : [];
			});
			/**
			* This method is like `_.intersection` except that it accepts `comparator`
			* which is invoked to compare elements of `arrays`. The order and references
			* of result values are determined by the first array. The comparator is
			* invoked with two arguments: (arrVal, othVal).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of intersecting values.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
			* var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
			*
			* _.intersectionWith(objects, others, _.isEqual);
			* // => [{ 'x': 1, 'y': 2 }]
			*/
			var intersectionWith = baseRest(function(arrays) {
				var comparator = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
				comparator = typeof comparator == "function" ? comparator : undefined;
				if (comparator) mapped.pop();
				return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, undefined, comparator) : [];
			});
			/**
			* Converts all elements in `array` into a string separated by `separator`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to convert.
			* @param {string} [separator=','] The element separator.
			* @returns {string} Returns the joined string.
			* @example
			*
			* _.join(['a', 'b', 'c'], '~');
			* // => 'a~b~c'
			*/
			function join(array, separator) {
				return array == null ? "" : nativeJoin.call(array, separator);
			}
			/**
			* Gets the last element of `array`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to query.
			* @returns {*} Returns the last element of `array`.
			* @example
			*
			* _.last([1, 2, 3]);
			* // => 3
			*/
			function last(array) {
				var length = array == null ? 0 : array.length;
				return length ? array[length - 1] : undefined;
			}
			/**
			* This method is like `_.indexOf` except that it iterates over elements of
			* `array` from right to left.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {*} value The value to search for.
			* @param {number} [fromIndex=array.length-1] The index to search from.
			* @returns {number} Returns the index of the matched value, else `-1`.
			* @example
			*
			* _.lastIndexOf([1, 2, 1, 2], 2);
			* // => 3
			*
			* // Search from the `fromIndex`.
			* _.lastIndexOf([1, 2, 1, 2], 2, 2);
			* // => 1
			*/
			function lastIndexOf(array, value, fromIndex) {
				var length = array == null ? 0 : array.length;
				if (!length) return -1;
				var index = length;
				if (fromIndex !== undefined) {
					index = toInteger(fromIndex);
					index = index < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
				}
				return value === value ? strictLastIndexOf(array, value, index) : baseFindIndex(array, baseIsNaN, index, true);
			}
			/**
			* Gets the element at index `n` of `array`. If `n` is negative, the nth
			* element from the end is returned.
			*
			* @static
			* @memberOf _
			* @since 4.11.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=0] The index of the element to return.
			* @returns {*} Returns the nth element of `array`.
			* @example
			*
			* var array = ['a', 'b', 'c', 'd'];
			*
			* _.nth(array, 1);
			* // => 'b'
			*
			* _.nth(array, -2);
			* // => 'c';
			*/
			function nth(array, n) {
				return array && array.length ? baseNth(array, toInteger(n)) : undefined;
			}
			/**
			* Removes all given values from `array` using
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons.
			*
			* **Note:** Unlike `_.without`, this method mutates `array`. Use `_.remove`
			* to remove elements from an array by predicate.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {...*} [values] The values to remove.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = ['a', 'b', 'c', 'a', 'b', 'c'];
			*
			* _.pull(array, 'a', 'c');
			* console.log(array);
			* // => ['b', 'b']
			*/
			var pull = baseRest(pullAll);
			/**
			* This method is like `_.pull` except that it accepts an array of values to remove.
			*
			* **Note:** Unlike `_.difference`, this method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {Array} values The values to remove.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = ['a', 'b', 'c', 'a', 'b', 'c'];
			*
			* _.pullAll(array, ['a', 'c']);
			* console.log(array);
			* // => ['b', 'b']
			*/
			function pullAll(array, values) {
				return array && array.length && values && values.length ? basePullAll(array, values) : array;
			}
			/**
			* This method is like `_.pullAll` except that it accepts `iteratee` which is
			* invoked for each element of `array` and `values` to generate the criterion
			* by which they're compared. The iteratee is invoked with one argument: (value).
			*
			* **Note:** Unlike `_.differenceBy`, this method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {Array} values The values to remove.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = [{ 'x': 1 }, { 'x': 2 }, { 'x': 3 }, { 'x': 1 }];
			*
			* _.pullAllBy(array, [{ 'x': 1 }, { 'x': 3 }], 'x');
			* console.log(array);
			* // => [{ 'x': 2 }]
			*/
			function pullAllBy(array, values, iteratee) {
				return array && array.length && values && values.length ? basePullAll(array, values, getIteratee(iteratee, 2)) : array;
			}
			/**
			* This method is like `_.pullAll` except that it accepts `comparator` which
			* is invoked to compare elements of `array` to `values`. The comparator is
			* invoked with two arguments: (arrVal, othVal).
			*
			* **Note:** Unlike `_.differenceWith`, this method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 4.6.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {Array} values The values to remove.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = [{ 'x': 1, 'y': 2 }, { 'x': 3, 'y': 4 }, { 'x': 5, 'y': 6 }];
			*
			* _.pullAllWith(array, [{ 'x': 3, 'y': 4 }], _.isEqual);
			* console.log(array);
			* // => [{ 'x': 1, 'y': 2 }, { 'x': 5, 'y': 6 }]
			*/
			function pullAllWith(array, values, comparator) {
				return array && array.length && values && values.length ? basePullAll(array, values, undefined, comparator) : array;
			}
			/**
			* Removes elements from `array` corresponding to `indexes` and returns an
			* array of removed elements.
			*
			* **Note:** Unlike `_.at`, this method mutates `array`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {...(number|number[])} [indexes] The indexes of elements to remove.
			* @returns {Array} Returns the new array of removed elements.
			* @example
			*
			* var array = ['a', 'b', 'c', 'd'];
			* var pulled = _.pullAt(array, [1, 3]);
			*
			* console.log(array);
			* // => ['a', 'c']
			*
			* console.log(pulled);
			* // => ['b', 'd']
			*/
			var pullAt = flatRest(function(array, indexes) {
				var length = array == null ? 0 : array.length, result = baseAt(array, indexes);
				basePullAt(array, arrayMap(indexes, function(index) {
					return isIndex(index, length) ? +index : index;
				}).sort(compareAscending));
				return result;
			});
			/**
			* Removes all elements from `array` that `predicate` returns truthy for
			* and returns an array of the removed elements. The predicate is invoked
			* with three arguments: (value, index, array).
			*
			* **Note:** Unlike `_.filter`, this method mutates `array`. Use `_.pull`
			* to pull elements from an array by value.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new array of removed elements.
			* @example
			*
			* var array = [1, 2, 3, 4];
			* var evens = _.remove(array, function(n) {
			*   return n % 2 == 0;
			* });
			*
			* console.log(array);
			* // => [1, 3]
			*
			* console.log(evens);
			* // => [2, 4]
			*/
			function remove(array, predicate) {
				var result = [];
				if (!(array && array.length)) return result;
				var index = -1, indexes = [], length = array.length;
				predicate = getIteratee(predicate, 3);
				while (++index < length) {
					var value = array[index];
					if (predicate(value, index, array)) {
						result.push(value);
						indexes.push(index);
					}
				}
				basePullAt(array, indexes);
				return result;
			}
			/**
			* Reverses `array` so that the first element becomes the last, the second
			* element becomes the second to last, and so on.
			*
			* **Note:** This method mutates `array` and is based on
			* [`Array#reverse`](https://mdn.io/Array/reverse).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to modify.
			* @returns {Array} Returns `array`.
			* @example
			*
			* var array = [1, 2, 3];
			*
			* _.reverse(array);
			* // => [3, 2, 1]
			*
			* console.log(array);
			* // => [3, 2, 1]
			*/
			function reverse(array) {
				return array == null ? array : nativeReverse.call(array);
			}
			/**
			* Creates a slice of `array` from `start` up to, but not including, `end`.
			*
			* **Note:** This method is used instead of
			* [`Array#slice`](https://mdn.io/Array/slice) to ensure dense arrays are
			* returned.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to slice.
			* @param {number} [start=0] The start position.
			* @param {number} [end=array.length] The end position.
			* @returns {Array} Returns the slice of `array`.
			*/
			function slice(array, start, end) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				if (end && typeof end != "number" && isIterateeCall(array, start, end)) {
					start = 0;
					end = length;
				} else {
					start = start == null ? 0 : toInteger(start);
					end = end === undefined ? length : toInteger(end);
				}
				return baseSlice(array, start, end);
			}
			/**
			* Uses a binary search to determine the lowest index at which `value`
			* should be inserted into `array` in order to maintain its sort order.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			* @example
			*
			* _.sortedIndex([30, 50], 40);
			* // => 1
			*/
			function sortedIndex(array, value) {
				return baseSortedIndex(array, value);
			}
			/**
			* This method is like `_.sortedIndex` except that it accepts `iteratee`
			* which is invoked for `value` and each element of `array` to compute their
			* sort ranking. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			* @example
			*
			* var objects = [{ 'x': 4 }, { 'x': 5 }];
			*
			* _.sortedIndexBy(objects, { 'x': 4 }, function(o) { return o.x; });
			* // => 0
			*
			* // The `_.property` iteratee shorthand.
			* _.sortedIndexBy(objects, { 'x': 4 }, 'x');
			* // => 0
			*/
			function sortedIndexBy(array, value, iteratee) {
				return baseSortedIndexBy(array, value, getIteratee(iteratee, 2));
			}
			/**
			* This method is like `_.indexOf` except that it performs a binary
			* search on a sorted `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {*} value The value to search for.
			* @returns {number} Returns the index of the matched value, else `-1`.
			* @example
			*
			* _.sortedIndexOf([4, 5, 5, 5, 6], 5);
			* // => 1
			*/
			function sortedIndexOf(array, value) {
				var length = array == null ? 0 : array.length;
				if (length) {
					var index = baseSortedIndex(array, value);
					if (index < length && eq(array[index], value)) return index;
				}
				return -1;
			}
			/**
			* This method is like `_.sortedIndex` except that it returns the highest
			* index at which `value` should be inserted into `array` in order to
			* maintain its sort order.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			* @example
			*
			* _.sortedLastIndex([4, 5, 5, 5, 6], 5);
			* // => 4
			*/
			function sortedLastIndex(array, value) {
				return baseSortedIndex(array, value, true);
			}
			/**
			* This method is like `_.sortedLastIndex` except that it accepts `iteratee`
			* which is invoked for `value` and each element of `array` to compute their
			* sort ranking. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The sorted array to inspect.
			* @param {*} value The value to evaluate.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {number} Returns the index at which `value` should be inserted
			*  into `array`.
			* @example
			*
			* var objects = [{ 'x': 4 }, { 'x': 5 }];
			*
			* _.sortedLastIndexBy(objects, { 'x': 4 }, function(o) { return o.x; });
			* // => 1
			*
			* // The `_.property` iteratee shorthand.
			* _.sortedLastIndexBy(objects, { 'x': 4 }, 'x');
			* // => 1
			*/
			function sortedLastIndexBy(array, value, iteratee) {
				return baseSortedIndexBy(array, value, getIteratee(iteratee, 2), true);
			}
			/**
			* This method is like `_.lastIndexOf` except that it performs a binary
			* search on a sorted `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {*} value The value to search for.
			* @returns {number} Returns the index of the matched value, else `-1`.
			* @example
			*
			* _.sortedLastIndexOf([4, 5, 5, 5, 6], 5);
			* // => 3
			*/
			function sortedLastIndexOf(array, value) {
				if (array == null ? 0 : array.length) {
					var index = baseSortedIndex(array, value, true) - 1;
					if (eq(array[index], value)) return index;
				}
				return -1;
			}
			/**
			* This method is like `_.uniq` except that it's designed and optimized
			* for sorted arrays.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* _.sortedUniq([1, 1, 2]);
			* // => [1, 2]
			*/
			function sortedUniq(array) {
				return array && array.length ? baseSortedUniq(array) : [];
			}
			/**
			* This method is like `_.uniqBy` except that it's designed and optimized
			* for sorted arrays.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [iteratee] The iteratee invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* _.sortedUniqBy([1.1, 1.2, 2.3, 2.4], Math.floor);
			* // => [1.1, 2.3]
			*/
			function sortedUniqBy(array, iteratee) {
				return array && array.length ? baseSortedUniq(array, getIteratee(iteratee, 2)) : [];
			}
			/**
			* Gets all but the first element of `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.tail([1, 2, 3]);
			* // => [2, 3]
			*/
			function tail(array) {
				var length = array == null ? 0 : array.length;
				return length ? baseSlice(array, 1, length) : [];
			}
			/**
			* Creates a slice of `array` with `n` elements taken from the beginning.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=1] The number of elements to take.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.take([1, 2, 3]);
			* // => [1]
			*
			* _.take([1, 2, 3], 2);
			* // => [1, 2]
			*
			* _.take([1, 2, 3], 5);
			* // => [1, 2, 3]
			*
			* _.take([1, 2, 3], 0);
			* // => []
			*/
			function take(array, n, guard) {
				if (!(array && array.length)) return [];
				n = guard || n === undefined ? 1 : toInteger(n);
				return baseSlice(array, 0, n < 0 ? 0 : n);
			}
			/**
			* Creates a slice of `array` with `n` elements taken from the end.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {number} [n=1] The number of elements to take.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* _.takeRight([1, 2, 3]);
			* // => [3]
			*
			* _.takeRight([1, 2, 3], 2);
			* // => [2, 3]
			*
			* _.takeRight([1, 2, 3], 5);
			* // => [1, 2, 3]
			*
			* _.takeRight([1, 2, 3], 0);
			* // => []
			*/
			function takeRight(array, n, guard) {
				var length = array == null ? 0 : array.length;
				if (!length) return [];
				n = guard || n === undefined ? 1 : toInteger(n);
				n = length - n;
				return baseSlice(array, n < 0 ? 0 : n, length);
			}
			/**
			* Creates a slice of `array` with elements taken from the end. Elements are
			* taken until `predicate` returns falsey. The predicate is invoked with
			* three arguments: (value, index, array).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': true },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': false }
			* ];
			*
			* _.takeRightWhile(users, function(o) { return !o.active; });
			* // => objects for ['fred', 'pebbles']
			*
			* // The `_.matches` iteratee shorthand.
			* _.takeRightWhile(users, { 'user': 'pebbles', 'active': false });
			* // => objects for ['pebbles']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.takeRightWhile(users, ['active', false]);
			* // => objects for ['fred', 'pebbles']
			*
			* // The `_.property` iteratee shorthand.
			* _.takeRightWhile(users, 'active');
			* // => []
			*/
			function takeRightWhile(array, predicate) {
				return array && array.length ? baseWhile(array, getIteratee(predicate, 3), false, true) : [];
			}
			/**
			* Creates a slice of `array` with elements taken from the beginning. Elements
			* are taken until `predicate` returns falsey. The predicate is invoked with
			* three arguments: (value, index, array).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Array
			* @param {Array} array The array to query.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the slice of `array`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'active': false },
			*   { 'user': 'fred',    'active': false },
			*   { 'user': 'pebbles', 'active': true }
			* ];
			*
			* _.takeWhile(users, function(o) { return !o.active; });
			* // => objects for ['barney', 'fred']
			*
			* // The `_.matches` iteratee shorthand.
			* _.takeWhile(users, { 'user': 'barney', 'active': false });
			* // => objects for ['barney']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.takeWhile(users, ['active', false]);
			* // => objects for ['barney', 'fred']
			*
			* // The `_.property` iteratee shorthand.
			* _.takeWhile(users, 'active');
			* // => []
			*/
			function takeWhile(array, predicate) {
				return array && array.length ? baseWhile(array, getIteratee(predicate, 3)) : [];
			}
			/**
			* Creates an array of unique values, in order, from all given arrays using
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @returns {Array} Returns the new array of combined values.
			* @example
			*
			* _.union([2], [1, 2]);
			* // => [2, 1]
			*/
			var union = baseRest(function(arrays) {
				return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true));
			});
			/**
			* This method is like `_.union` except that it accepts `iteratee` which is
			* invoked for each element of each `arrays` to generate the criterion by
			* which uniqueness is computed. Result values are chosen from the first
			* array in which the value occurs. The iteratee is invoked with one argument:
			* (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new array of combined values.
			* @example
			*
			* _.unionBy([2.1], [1.2, 2.3], Math.floor);
			* // => [2.1, 1.2]
			*
			* // The `_.property` iteratee shorthand.
			* _.unionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
			* // => [{ 'x': 1 }, { 'x': 2 }]
			*/
			var unionBy = baseRest(function(arrays) {
				var iteratee = last(arrays);
				if (isArrayLikeObject(iteratee)) iteratee = undefined;
				return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), getIteratee(iteratee, 2));
			});
			/**
			* This method is like `_.union` except that it accepts `comparator` which
			* is invoked to compare elements of `arrays`. Result values are chosen from
			* the first array in which the value occurs. The comparator is invoked
			* with two arguments: (arrVal, othVal).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of combined values.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
			* var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
			*
			* _.unionWith(objects, others, _.isEqual);
			* // => [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }, { 'x': 1, 'y': 1 }]
			*/
			var unionWith = baseRest(function(arrays) {
				var comparator = last(arrays);
				comparator = typeof comparator == "function" ? comparator : undefined;
				return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), undefined, comparator);
			});
			/**
			* Creates a duplicate-free version of an array, using
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons, in which only the first occurrence of each element
			* is kept. The order of result values is determined by the order they occur
			* in the array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* _.uniq([2, 1, 2]);
			* // => [2, 1]
			*/
			function uniq(array) {
				return array && array.length ? baseUniq(array) : [];
			}
			/**
			* This method is like `_.uniq` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the criterion by which
			* uniqueness is computed. The order of result values is determined by the
			* order they occur in the array. The iteratee is invoked with one argument:
			* (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* _.uniqBy([2.1, 1.2, 2.3], Math.floor);
			* // => [2.1, 1.2]
			*
			* // The `_.property` iteratee shorthand.
			* _.uniqBy([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
			* // => [{ 'x': 1 }, { 'x': 2 }]
			*/
			function uniqBy(array, iteratee) {
				return array && array.length ? baseUniq(array, getIteratee(iteratee, 2)) : [];
			}
			/**
			* This method is like `_.uniq` except that it accepts `comparator` which
			* is invoked to compare elements of `array`. The order of result values is
			* determined by the order they occur in the array.The comparator is invoked
			* with two arguments: (arrVal, othVal).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new duplicate free array.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }, { 'x': 1, 'y': 2 }];
			*
			* _.uniqWith(objects, _.isEqual);
			* // => [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }]
			*/
			function uniqWith(array, comparator) {
				comparator = typeof comparator == "function" ? comparator : undefined;
				return array && array.length ? baseUniq(array, undefined, comparator) : [];
			}
			/**
			* This method is like `_.zip` except that it accepts an array of grouped
			* elements and creates an array regrouping the elements to their pre-zip
			* configuration.
			*
			* @static
			* @memberOf _
			* @since 1.2.0
			* @category Array
			* @param {Array} array The array of grouped elements to process.
			* @returns {Array} Returns the new array of regrouped elements.
			* @example
			*
			* var zipped = _.zip(['a', 'b'], [1, 2], [true, false]);
			* // => [['a', 1, true], ['b', 2, false]]
			*
			* _.unzip(zipped);
			* // => [['a', 'b'], [1, 2], [true, false]]
			*/
			function unzip(array) {
				if (!(array && array.length)) return [];
				var length = 0;
				array = arrayFilter(array, function(group) {
					if (isArrayLikeObject(group)) {
						length = nativeMax(group.length, length);
						return true;
					}
				});
				return baseTimes(length, function(index) {
					return arrayMap(array, baseProperty(index));
				});
			}
			/**
			* This method is like `_.unzip` except that it accepts `iteratee` to specify
			* how regrouped values should be combined. The iteratee is invoked with the
			* elements of each group: (...group).
			*
			* @static
			* @memberOf _
			* @since 3.8.0
			* @category Array
			* @param {Array} array The array of grouped elements to process.
			* @param {Function} [iteratee=_.identity] The function to combine
			*  regrouped values.
			* @returns {Array} Returns the new array of regrouped elements.
			* @example
			*
			* var zipped = _.zip([1, 2], [10, 20], [100, 200]);
			* // => [[1, 10, 100], [2, 20, 200]]
			*
			* _.unzipWith(zipped, _.add);
			* // => [3, 30, 300]
			*/
			function unzipWith(array, iteratee) {
				if (!(array && array.length)) return [];
				var result = unzip(array);
				if (iteratee == null) return result;
				return arrayMap(result, function(group) {
					return apply(iteratee, undefined, group);
				});
			}
			/**
			* Creates an array excluding all given values using
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* for equality comparisons.
			*
			* **Note:** Unlike `_.pull`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {Array} array The array to inspect.
			* @param {...*} [values] The values to exclude.
			* @returns {Array} Returns the new array of filtered values.
			* @see _.difference, _.xor
			* @example
			*
			* _.without([2, 1, 2, 3], 1, 2);
			* // => [3]
			*/
			var without = baseRest(function(array, values) {
				return isArrayLikeObject(array) ? baseDifference(array, values) : [];
			});
			/**
			* Creates an array of unique values that is the
			* [symmetric difference](https://en.wikipedia.org/wiki/Symmetric_difference)
			* of the given arrays. The order of result values is determined by the order
			* they occur in the arrays.
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @returns {Array} Returns the new array of filtered values.
			* @see _.difference, _.without
			* @example
			*
			* _.xor([2, 1], [2, 3]);
			* // => [1, 3]
			*/
			var xor = baseRest(function(arrays) {
				return baseXor(arrayFilter(arrays, isArrayLikeObject));
			});
			/**
			* This method is like `_.xor` except that it accepts `iteratee` which is
			* invoked for each element of each `arrays` to generate the criterion by
			* which by which they're compared. The order of result values is determined
			* by the order they occur in the arrays. The iteratee is invoked with one
			* argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* _.xorBy([2.1, 1.2], [2.3, 3.4], Math.floor);
			* // => [1.2, 3.4]
			*
			* // The `_.property` iteratee shorthand.
			* _.xorBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
			* // => [{ 'x': 2 }]
			*/
			var xorBy = baseRest(function(arrays) {
				var iteratee = last(arrays);
				if (isArrayLikeObject(iteratee)) iteratee = undefined;
				return baseXor(arrayFilter(arrays, isArrayLikeObject), getIteratee(iteratee, 2));
			});
			/**
			* This method is like `_.xor` except that it accepts `comparator` which is
			* invoked to compare elements of `arrays`. The order of result values is
			* determined by the order they occur in the arrays. The comparator is invoked
			* with two arguments: (arrVal, othVal).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Array
			* @param {...Array} [arrays] The arrays to inspect.
			* @param {Function} [comparator] The comparator invoked per element.
			* @returns {Array} Returns the new array of filtered values.
			* @example
			*
			* var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
			* var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
			*
			* _.xorWith(objects, others, _.isEqual);
			* // => [{ 'x': 2, 'y': 1 }, { 'x': 1, 'y': 1 }]
			*/
			var xorWith = baseRest(function(arrays) {
				var comparator = last(arrays);
				comparator = typeof comparator == "function" ? comparator : undefined;
				return baseXor(arrayFilter(arrays, isArrayLikeObject), undefined, comparator);
			});
			/**
			* Creates an array of grouped elements, the first of which contains the
			* first elements of the given arrays, the second of which contains the
			* second elements of the given arrays, and so on.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Array
			* @param {...Array} [arrays] The arrays to process.
			* @returns {Array} Returns the new array of grouped elements.
			* @example
			*
			* _.zip(['a', 'b'], [1, 2], [true, false]);
			* // => [['a', 1, true], ['b', 2, false]]
			*/
			var zip = baseRest(unzip);
			/**
			* This method is like `_.fromPairs` except that it accepts two arrays,
			* one of property identifiers and one of corresponding values.
			*
			* @static
			* @memberOf _
			* @since 0.4.0
			* @category Array
			* @param {Array} [props=[]] The property identifiers.
			* @param {Array} [values=[]] The property values.
			* @returns {Object} Returns the new object.
			* @example
			*
			* _.zipObject(['a', 'b'], [1, 2]);
			* // => { 'a': 1, 'b': 2 }
			*/
			function zipObject(props, values) {
				return baseZipObject(props || [], values || [], assignValue);
			}
			/**
			* This method is like `_.zipObject` except that it supports property paths.
			*
			* @static
			* @memberOf _
			* @since 4.1.0
			* @category Array
			* @param {Array} [props=[]] The property identifiers.
			* @param {Array} [values=[]] The property values.
			* @returns {Object} Returns the new object.
			* @example
			*
			* _.zipObjectDeep(['a.b[0].c', 'a.b[1].d'], [1, 2]);
			* // => { 'a': { 'b': [{ 'c': 1 }, { 'd': 2 }] } }
			*/
			function zipObjectDeep(props, values) {
				return baseZipObject(props || [], values || [], baseSet);
			}
			/**
			* This method is like `_.zip` except that it accepts `iteratee` to specify
			* how grouped values should be combined. The iteratee is invoked with the
			* elements of each group: (...group).
			*
			* @static
			* @memberOf _
			* @since 3.8.0
			* @category Array
			* @param {...Array} [arrays] The arrays to process.
			* @param {Function} [iteratee=_.identity] The function to combine
			*  grouped values.
			* @returns {Array} Returns the new array of grouped elements.
			* @example
			*
			* _.zipWith([1, 2], [10, 20], [100, 200], function(a, b, c) {
			*   return a + b + c;
			* });
			* // => [111, 222]
			*/
			var zipWith = baseRest(function(arrays) {
				var length = arrays.length, iteratee = length > 1 ? arrays[length - 1] : undefined;
				iteratee = typeof iteratee == "function" ? (arrays.pop(), iteratee) : undefined;
				return unzipWith(arrays, iteratee);
			});
			/**
			* Creates a `lodash` wrapper instance that wraps `value` with explicit method
			* chain sequences enabled. The result of such sequences must be unwrapped
			* with `_#value`.
			*
			* @static
			* @memberOf _
			* @since 1.3.0
			* @category Seq
			* @param {*} value The value to wrap.
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'age': 36 },
			*   { 'user': 'fred',    'age': 40 },
			*   { 'user': 'pebbles', 'age': 1 }
			* ];
			*
			* var youngest = _
			*   .chain(users)
			*   .sortBy('age')
			*   .map(function(o) {
			*     return o.user + ' is ' + o.age;
			*   })
			*   .head()
			*   .value();
			* // => 'pebbles is 1'
			*/
			function chain(value) {
				var result = lodash(value);
				result.__chain__ = true;
				return result;
			}
			/**
			* This method invokes `interceptor` and returns `value`. The interceptor
			* is invoked with one argument; (value). The purpose of this method is to
			* "tap into" a method chain sequence in order to modify intermediate results.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Seq
			* @param {*} value The value to provide to `interceptor`.
			* @param {Function} interceptor The function to invoke.
			* @returns {*} Returns `value`.
			* @example
			*
			* _([1, 2, 3])
			*  .tap(function(array) {
			*    // Mutate input array.
			*    array.pop();
			*  })
			*  .reverse()
			*  .value();
			* // => [2, 1]
			*/
			function tap(value, interceptor) {
				interceptor(value);
				return value;
			}
			/**
			* This method is like `_.tap` except that it returns the result of `interceptor`.
			* The purpose of this method is to "pass thru" values replacing intermediate
			* results in a method chain sequence.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Seq
			* @param {*} value The value to provide to `interceptor`.
			* @param {Function} interceptor The function to invoke.
			* @returns {*} Returns the result of `interceptor`.
			* @example
			*
			* _('  abc  ')
			*  .chain()
			*  .trim()
			*  .thru(function(value) {
			*    return [value];
			*  })
			*  .value();
			* // => ['abc']
			*/
			function thru(value, interceptor) {
				return interceptor(value);
			}
			/**
			* This method is the wrapper version of `_.at`.
			*
			* @name at
			* @memberOf _
			* @since 1.0.0
			* @category Seq
			* @param {...(string|string[])} [paths] The property paths to pick.
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }, 4] };
			*
			* _(object).at(['a[0].b.c', 'a[1]']).value();
			* // => [3, 4]
			*/
			var wrapperAt = flatRest(function(paths) {
				var length = paths.length, start = length ? paths[0] : 0, value = this.__wrapped__, interceptor = function(object) {
					return baseAt(object, paths);
				};
				if (length > 1 || this.__actions__.length || !(value instanceof LazyWrapper) || !isIndex(start)) return this.thru(interceptor);
				value = value.slice(start, +start + (length ? 1 : 0));
				value.__actions__.push({
					"func": thru,
					"args": [interceptor],
					"thisArg": undefined
				});
				return new LodashWrapper(value, this.__chain__).thru(function(array) {
					if (length && !array.length) array.push(undefined);
					return array;
				});
			});
			/**
			* Creates a `lodash` wrapper instance with explicit method chain sequences enabled.
			*
			* @name chain
			* @memberOf _
			* @since 0.1.0
			* @category Seq
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36 },
			*   { 'user': 'fred',   'age': 40 }
			* ];
			*
			* // A sequence without explicit chaining.
			* _(users).head();
			* // => { 'user': 'barney', 'age': 36 }
			*
			* // A sequence with explicit chaining.
			* _(users)
			*   .chain()
			*   .head()
			*   .pick('user')
			*   .value();
			* // => { 'user': 'barney' }
			*/
			function wrapperChain() {
				return chain(this);
			}
			/**
			* Executes the chain sequence and returns the wrapped result.
			*
			* @name commit
			* @memberOf _
			* @since 3.2.0
			* @category Seq
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var array = [1, 2];
			* var wrapped = _(array).push(3);
			*
			* console.log(array);
			* // => [1, 2]
			*
			* wrapped = wrapped.commit();
			* console.log(array);
			* // => [1, 2, 3]
			*
			* wrapped.last();
			* // => 3
			*
			* console.log(array);
			* // => [1, 2, 3]
			*/
			function wrapperCommit() {
				return new LodashWrapper(this.value(), this.__chain__);
			}
			/**
			* Gets the next value on a wrapped object following the
			* [iterator protocol](https://mdn.io/iteration_protocols#iterator).
			*
			* @name next
			* @memberOf _
			* @since 4.0.0
			* @category Seq
			* @returns {Object} Returns the next iterator value.
			* @example
			*
			* var wrapped = _([1, 2]);
			*
			* wrapped.next();
			* // => { 'done': false, 'value': 1 }
			*
			* wrapped.next();
			* // => { 'done': false, 'value': 2 }
			*
			* wrapped.next();
			* // => { 'done': true, 'value': undefined }
			*/
			function wrapperNext() {
				if (this.__values__ === undefined) this.__values__ = toArray(this.value());
				var done = this.__index__ >= this.__values__.length;
				return {
					"done": done,
					"value": done ? undefined : this.__values__[this.__index__++]
				};
			}
			/**
			* Enables the wrapper to be iterable.
			*
			* @name Symbol.iterator
			* @memberOf _
			* @since 4.0.0
			* @category Seq
			* @returns {Object} Returns the wrapper object.
			* @example
			*
			* var wrapped = _([1, 2]);
			*
			* wrapped[Symbol.iterator]() === wrapped;
			* // => true
			*
			* Array.from(wrapped);
			* // => [1, 2]
			*/
			function wrapperToIterator() {
				return this;
			}
			/**
			* Creates a clone of the chain sequence planting `value` as the wrapped value.
			*
			* @name plant
			* @memberOf _
			* @since 3.2.0
			* @category Seq
			* @param {*} value The value to plant.
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var wrapped = _([1, 2]).map(square);
			* var other = wrapped.plant([3, 4]);
			*
			* other.value();
			* // => [9, 16]
			*
			* wrapped.value();
			* // => [1, 4]
			*/
			function wrapperPlant(value) {
				var result, parent = this;
				while (parent instanceof baseLodash) {
					var clone = wrapperClone(parent);
					clone.__index__ = 0;
					clone.__values__ = undefined;
					if (result) previous.__wrapped__ = clone;
					else result = clone;
					var previous = clone;
					parent = parent.__wrapped__;
				}
				previous.__wrapped__ = value;
				return result;
			}
			/**
			* This method is the wrapper version of `_.reverse`.
			*
			* **Note:** This method mutates the wrapped array.
			*
			* @name reverse
			* @memberOf _
			* @since 0.1.0
			* @category Seq
			* @returns {Object} Returns the new `lodash` wrapper instance.
			* @example
			*
			* var array = [1, 2, 3];
			*
			* _(array).reverse().value()
			* // => [3, 2, 1]
			*
			* console.log(array);
			* // => [3, 2, 1]
			*/
			function wrapperReverse() {
				var value = this.__wrapped__;
				if (value instanceof LazyWrapper) {
					var wrapped = value;
					if (this.__actions__.length) wrapped = new LazyWrapper(this);
					wrapped = wrapped.reverse();
					wrapped.__actions__.push({
						"func": thru,
						"args": [reverse],
						"thisArg": undefined
					});
					return new LodashWrapper(wrapped, this.__chain__);
				}
				return this.thru(reverse);
			}
			/**
			* Executes the chain sequence to resolve the unwrapped value.
			*
			* @name value
			* @memberOf _
			* @since 0.1.0
			* @alias toJSON, valueOf
			* @category Seq
			* @returns {*} Returns the resolved unwrapped value.
			* @example
			*
			* _([1, 2, 3]).value();
			* // => [1, 2, 3]
			*/
			function wrapperValue() {
				return baseWrapperValue(this.__wrapped__, this.__actions__);
			}
			/**
			* Creates an object composed of keys generated from the results of running
			* each element of `collection` thru `iteratee`. The corresponding value of
			* each key is the number of times the key was returned by `iteratee`. The
			* iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 0.5.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee to transform keys.
			* @returns {Object} Returns the composed aggregate object.
			* @example
			*
			* _.countBy([6.1, 4.2, 6.3], Math.floor);
			* // => { '4': 1, '6': 2 }
			*
			* // The `_.property` iteratee shorthand.
			* _.countBy(['one', 'two', 'three'], 'length');
			* // => { '3': 2, '5': 1 }
			*/
			var countBy = createAggregator(function(result, value, key) {
				if (hasOwnProperty.call(result, key)) ++result[key];
				else baseAssignValue(result, key, 1);
			});
			/**
			* Checks if `predicate` returns truthy for **all** elements of `collection`.
			* Iteration is stopped once `predicate` returns falsey. The predicate is
			* invoked with three arguments: (value, index|key, collection).
			*
			* **Note:** This method returns `true` for
			* [empty collections](https://en.wikipedia.org/wiki/Empty_set) because
			* [everything is true](https://en.wikipedia.org/wiki/Vacuous_truth) of
			* elements of empty collections.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {boolean} Returns `true` if all elements pass the predicate check,
			*  else `false`.
			* @example
			*
			* _.every([true, 1, null, 'yes'], Boolean);
			* // => false
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36, 'active': false },
			*   { 'user': 'fred',   'age': 40, 'active': false }
			* ];
			*
			* // The `_.matches` iteratee shorthand.
			* _.every(users, { 'user': 'barney', 'active': false });
			* // => false
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.every(users, ['active', false]);
			* // => true
			*
			* // The `_.property` iteratee shorthand.
			* _.every(users, 'active');
			* // => false
			*/
			function every(collection, predicate, guard) {
				var func = isArray(collection) ? arrayEvery : baseEvery;
				if (guard && isIterateeCall(collection, predicate, guard)) predicate = undefined;
				return func(collection, getIteratee(predicate, 3));
			}
			/**
			* Iterates over elements of `collection`, returning an array of all elements
			* `predicate` returns truthy for. The predicate is invoked with three
			* arguments: (value, index|key, collection).
			*
			* **Note:** Unlike `_.remove`, this method returns a new array.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new filtered array.
			* @see _.reject
			* @example
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36, 'active': true },
			*   { 'user': 'fred',   'age': 40, 'active': false }
			* ];
			*
			* _.filter(users, function(o) { return !o.active; });
			* // => objects for ['fred']
			*
			* // The `_.matches` iteratee shorthand.
			* _.filter(users, { 'age': 36, 'active': true });
			* // => objects for ['barney']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.filter(users, ['active', false]);
			* // => objects for ['fred']
			*
			* // The `_.property` iteratee shorthand.
			* _.filter(users, 'active');
			* // => objects for ['barney']
			*
			* // Combining several predicates using `_.overEvery` or `_.overSome`.
			* _.filter(users, _.overSome([{ 'age': 36 }, ['age', 40]]));
			* // => objects for ['fred', 'barney']
			*/
			function filter(collection, predicate) {
				return (isArray(collection) ? arrayFilter : baseFilter)(collection, getIteratee(predicate, 3));
			}
			/**
			* Iterates over elements of `collection`, returning the first element
			* `predicate` returns truthy for. The predicate is invoked with three
			* arguments: (value, index|key, collection).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param {number} [fromIndex=0] The index to search from.
			* @returns {*} Returns the matched element, else `undefined`.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'age': 36, 'active': true },
			*   { 'user': 'fred',    'age': 40, 'active': false },
			*   { 'user': 'pebbles', 'age': 1,  'active': true }
			* ];
			*
			* _.find(users, function(o) { return o.age < 40; });
			* // => object for 'barney'
			*
			* // The `_.matches` iteratee shorthand.
			* _.find(users, { 'age': 1, 'active': true });
			* // => object for 'pebbles'
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.find(users, ['active', false]);
			* // => object for 'fred'
			*
			* // The `_.property` iteratee shorthand.
			* _.find(users, 'active');
			* // => object for 'barney'
			*/
			var find = createFind(findIndex);
			/**
			* This method is like `_.find` except that it iterates over elements of
			* `collection` from right to left.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param {number} [fromIndex=collection.length-1] The index to search from.
			* @returns {*} Returns the matched element, else `undefined`.
			* @example
			*
			* _.findLast([1, 2, 3, 4], function(n) {
			*   return n % 2 == 1;
			* });
			* // => 3
			*/
			var findLast = createFind(findLastIndex);
			/**
			* Creates a flattened array of values by running each element in `collection`
			* thru `iteratee` and flattening the mapped results. The iteratee is invoked
			* with three arguments: (value, index|key, collection).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* function duplicate(n) {
			*   return [n, n];
			* }
			*
			* _.flatMap([1, 2], duplicate);
			* // => [1, 1, 2, 2]
			*/
			function flatMap(collection, iteratee) {
				return baseFlatten(map(collection, iteratee), 1);
			}
			/**
			* This method is like `_.flatMap` except that it recursively flattens the
			* mapped results.
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* function duplicate(n) {
			*   return [[[n, n]]];
			* }
			*
			* _.flatMapDeep([1, 2], duplicate);
			* // => [1, 1, 2, 2]
			*/
			function flatMapDeep(collection, iteratee) {
				return baseFlatten(map(collection, iteratee), INFINITY);
			}
			/**
			* This method is like `_.flatMap` except that it recursively flattens the
			* mapped results up to `depth` times.
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @param {number} [depth=1] The maximum recursion depth.
			* @returns {Array} Returns the new flattened array.
			* @example
			*
			* function duplicate(n) {
			*   return [[[n, n]]];
			* }
			*
			* _.flatMapDepth([1, 2], duplicate, 2);
			* // => [[1, 1], [2, 2]]
			*/
			function flatMapDepth(collection, iteratee, depth) {
				depth = depth === undefined ? 1 : toInteger(depth);
				return baseFlatten(map(collection, iteratee), depth);
			}
			/**
			* Iterates over elements of `collection` and invokes `iteratee` for each element.
			* The iteratee is invoked with three arguments: (value, index|key, collection).
			* Iteratee functions may exit iteration early by explicitly returning `false`.
			*
			* **Note:** As with other "Collections" methods, objects with a "length"
			* property are iterated like arrays. To avoid this behavior use `_.forIn`
			* or `_.forOwn` for object iteration.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @alias each
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array|Object} Returns `collection`.
			* @see _.forEachRight
			* @example
			*
			* _.forEach([1, 2], function(value) {
			*   console.log(value);
			* });
			* // => Logs `1` then `2`.
			*
			* _.forEach({ 'a': 1, 'b': 2 }, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'a' then 'b' (iteration order is not guaranteed).
			*/
			function forEach(collection, iteratee) {
				return (isArray(collection) ? arrayEach : baseEach)(collection, getIteratee(iteratee, 3));
			}
			/**
			* This method is like `_.forEach` except that it iterates over elements of
			* `collection` from right to left.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @alias eachRight
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array|Object} Returns `collection`.
			* @see _.forEach
			* @example
			*
			* _.forEachRight([1, 2], function(value) {
			*   console.log(value);
			* });
			* // => Logs `2` then `1`.
			*/
			function forEachRight(collection, iteratee) {
				return (isArray(collection) ? arrayEachRight : baseEachRight)(collection, getIteratee(iteratee, 3));
			}
			/**
			* Creates an object composed of keys generated from the results of running
			* each element of `collection` thru `iteratee`. The order of grouped values
			* is determined by the order they occur in `collection`. The corresponding
			* value of each key is an array of elements responsible for generating the
			* key. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee to transform keys.
			* @returns {Object} Returns the composed aggregate object.
			* @example
			*
			* _.groupBy([6.1, 4.2, 6.3], Math.floor);
			* // => { '4': [4.2], '6': [6.1, 6.3] }
			*
			* // The `_.property` iteratee shorthand.
			* _.groupBy(['one', 'two', 'three'], 'length');
			* // => { '3': ['one', 'two'], '5': ['three'] }
			*/
			var groupBy = createAggregator(function(result, value, key) {
				if (hasOwnProperty.call(result, key)) result[key].push(value);
				else baseAssignValue(result, key, [value]);
			});
			/**
			* Checks if `value` is in `collection`. If `collection` is a string, it's
			* checked for a substring of `value`, otherwise
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* is used for equality comparisons. If `fromIndex` is negative, it's used as
			* the offset from the end of `collection`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object|string} collection The collection to inspect.
			* @param {*} value The value to search for.
			* @param {number} [fromIndex=0] The index to search from.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
			* @returns {boolean} Returns `true` if `value` is found, else `false`.
			* @example
			*
			* _.includes([1, 2, 3], 1);
			* // => true
			*
			* _.includes([1, 2, 3], 1, 2);
			* // => false
			*
			* _.includes({ 'a': 1, 'b': 2 }, 1);
			* // => true
			*
			* _.includes('abcd', 'bc');
			* // => true
			*/
			function includes(collection, value, fromIndex, guard) {
				collection = isArrayLike(collection) ? collection : values(collection);
				fromIndex = fromIndex && !guard ? toInteger(fromIndex) : 0;
				var length = collection.length;
				if (fromIndex < 0) fromIndex = nativeMax(length + fromIndex, 0);
				return isString(collection) ? fromIndex <= length && collection.indexOf(value, fromIndex) > -1 : !!length && baseIndexOf(collection, value, fromIndex) > -1;
			}
			/**
			* Invokes the method at `path` of each element in `collection`, returning
			* an array of the results of each invoked method. Any additional arguments
			* are provided to each invoked method. If `path` is a function, it's invoked
			* for, and `this` bound to, each element in `collection`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Array|Function|string} path The path of the method to invoke or
			*  the function invoked per iteration.
			* @param {...*} [args] The arguments to invoke each method with.
			* @returns {Array} Returns the array of results.
			* @example
			*
			* _.invokeMap([[5, 1, 7], [3, 2, 1]], 'sort');
			* // => [[1, 5, 7], [1, 2, 3]]
			*
			* _.invokeMap([123, 456], String.prototype.split, '');
			* // => [['1', '2', '3'], ['4', '5', '6']]
			*/
			var invokeMap = baseRest(function(collection, path, args) {
				var index = -1, isFunc = typeof path == "function", result = isArrayLike(collection) ? Array(collection.length) : [];
				baseEach(collection, function(value) {
					result[++index] = isFunc ? apply(path, value, args) : baseInvoke(value, path, args);
				});
				return result;
			});
			/**
			* Creates an object composed of keys generated from the results of running
			* each element of `collection` thru `iteratee`. The corresponding value of
			* each key is the last element responsible for generating the key. The
			* iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee to transform keys.
			* @returns {Object} Returns the composed aggregate object.
			* @example
			*
			* var array = [
			*   { 'dir': 'left', 'code': 97 },
			*   { 'dir': 'right', 'code': 100 }
			* ];
			*
			* _.keyBy(array, function(o) {
			*   return String.fromCharCode(o.code);
			* });
			* // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
			*
			* _.keyBy(array, 'dir');
			* // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
			*/
			var keyBy = createAggregator(function(result, value, key) {
				baseAssignValue(result, key, value);
			});
			/**
			* Creates an array of values by running each element in `collection` thru
			* `iteratee`. The iteratee is invoked with three arguments:
			* (value, index|key, collection).
			*
			* Many lodash methods are guarded to work as iteratees for methods like
			* `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
			*
			* The guarded methods are:
			* `ary`, `chunk`, `curry`, `curryRight`, `drop`, `dropRight`, `every`,
			* `fill`, `invert`, `parseInt`, `random`, `range`, `rangeRight`, `repeat`,
			* `sampleSize`, `slice`, `some`, `sortBy`, `split`, `take`, `takeRight`,
			* `template`, `trim`, `trimEnd`, `trimStart`, and `words`
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new mapped array.
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* _.map([4, 8], square);
			* // => [16, 64]
			*
			* _.map({ 'a': 4, 'b': 8 }, square);
			* // => [16, 64] (iteration order is not guaranteed)
			*
			* var users = [
			*   { 'user': 'barney' },
			*   { 'user': 'fred' }
			* ];
			*
			* // The `_.property` iteratee shorthand.
			* _.map(users, 'user');
			* // => ['barney', 'fred']
			*/
			function map(collection, iteratee) {
				return (isArray(collection) ? arrayMap : baseMap)(collection, getIteratee(iteratee, 3));
			}
			/**
			* This method is like `_.sortBy` except that it allows specifying the sort
			* orders of the iteratees to sort by. If `orders` is unspecified, all values
			* are sorted in ascending order. Otherwise, specify an order of "desc" for
			* descending or "asc" for ascending sort order of corresponding values.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Array[]|Function[]|Object[]|string[]} [iteratees=[_.identity]]
			*  The iteratees to sort by.
			* @param {string[]} [orders] The sort orders of `iteratees`.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
			* @returns {Array} Returns the new sorted array.
			* @example
			*
			* var users = [
			*   { 'user': 'fred',   'age': 48 },
			*   { 'user': 'barney', 'age': 34 },
			*   { 'user': 'fred',   'age': 40 },
			*   { 'user': 'barney', 'age': 36 }
			* ];
			*
			* // Sort by `user` in ascending order and by `age` in descending order.
			* _.orderBy(users, ['user', 'age'], ['asc', 'desc']);
			* // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 40]]
			*/
			function orderBy(collection, iteratees, orders, guard) {
				if (collection == null) return [];
				if (!isArray(iteratees)) iteratees = iteratees == null ? [] : [iteratees];
				orders = guard ? undefined : orders;
				if (!isArray(orders)) orders = orders == null ? [] : [orders];
				return baseOrderBy(collection, iteratees, orders);
			}
			/**
			* Creates an array of elements split into two groups, the first of which
			* contains elements `predicate` returns truthy for, the second of which
			* contains elements `predicate` returns falsey for. The predicate is
			* invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the array of grouped elements.
			* @example
			*
			* var users = [
			*   { 'user': 'barney',  'age': 36, 'active': false },
			*   { 'user': 'fred',    'age': 40, 'active': true },
			*   { 'user': 'pebbles', 'age': 1,  'active': false }
			* ];
			*
			* _.partition(users, function(o) { return o.active; });
			* // => objects for [['fred'], ['barney', 'pebbles']]
			*
			* // The `_.matches` iteratee shorthand.
			* _.partition(users, { 'age': 1, 'active': false });
			* // => objects for [['pebbles'], ['barney', 'fred']]
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.partition(users, ['active', false]);
			* // => objects for [['barney', 'pebbles'], ['fred']]
			*
			* // The `_.property` iteratee shorthand.
			* _.partition(users, 'active');
			* // => objects for [['fred'], ['barney', 'pebbles']]
			*/
			var partition = createAggregator(function(result, value, key) {
				result[key ? 0 : 1].push(value);
			}, function() {
				return [[], []];
			});
			/**
			* Reduces `collection` to a value which is the accumulated result of running
			* each element in `collection` thru `iteratee`, where each successive
			* invocation is supplied the return value of the previous. If `accumulator`
			* is not given, the first element of `collection` is used as the initial
			* value. The iteratee is invoked with four arguments:
			* (accumulator, value, index|key, collection).
			*
			* Many lodash methods are guarded to work as iteratees for methods like
			* `_.reduce`, `_.reduceRight`, and `_.transform`.
			*
			* The guarded methods are:
			* `assign`, `defaults`, `defaultsDeep`, `includes`, `merge`, `orderBy`,
			* and `sortBy`
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @param {*} [accumulator] The initial value.
			* @returns {*} Returns the accumulated value.
			* @see _.reduceRight
			* @example
			*
			* _.reduce([1, 2], function(sum, n) {
			*   return sum + n;
			* }, 0);
			* // => 3
			*
			* _.reduce({ 'a': 1, 'b': 2, 'c': 1 }, function(result, value, key) {
			*   (result[value] || (result[value] = [])).push(key);
			*   return result;
			* }, {});
			* // => { '1': ['a', 'c'], '2': ['b'] } (iteration order is not guaranteed)
			*/
			function reduce(collection, iteratee, accumulator) {
				var func = isArray(collection) ? arrayReduce : baseReduce, initAccum = arguments.length < 3;
				return func(collection, getIteratee(iteratee, 4), accumulator, initAccum, baseEach);
			}
			/**
			* This method is like `_.reduce` except that it iterates over elements of
			* `collection` from right to left.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @param {*} [accumulator] The initial value.
			* @returns {*} Returns the accumulated value.
			* @see _.reduce
			* @example
			*
			* var array = [[0, 1], [2, 3], [4, 5]];
			*
			* _.reduceRight(array, function(flattened, other) {
			*   return flattened.concat(other);
			* }, []);
			* // => [4, 5, 2, 3, 0, 1]
			*/
			function reduceRight(collection, iteratee, accumulator) {
				var func = isArray(collection) ? arrayReduceRight : baseReduce, initAccum = arguments.length < 3;
				return func(collection, getIteratee(iteratee, 4), accumulator, initAccum, baseEachRight);
			}
			/**
			* The opposite of `_.filter`; this method returns the elements of `collection`
			* that `predicate` does **not** return truthy for.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the new filtered array.
			* @see _.filter
			* @example
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36, 'active': false },
			*   { 'user': 'fred',   'age': 40, 'active': true }
			* ];
			*
			* _.reject(users, function(o) { return !o.active; });
			* // => objects for ['fred']
			*
			* // The `_.matches` iteratee shorthand.
			* _.reject(users, { 'age': 40, 'active': true });
			* // => objects for ['barney']
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.reject(users, ['active', false]);
			* // => objects for ['fred']
			*
			* // The `_.property` iteratee shorthand.
			* _.reject(users, 'active');
			* // => objects for ['barney']
			*/
			function reject(collection, predicate) {
				return (isArray(collection) ? arrayFilter : baseFilter)(collection, negate(getIteratee(predicate, 3)));
			}
			/**
			* Gets a random element from `collection`.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to sample.
			* @returns {*} Returns the random element.
			* @example
			*
			* _.sample([1, 2, 3, 4]);
			* // => 2
			*/
			function sample(collection) {
				return (isArray(collection) ? arraySample : baseSample)(collection);
			}
			/**
			* Gets `n` random elements at unique keys from `collection` up to the
			* size of `collection`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Collection
			* @param {Array|Object} collection The collection to sample.
			* @param {number} [n=1] The number of elements to sample.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the random elements.
			* @example
			*
			* _.sampleSize([1, 2, 3], 2);
			* // => [3, 1]
			*
			* _.sampleSize([1, 2, 3], 4);
			* // => [2, 3, 1]
			*/
			function sampleSize(collection, n, guard) {
				if (guard ? isIterateeCall(collection, n, guard) : n === undefined) n = 1;
				else n = toInteger(n);
				return (isArray(collection) ? arraySampleSize : baseSampleSize)(collection, n);
			}
			/**
			* Creates an array of shuffled values, using a version of the
			* [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher-Yates_shuffle).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to shuffle.
			* @returns {Array} Returns the new shuffled array.
			* @example
			*
			* _.shuffle([1, 2, 3, 4]);
			* // => [4, 1, 3, 2]
			*/
			function shuffle(collection) {
				return (isArray(collection) ? arrayShuffle : baseShuffle)(collection);
			}
			/**
			* Gets the size of `collection` by returning its length for array-like
			* values or the number of own enumerable string keyed properties for objects.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object|string} collection The collection to inspect.
			* @returns {number} Returns the collection size.
			* @example
			*
			* _.size([1, 2, 3]);
			* // => 3
			*
			* _.size({ 'a': 1, 'b': 2 });
			* // => 2
			*
			* _.size('pebbles');
			* // => 7
			*/
			function size(collection) {
				if (collection == null) return 0;
				if (isArrayLike(collection)) return isString(collection) ? stringSize(collection) : collection.length;
				var tag = getTag(collection);
				if (tag == mapTag || tag == setTag) return collection.size;
				return baseKeys(collection).length;
			}
			/**
			* Checks if `predicate` returns truthy for **any** element of `collection`.
			* Iteration is stopped once `predicate` returns truthy. The predicate is
			* invoked with three arguments: (value, index|key, collection).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {boolean} Returns `true` if any element passes the predicate check,
			*  else `false`.
			* @example
			*
			* _.some([null, 0, 'yes', false], Boolean);
			* // => true
			*
			* var users = [
			*   { 'user': 'barney', 'active': true },
			*   { 'user': 'fred',   'active': false }
			* ];
			*
			* // The `_.matches` iteratee shorthand.
			* _.some(users, { 'user': 'barney', 'active': false });
			* // => false
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.some(users, ['active', false]);
			* // => true
			*
			* // The `_.property` iteratee shorthand.
			* _.some(users, 'active');
			* // => true
			*/
			function some(collection, predicate, guard) {
				var func = isArray(collection) ? arraySome : baseSome;
				if (guard && isIterateeCall(collection, predicate, guard)) predicate = undefined;
				return func(collection, getIteratee(predicate, 3));
			}
			/**
			* Creates an array of elements, sorted in ascending order by the results of
			* running each element in a collection thru each iteratee. This method
			* performs a stable sort, that is, it preserves the original sort order of
			* equal elements. The iteratees are invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Collection
			* @param {Array|Object} collection The collection to iterate over.
			* @param {...(Function|Function[])} [iteratees=[_.identity]]
			*  The iteratees to sort by.
			* @returns {Array} Returns the new sorted array.
			* @example
			*
			* var users = [
			*   { 'user': 'fred',   'age': 48 },
			*   { 'user': 'barney', 'age': 36 },
			*   { 'user': 'fred',   'age': 30 },
			*   { 'user': 'barney', 'age': 34 }
			* ];
			*
			* _.sortBy(users, [function(o) { return o.user; }]);
			* // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 30]]
			*
			* _.sortBy(users, ['user', 'age']);
			* // => objects for [['barney', 34], ['barney', 36], ['fred', 30], ['fred', 48]]
			*/
			var sortBy = baseRest(function(collection, iteratees) {
				if (collection == null) return [];
				var length = iteratees.length;
				if (length > 1 && isIterateeCall(collection, iteratees[0], iteratees[1])) iteratees = [];
				else if (length > 2 && isIterateeCall(iteratees[0], iteratees[1], iteratees[2])) iteratees = [iteratees[0]];
				return baseOrderBy(collection, baseFlatten(iteratees, 1), []);
			});
			/**
			* Gets the timestamp of the number of milliseconds that have elapsed since
			* the Unix epoch (1 January 1970 00:00:00 UTC).
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Date
			* @returns {number} Returns the timestamp.
			* @example
			*
			* _.defer(function(stamp) {
			*   console.log(_.now() - stamp);
			* }, _.now());
			* // => Logs the number of milliseconds it took for the deferred invocation.
			*/
			var now = ctxNow || function() {
				return root.Date.now();
			};
			/**
			* The opposite of `_.before`; this method creates a function that invokes
			* `func` once it's called `n` or more times.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {number} n The number of calls before `func` is invoked.
			* @param {Function} func The function to restrict.
			* @returns {Function} Returns the new restricted function.
			* @example
			*
			* var saves = ['profile', 'settings'];
			*
			* var done = _.after(saves.length, function() {
			*   console.log('done saving!');
			* });
			*
			* _.forEach(saves, function(type) {
			*   asyncSave({ 'type': type, 'complete': done });
			* });
			* // => Logs 'done saving!' after the two async saves have completed.
			*/
			function after(n, func) {
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				n = toInteger(n);
				return function() {
					if (--n < 1) return func.apply(this, arguments);
				};
			}
			/**
			* Creates a function that invokes `func`, with up to `n` arguments,
			* ignoring any additional arguments.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {Function} func The function to cap arguments for.
			* @param {number} [n=func.length] The arity cap.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Function} Returns the new capped function.
			* @example
			*
			* _.map(['6', '8', '10'], _.ary(parseInt, 1));
			* // => [6, 8, 10]
			*/
			function ary(func, n, guard) {
				n = guard ? undefined : n;
				n = func && n == null ? func.length : n;
				return createWrap(func, WRAP_ARY_FLAG, undefined, undefined, undefined, undefined, n);
			}
			/**
			* Creates a function that invokes `func`, with the `this` binding and arguments
			* of the created function, while it's called less than `n` times. Subsequent
			* calls to the created function return the result of the last `func` invocation.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {number} n The number of calls at which `func` is no longer invoked.
			* @param {Function} func The function to restrict.
			* @returns {Function} Returns the new restricted function.
			* @example
			*
			* jQuery(element).on('click', _.before(5, addContactToList));
			* // => Allows adding up to 4 contacts to the list.
			*/
			function before(n, func) {
				var result;
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				n = toInteger(n);
				return function() {
					if (--n > 0) result = func.apply(this, arguments);
					if (n <= 1) func = undefined;
					return result;
				};
			}
			/**
			* Creates a function that invokes `func` with the `this` binding of `thisArg`
			* and `partials` prepended to the arguments it receives.
			*
			* The `_.bind.placeholder` value, which defaults to `_` in monolithic builds,
			* may be used as a placeholder for partially applied arguments.
			*
			* **Note:** Unlike native `Function#bind`, this method doesn't set the "length"
			* property of bound functions.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to bind.
			* @param {*} thisArg The `this` binding of `func`.
			* @param {...*} [partials] The arguments to be partially applied.
			* @returns {Function} Returns the new bound function.
			* @example
			*
			* function greet(greeting, punctuation) {
			*   return greeting + ' ' + this.user + punctuation;
			* }
			*
			* var object = { 'user': 'fred' };
			*
			* var bound = _.bind(greet, object, 'hi');
			* bound('!');
			* // => 'hi fred!'
			*
			* // Bound with placeholders.
			* var bound = _.bind(greet, object, _, '!');
			* bound('hi');
			* // => 'hi fred!'
			*/
			var bind = baseRest(function(func, thisArg, partials) {
				var bitmask = WRAP_BIND_FLAG;
				if (partials.length) {
					var holders = replaceHolders(partials, getHolder(bind));
					bitmask |= WRAP_PARTIAL_FLAG;
				}
				return createWrap(func, bitmask, thisArg, partials, holders);
			});
			/**
			* Creates a function that invokes the method at `object[key]` with `partials`
			* prepended to the arguments it receives.
			*
			* This method differs from `_.bind` by allowing bound functions to reference
			* methods that may be redefined or don't yet exist. See
			* [Peter Michaux's article](http://peter.michaux.ca/articles/lazy-function-definition-pattern)
			* for more details.
			*
			* The `_.bindKey.placeholder` value, which defaults to `_` in monolithic
			* builds, may be used as a placeholder for partially applied arguments.
			*
			* @static
			* @memberOf _
			* @since 0.10.0
			* @category Function
			* @param {Object} object The object to invoke the method on.
			* @param {string} key The key of the method.
			* @param {...*} [partials] The arguments to be partially applied.
			* @returns {Function} Returns the new bound function.
			* @example
			*
			* var object = {
			*   'user': 'fred',
			*   'greet': function(greeting, punctuation) {
			*     return greeting + ' ' + this.user + punctuation;
			*   }
			* };
			*
			* var bound = _.bindKey(object, 'greet', 'hi');
			* bound('!');
			* // => 'hi fred!'
			*
			* object.greet = function(greeting, punctuation) {
			*   return greeting + 'ya ' + this.user + punctuation;
			* };
			*
			* bound('!');
			* // => 'hiya fred!'
			*
			* // Bound with placeholders.
			* var bound = _.bindKey(object, 'greet', _, '!');
			* bound('hi');
			* // => 'hiya fred!'
			*/
			var bindKey = baseRest(function(object, key, partials) {
				var bitmask = WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG;
				if (partials.length) {
					var holders = replaceHolders(partials, getHolder(bindKey));
					bitmask |= WRAP_PARTIAL_FLAG;
				}
				return createWrap(key, bitmask, object, partials, holders);
			});
			/**
			* Creates a function that accepts arguments of `func` and either invokes
			* `func` returning its result, if at least `arity` number of arguments have
			* been provided, or returns a function that accepts the remaining `func`
			* arguments, and so on. The arity of `func` may be specified if `func.length`
			* is not sufficient.
			*
			* The `_.curry.placeholder` value, which defaults to `_` in monolithic builds,
			* may be used as a placeholder for provided arguments.
			*
			* **Note:** This method doesn't set the "length" property of curried functions.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Function
			* @param {Function} func The function to curry.
			* @param {number} [arity=func.length] The arity of `func`.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Function} Returns the new curried function.
			* @example
			*
			* var abc = function(a, b, c) {
			*   return [a, b, c];
			* };
			*
			* var curried = _.curry(abc);
			*
			* curried(1)(2)(3);
			* // => [1, 2, 3]
			*
			* curried(1, 2)(3);
			* // => [1, 2, 3]
			*
			* curried(1, 2, 3);
			* // => [1, 2, 3]
			*
			* // Curried with placeholders.
			* curried(1)(_, 3)(2);
			* // => [1, 2, 3]
			*/
			function curry(func, arity, guard) {
				arity = guard ? undefined : arity;
				var result = createWrap(func, WRAP_CURRY_FLAG, undefined, undefined, undefined, undefined, undefined, arity);
				result.placeholder = curry.placeholder;
				return result;
			}
			/**
			* This method is like `_.curry` except that arguments are applied to `func`
			* in the manner of `_.partialRight` instead of `_.partial`.
			*
			* The `_.curryRight.placeholder` value, which defaults to `_` in monolithic
			* builds, may be used as a placeholder for provided arguments.
			*
			* **Note:** This method doesn't set the "length" property of curried functions.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {Function} func The function to curry.
			* @param {number} [arity=func.length] The arity of `func`.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Function} Returns the new curried function.
			* @example
			*
			* var abc = function(a, b, c) {
			*   return [a, b, c];
			* };
			*
			* var curried = _.curryRight(abc);
			*
			* curried(3)(2)(1);
			* // => [1, 2, 3]
			*
			* curried(2, 3)(1);
			* // => [1, 2, 3]
			*
			* curried(1, 2, 3);
			* // => [1, 2, 3]
			*
			* // Curried with placeholders.
			* curried(3)(1, _)(2);
			* // => [1, 2, 3]
			*/
			function curryRight(func, arity, guard) {
				arity = guard ? undefined : arity;
				var result = createWrap(func, WRAP_CURRY_RIGHT_FLAG, undefined, undefined, undefined, undefined, undefined, arity);
				result.placeholder = curryRight.placeholder;
				return result;
			}
			/**
			* Creates a debounced function that delays invoking `func` until after `wait`
			* milliseconds have elapsed since the last time the debounced function was
			* invoked. The debounced function comes with a `cancel` method to cancel
			* delayed `func` invocations and a `flush` method to immediately invoke them.
			* Provide `options` to indicate whether `func` should be invoked on the
			* leading and/or trailing edge of the `wait` timeout. The `func` is invoked
			* with the last arguments provided to the debounced function. Subsequent
			* calls to the debounced function return the result of the last `func`
			* invocation.
			*
			* **Note:** If `leading` and `trailing` options are `true`, `func` is
			* invoked on the trailing edge of the timeout only if the debounced function
			* is invoked more than once during the `wait` timeout.
			*
			* If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
			* until to the next tick, similar to `setTimeout` with a timeout of `0`.
			*
			* See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
			* for details over the differences between `_.debounce` and `_.throttle`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to debounce.
			* @param {number} [wait=0] The number of milliseconds to delay.
			* @param {Object} [options={}] The options object.
			* @param {boolean} [options.leading=false]
			*  Specify invoking on the leading edge of the timeout.
			* @param {number} [options.maxWait]
			*  The maximum time `func` is allowed to be delayed before it's invoked.
			* @param {boolean} [options.trailing=true]
			*  Specify invoking on the trailing edge of the timeout.
			* @returns {Function} Returns the new debounced function.
			* @example
			*
			* // Avoid costly calculations while the window size is in flux.
			* jQuery(window).on('resize', _.debounce(calculateLayout, 150));
			*
			* // Invoke `sendMail` when clicked, debouncing subsequent calls.
			* jQuery(element).on('click', _.debounce(sendMail, 300, {
			*   'leading': true,
			*   'trailing': false
			* }));
			*
			* // Ensure `batchLog` is invoked once after 1 second of debounced calls.
			* var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
			* var source = new EventSource('/stream');
			* jQuery(source).on('message', debounced);
			*
			* // Cancel the trailing debounced invocation.
			* jQuery(window).on('popstate', debounced.cancel);
			*/
			function debounce(func, wait, options) {
				var lastArgs, lastThis, maxWait, result, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				wait = toNumber(wait) || 0;
				if (isObject(options)) {
					leading = !!options.leading;
					maxing = "maxWait" in options;
					maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
					trailing = "trailing" in options ? !!options.trailing : trailing;
				}
				function invokeFunc(time) {
					var args = lastArgs, thisArg = lastThis;
					lastArgs = lastThis = undefined;
					lastInvokeTime = time;
					result = func.apply(thisArg, args);
					return result;
				}
				function leadingEdge(time) {
					lastInvokeTime = time;
					timerId = setTimeout(timerExpired, wait);
					return leading ? invokeFunc(time) : result;
				}
				function remainingWait(time) {
					var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, timeWaiting = wait - timeSinceLastCall;
					return maxing ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
				}
				function shouldInvoke(time) {
					var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
					return lastCallTime === undefined || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
				}
				function timerExpired() {
					var time = now();
					if (shouldInvoke(time)) return trailingEdge(time);
					timerId = setTimeout(timerExpired, remainingWait(time));
				}
				function trailingEdge(time) {
					timerId = undefined;
					if (trailing && lastArgs) return invokeFunc(time);
					lastArgs = lastThis = undefined;
					return result;
				}
				function cancel() {
					if (timerId !== undefined) clearTimeout(timerId);
					lastInvokeTime = 0;
					lastArgs = lastCallTime = lastThis = timerId = undefined;
				}
				function flush() {
					return timerId === undefined ? result : trailingEdge(now());
				}
				function debounced() {
					var time = now(), isInvoking = shouldInvoke(time);
					lastArgs = arguments;
					lastThis = this;
					lastCallTime = time;
					if (isInvoking) {
						if (timerId === undefined) return leadingEdge(lastCallTime);
						if (maxing) {
							clearTimeout(timerId);
							timerId = setTimeout(timerExpired, wait);
							return invokeFunc(lastCallTime);
						}
					}
					if (timerId === undefined) timerId = setTimeout(timerExpired, wait);
					return result;
				}
				debounced.cancel = cancel;
				debounced.flush = flush;
				return debounced;
			}
			/**
			* Defers invoking the `func` until the current call stack has cleared. Any
			* additional arguments are provided to `func` when it's invoked.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to defer.
			* @param {...*} [args] The arguments to invoke `func` with.
			* @returns {number} Returns the timer id.
			* @example
			*
			* _.defer(function(text) {
			*   console.log(text);
			* }, 'deferred');
			* // => Logs 'deferred' after one millisecond.
			*/
			var defer = baseRest(function(func, args) {
				return baseDelay(func, 1, args);
			});
			/**
			* Invokes `func` after `wait` milliseconds. Any additional arguments are
			* provided to `func` when it's invoked.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to delay.
			* @param {number} wait The number of milliseconds to delay invocation.
			* @param {...*} [args] The arguments to invoke `func` with.
			* @returns {number} Returns the timer id.
			* @example
			*
			* _.delay(function(text) {
			*   console.log(text);
			* }, 1000, 'later');
			* // => Logs 'later' after one second.
			*/
			var delay = baseRest(function(func, wait, args) {
				return baseDelay(func, toNumber(wait) || 0, args);
			});
			/**
			* Creates a function that invokes `func` with arguments reversed.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Function
			* @param {Function} func The function to flip arguments for.
			* @returns {Function} Returns the new flipped function.
			* @example
			*
			* var flipped = _.flip(function() {
			*   return _.toArray(arguments);
			* });
			*
			* flipped('a', 'b', 'c', 'd');
			* // => ['d', 'c', 'b', 'a']
			*/
			function flip(func) {
				return createWrap(func, WRAP_FLIP_FLAG);
			}
			/**
			* Creates a function that memoizes the result of `func`. If `resolver` is
			* provided, it determines the cache key for storing the result based on the
			* arguments provided to the memoized function. By default, the first argument
			* provided to the memoized function is used as the map cache key. The `func`
			* is invoked with the `this` binding of the memoized function.
			*
			* **Note:** The cache is exposed as the `cache` property on the memoized
			* function. Its creation may be customized by replacing the `_.memoize.Cache`
			* constructor with one whose instances implement the
			* [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
			* method interface of `clear`, `delete`, `get`, `has`, and `set`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to have its output memoized.
			* @param {Function} [resolver] The function to resolve the cache key.
			* @returns {Function} Returns the new memoized function.
			* @example
			*
			* var object = { 'a': 1, 'b': 2 };
			* var other = { 'c': 3, 'd': 4 };
			*
			* var values = _.memoize(_.values);
			* values(object);
			* // => [1, 2]
			*
			* values(other);
			* // => [3, 4]
			*
			* object.a = 2;
			* values(object);
			* // => [1, 2]
			*
			* // Modify the result cache.
			* values.cache.set(object, ['a', 'b']);
			* values(object);
			* // => ['a', 'b']
			*
			* // Replace `_.memoize.Cache`.
			* _.memoize.Cache = WeakMap;
			*/
			function memoize(func, resolver) {
				if (typeof func != "function" || resolver != null && typeof resolver != "function") throw new TypeError(FUNC_ERROR_TEXT);
				var memoized = function() {
					var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
					if (cache.has(key)) return cache.get(key);
					var result = func.apply(this, args);
					memoized.cache = cache.set(key, result) || cache;
					return result;
				};
				memoized.cache = new (memoize.Cache || MapCache)();
				return memoized;
			}
			memoize.Cache = MapCache;
			/**
			* Creates a function that negates the result of the predicate `func`. The
			* `func` predicate is invoked with the `this` binding and arguments of the
			* created function.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {Function} predicate The predicate to negate.
			* @returns {Function} Returns the new negated function.
			* @example
			*
			* function isEven(n) {
			*   return n % 2 == 0;
			* }
			*
			* _.filter([1, 2, 3, 4, 5, 6], _.negate(isEven));
			* // => [1, 3, 5]
			*/
			function negate(predicate) {
				if (typeof predicate != "function") throw new TypeError(FUNC_ERROR_TEXT);
				return function() {
					var args = arguments;
					switch (args.length) {
						case 0: return !predicate.call(this);
						case 1: return !predicate.call(this, args[0]);
						case 2: return !predicate.call(this, args[0], args[1]);
						case 3: return !predicate.call(this, args[0], args[1], args[2]);
					}
					return !predicate.apply(this, args);
				};
			}
			/**
			* Creates a function that is restricted to invoking `func` once. Repeat calls
			* to the function return the value of the first invocation. The `func` is
			* invoked with the `this` binding and arguments of the created function.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to restrict.
			* @returns {Function} Returns the new restricted function.
			* @example
			*
			* var initialize = _.once(createApplication);
			* initialize();
			* initialize();
			* // => `createApplication` is invoked once
			*/
			function once(func) {
				return before(2, func);
			}
			/**
			* Creates a function that invokes `func` with its arguments transformed.
			*
			* @static
			* @since 4.0.0
			* @memberOf _
			* @category Function
			* @param {Function} func The function to wrap.
			* @param {...(Function|Function[])} [transforms=[_.identity]]
			*  The argument transforms.
			* @returns {Function} Returns the new function.
			* @example
			*
			* function doubled(n) {
			*   return n * 2;
			* }
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var func = _.overArgs(function(x, y) {
			*   return [x, y];
			* }, [square, doubled]);
			*
			* func(9, 3);
			* // => [81, 6]
			*
			* func(10, 5);
			* // => [100, 10]
			*/
			var overArgs = castRest(function(func, transforms) {
				transforms = transforms.length == 1 && isArray(transforms[0]) ? arrayMap(transforms[0], baseUnary(getIteratee())) : arrayMap(baseFlatten(transforms, 1), baseUnary(getIteratee()));
				var funcsLength = transforms.length;
				return baseRest(function(args) {
					var index = -1, length = nativeMin(args.length, funcsLength);
					while (++index < length) args[index] = transforms[index].call(this, args[index]);
					return apply(func, this, args);
				});
			});
			/**
			* Creates a function that invokes `func` with `partials` prepended to the
			* arguments it receives. This method is like `_.bind` except it does **not**
			* alter the `this` binding.
			*
			* The `_.partial.placeholder` value, which defaults to `_` in monolithic
			* builds, may be used as a placeholder for partially applied arguments.
			*
			* **Note:** This method doesn't set the "length" property of partially
			* applied functions.
			*
			* @static
			* @memberOf _
			* @since 0.2.0
			* @category Function
			* @param {Function} func The function to partially apply arguments to.
			* @param {...*} [partials] The arguments to be partially applied.
			* @returns {Function} Returns the new partially applied function.
			* @example
			*
			* function greet(greeting, name) {
			*   return greeting + ' ' + name;
			* }
			*
			* var sayHelloTo = _.partial(greet, 'hello');
			* sayHelloTo('fred');
			* // => 'hello fred'
			*
			* // Partially applied with placeholders.
			* var greetFred = _.partial(greet, _, 'fred');
			* greetFred('hi');
			* // => 'hi fred'
			*/
			var partial = baseRest(function(func, partials) {
				return createWrap(func, WRAP_PARTIAL_FLAG, undefined, partials, replaceHolders(partials, getHolder(partial)));
			});
			/**
			* This method is like `_.partial` except that partially applied arguments
			* are appended to the arguments it receives.
			*
			* The `_.partialRight.placeholder` value, which defaults to `_` in monolithic
			* builds, may be used as a placeholder for partially applied arguments.
			*
			* **Note:** This method doesn't set the "length" property of partially
			* applied functions.
			*
			* @static
			* @memberOf _
			* @since 1.0.0
			* @category Function
			* @param {Function} func The function to partially apply arguments to.
			* @param {...*} [partials] The arguments to be partially applied.
			* @returns {Function} Returns the new partially applied function.
			* @example
			*
			* function greet(greeting, name) {
			*   return greeting + ' ' + name;
			* }
			*
			* var greetFred = _.partialRight(greet, 'fred');
			* greetFred('hi');
			* // => 'hi fred'
			*
			* // Partially applied with placeholders.
			* var sayHelloTo = _.partialRight(greet, 'hello', _);
			* sayHelloTo('fred');
			* // => 'hello fred'
			*/
			var partialRight = baseRest(function(func, partials) {
				return createWrap(func, WRAP_PARTIAL_RIGHT_FLAG, undefined, partials, replaceHolders(partials, getHolder(partialRight)));
			});
			/**
			* Creates a function that invokes `func` with arguments arranged according
			* to the specified `indexes` where the argument value at the first index is
			* provided as the first argument, the argument value at the second index is
			* provided as the second argument, and so on.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Function
			* @param {Function} func The function to rearrange arguments for.
			* @param {...(number|number[])} indexes The arranged argument indexes.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var rearged = _.rearg(function(a, b, c) {
			*   return [a, b, c];
			* }, [2, 0, 1]);
			*
			* rearged('b', 'c', 'a')
			* // => ['a', 'b', 'c']
			*/
			var rearg = flatRest(function(func, indexes) {
				return createWrap(func, WRAP_REARG_FLAG, undefined, undefined, undefined, indexes);
			});
			/**
			* Creates a function that invokes `func` with the `this` binding of the
			* created function and arguments from `start` and beyond provided as
			* an array.
			*
			* **Note:** This method is based on the
			* [rest parameter](https://mdn.io/rest_parameters).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Function
			* @param {Function} func The function to apply a rest parameter to.
			* @param {number} [start=func.length-1] The start position of the rest parameter.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var say = _.rest(function(what, names) {
			*   return what + ' ' + _.initial(names).join(', ') +
			*     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
			* });
			*
			* say('hello', 'fred', 'barney', 'pebbles');
			* // => 'hello fred, barney, & pebbles'
			*/
			function rest(func, start) {
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				start = start === undefined ? start : toInteger(start);
				return baseRest(func, start);
			}
			/**
			* Creates a function that invokes `func` with the `this` binding of the
			* create function and an array of arguments much like
			* [`Function#apply`](http://www.ecma-international.org/ecma-262/7.0/#sec-function.prototype.apply).
			*
			* **Note:** This method is based on the
			* [spread operator](https://mdn.io/spread_operator).
			*
			* @static
			* @memberOf _
			* @since 3.2.0
			* @category Function
			* @param {Function} func The function to spread arguments over.
			* @param {number} [start=0] The start position of the spread.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var say = _.spread(function(who, what) {
			*   return who + ' says ' + what;
			* });
			*
			* say(['fred', 'hello']);
			* // => 'fred says hello'
			*
			* var numbers = Promise.all([
			*   Promise.resolve(40),
			*   Promise.resolve(36)
			* ]);
			*
			* numbers.then(_.spread(function(x, y) {
			*   return x + y;
			* }));
			* // => a Promise of 76
			*/
			function spread(func, start) {
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				start = start == null ? 0 : nativeMax(toInteger(start), 0);
				return baseRest(function(args) {
					var array = args[start], otherArgs = castSlice(args, 0, start);
					if (array) arrayPush(otherArgs, array);
					return apply(func, this, otherArgs);
				});
			}
			/**
			* Creates a throttled function that only invokes `func` at most once per
			* every `wait` milliseconds. The throttled function comes with a `cancel`
			* method to cancel delayed `func` invocations and a `flush` method to
			* immediately invoke them. Provide `options` to indicate whether `func`
			* should be invoked on the leading and/or trailing edge of the `wait`
			* timeout. The `func` is invoked with the last arguments provided to the
			* throttled function. Subsequent calls to the throttled function return the
			* result of the last `func` invocation.
			*
			* **Note:** If `leading` and `trailing` options are `true`, `func` is
			* invoked on the trailing edge of the timeout only if the throttled function
			* is invoked more than once during the `wait` timeout.
			*
			* If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
			* until to the next tick, similar to `setTimeout` with a timeout of `0`.
			*
			* See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
			* for details over the differences between `_.throttle` and `_.debounce`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {Function} func The function to throttle.
			* @param {number} [wait=0] The number of milliseconds to throttle invocations to.
			* @param {Object} [options={}] The options object.
			* @param {boolean} [options.leading=true]
			*  Specify invoking on the leading edge of the timeout.
			* @param {boolean} [options.trailing=true]
			*  Specify invoking on the trailing edge of the timeout.
			* @returns {Function} Returns the new throttled function.
			* @example
			*
			* // Avoid excessively updating the position while scrolling.
			* jQuery(window).on('scroll', _.throttle(updatePosition, 100));
			*
			* // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
			* var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
			* jQuery(element).on('click', throttled);
			*
			* // Cancel the trailing throttled invocation.
			* jQuery(window).on('popstate', throttled.cancel);
			*/
			function throttle(func, wait, options) {
				var leading = true, trailing = true;
				if (typeof func != "function") throw new TypeError(FUNC_ERROR_TEXT);
				if (isObject(options)) {
					leading = "leading" in options ? !!options.leading : leading;
					trailing = "trailing" in options ? !!options.trailing : trailing;
				}
				return debounce(func, wait, {
					"leading": leading,
					"maxWait": wait,
					"trailing": trailing
				});
			}
			/**
			* Creates a function that accepts up to one argument, ignoring any
			* additional arguments.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Function
			* @param {Function} func The function to cap arguments for.
			* @returns {Function} Returns the new capped function.
			* @example
			*
			* _.map(['6', '8', '10'], _.unary(parseInt));
			* // => [6, 8, 10]
			*/
			function unary(func) {
				return ary(func, 1);
			}
			/**
			* Creates a function that provides `value` to `wrapper` as its first
			* argument. Any additional arguments provided to the function are appended
			* to those provided to the `wrapper`. The wrapper is invoked with the `this`
			* binding of the created function.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Function
			* @param {*} value The value to wrap.
			* @param {Function} [wrapper=identity] The wrapper function.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var p = _.wrap(_.escape, function(func, text) {
			*   return '<p>' + func(text) + '</p>';
			* });
			*
			* p('fred, barney, & pebbles');
			* // => '<p>fred, barney, &amp; pebbles</p>'
			*/
			function wrap(value, wrapper) {
				return partial(castFunction(wrapper), value);
			}
			/**
			* Casts `value` as an array if it's not one.
			*
			* @static
			* @memberOf _
			* @since 4.4.0
			* @category Lang
			* @param {*} value The value to inspect.
			* @returns {Array} Returns the cast array.
			* @example
			*
			* _.castArray(1);
			* // => [1]
			*
			* _.castArray({ 'a': 1 });
			* // => [{ 'a': 1 }]
			*
			* _.castArray('abc');
			* // => ['abc']
			*
			* _.castArray(null);
			* // => [null]
			*
			* _.castArray(undefined);
			* // => [undefined]
			*
			* _.castArray();
			* // => []
			*
			* var array = [1, 2, 3];
			* console.log(_.castArray(array) === array);
			* // => true
			*/
			function castArray() {
				if (!arguments.length) return [];
				var value = arguments[0];
				return isArray(value) ? value : [value];
			}
			/**
			* Creates a shallow clone of `value`.
			*
			* **Note:** This method is loosely based on the
			* [structured clone algorithm](https://mdn.io/Structured_clone_algorithm)
			* and supports cloning arrays, array buffers, booleans, date objects, maps,
			* numbers, `Object` objects, regexes, sets, strings, symbols, and typed
			* arrays. The own enumerable properties of `arguments` objects are cloned
			* as plain objects. An empty object is returned for uncloneable values such
			* as error objects, functions, DOM nodes, and WeakMaps.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to clone.
			* @returns {*} Returns the cloned value.
			* @see _.cloneDeep
			* @example
			*
			* var objects = [{ 'a': 1 }, { 'b': 2 }];
			*
			* var shallow = _.clone(objects);
			* console.log(shallow[0] === objects[0]);
			* // => true
			*/
			function clone(value) {
				return baseClone(value, CLONE_SYMBOLS_FLAG);
			}
			/**
			* This method is like `_.clone` except that it accepts `customizer` which
			* is invoked to produce the cloned value. If `customizer` returns `undefined`,
			* cloning is handled by the method instead. The `customizer` is invoked with
			* up to four arguments; (value [, index|key, object, stack]).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to clone.
			* @param {Function} [customizer] The function to customize cloning.
			* @returns {*} Returns the cloned value.
			* @see _.cloneDeepWith
			* @example
			*
			* function customizer(value) {
			*   if (_.isElement(value)) {
			*     return value.cloneNode(false);
			*   }
			* }
			*
			* var el = _.cloneWith(document.body, customizer);
			*
			* console.log(el === document.body);
			* // => false
			* console.log(el.nodeName);
			* // => 'BODY'
			* console.log(el.childNodes.length);
			* // => 0
			*/
			function cloneWith(value, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return baseClone(value, CLONE_SYMBOLS_FLAG, customizer);
			}
			/**
			* This method is like `_.clone` except that it recursively clones `value`.
			*
			* @static
			* @memberOf _
			* @since 1.0.0
			* @category Lang
			* @param {*} value The value to recursively clone.
			* @returns {*} Returns the deep cloned value.
			* @see _.clone
			* @example
			*
			* var objects = [{ 'a': 1 }, { 'b': 2 }];
			*
			* var deep = _.cloneDeep(objects);
			* console.log(deep[0] === objects[0]);
			* // => false
			*/
			function cloneDeep(value) {
				return baseClone(value, 5);
			}
			/**
			* This method is like `_.cloneWith` except that it recursively clones `value`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to recursively clone.
			* @param {Function} [customizer] The function to customize cloning.
			* @returns {*} Returns the deep cloned value.
			* @see _.cloneWith
			* @example
			*
			* function customizer(value) {
			*   if (_.isElement(value)) {
			*     return value.cloneNode(true);
			*   }
			* }
			*
			* var el = _.cloneDeepWith(document.body, customizer);
			*
			* console.log(el === document.body);
			* // => false
			* console.log(el.nodeName);
			* // => 'BODY'
			* console.log(el.childNodes.length);
			* // => 20
			*/
			function cloneDeepWith(value, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return baseClone(value, 5, customizer);
			}
			/**
			* Checks if `object` conforms to `source` by invoking the predicate
			* properties of `source` with the corresponding property values of `object`.
			*
			* **Note:** This method is equivalent to `_.conforms` when `source` is
			* partially applied.
			*
			* @static
			* @memberOf _
			* @since 4.14.0
			* @category Lang
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property predicates to conform to.
			* @returns {boolean} Returns `true` if `object` conforms, else `false`.
			* @example
			*
			* var object = { 'a': 1, 'b': 2 };
			*
			* _.conformsTo(object, { 'b': function(n) { return n > 1; } });
			* // => true
			*
			* _.conformsTo(object, { 'b': function(n) { return n > 2; } });
			* // => false
			*/
			function conformsTo(object, source) {
				return source == null || baseConformsTo(object, source, keys(source));
			}
			/**
			* Performs a
			* [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
			* comparison between two values to determine if they are equivalent.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
			* @example
			*
			* var object = { 'a': 1 };
			* var other = { 'a': 1 };
			*
			* _.eq(object, object);
			* // => true
			*
			* _.eq(object, other);
			* // => false
			*
			* _.eq('a', 'a');
			* // => true
			*
			* _.eq('a', Object('a'));
			* // => false
			*
			* _.eq(NaN, NaN);
			* // => true
			*/
			function eq(value, other) {
				return value === other || value !== value && other !== other;
			}
			/**
			* Checks if `value` is greater than `other`.
			*
			* @static
			* @memberOf _
			* @since 3.9.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is greater than `other`,
			*  else `false`.
			* @see _.lt
			* @example
			*
			* _.gt(3, 1);
			* // => true
			*
			* _.gt(3, 3);
			* // => false
			*
			* _.gt(1, 3);
			* // => false
			*/
			var gt = createRelationalOperation(baseGt);
			/**
			* Checks if `value` is greater than or equal to `other`.
			*
			* @static
			* @memberOf _
			* @since 3.9.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is greater than or equal to
			*  `other`, else `false`.
			* @see _.lte
			* @example
			*
			* _.gte(3, 1);
			* // => true
			*
			* _.gte(3, 3);
			* // => true
			*
			* _.gte(1, 3);
			* // => false
			*/
			var gte = createRelationalOperation(function(value, other) {
				return value >= other;
			});
			/**
			* Checks if `value` is likely an `arguments` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an `arguments` object,
			*  else `false`.
			* @example
			*
			* _.isArguments(function() { return arguments; }());
			* // => true
			*
			* _.isArguments([1, 2, 3]);
			* // => false
			*/
			var isArguments = baseIsArguments(function() {
				return arguments;
			}()) ? baseIsArguments : function(value) {
				return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
			};
			/**
			* Checks if `value` is classified as an `Array` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an array, else `false`.
			* @example
			*
			* _.isArray([1, 2, 3]);
			* // => true
			*
			* _.isArray(document.body.children);
			* // => false
			*
			* _.isArray('abc');
			* // => false
			*
			* _.isArray(_.noop);
			* // => false
			*/
			var isArray = Array.isArray;
			/**
			* Checks if `value` is classified as an `ArrayBuffer` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an array buffer, else `false`.
			* @example
			*
			* _.isArrayBuffer(new ArrayBuffer(2));
			* // => true
			*
			* _.isArrayBuffer(new Array(2));
			* // => false
			*/
			var isArrayBuffer = nodeIsArrayBuffer ? baseUnary(nodeIsArrayBuffer) : baseIsArrayBuffer;
			/**
			* Checks if `value` is array-like. A value is considered array-like if it's
			* not a function and has a `value.length` that's an integer greater than or
			* equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is array-like, else `false`.
			* @example
			*
			* _.isArrayLike([1, 2, 3]);
			* // => true
			*
			* _.isArrayLike(document.body.children);
			* // => true
			*
			* _.isArrayLike('abc');
			* // => true
			*
			* _.isArrayLike(_.noop);
			* // => false
			*/
			function isArrayLike(value) {
				return value != null && isLength(value.length) && !isFunction(value);
			}
			/**
			* This method is like `_.isArrayLike` except that it also checks if `value`
			* is an object.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an array-like object,
			*  else `false`.
			* @example
			*
			* _.isArrayLikeObject([1, 2, 3]);
			* // => true
			*
			* _.isArrayLikeObject(document.body.children);
			* // => true
			*
			* _.isArrayLikeObject('abc');
			* // => false
			*
			* _.isArrayLikeObject(_.noop);
			* // => false
			*/
			function isArrayLikeObject(value) {
				return isObjectLike(value) && isArrayLike(value);
			}
			/**
			* Checks if `value` is classified as a boolean primitive or object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a boolean, else `false`.
			* @example
			*
			* _.isBoolean(false);
			* // => true
			*
			* _.isBoolean(null);
			* // => false
			*/
			function isBoolean(value) {
				return value === true || value === false || isObjectLike(value) && baseGetTag(value) == boolTag;
			}
			/**
			* Checks if `value` is a buffer.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
			* @example
			*
			* _.isBuffer(new Buffer(2));
			* // => true
			*
			* _.isBuffer(new Uint8Array(2));
			* // => false
			*/
			var isBuffer = nativeIsBuffer || stubFalse;
			/**
			* Checks if `value` is classified as a `Date` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a date object, else `false`.
			* @example
			*
			* _.isDate(new Date);
			* // => true
			*
			* _.isDate('Mon April 23 2012');
			* // => false
			*/
			var isDate = nodeIsDate ? baseUnary(nodeIsDate) : baseIsDate;
			/**
			* Checks if `value` is likely a DOM element.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a DOM element, else `false`.
			* @example
			*
			* _.isElement(document.body);
			* // => true
			*
			* _.isElement('<body>');
			* // => false
			*/
			function isElement(value) {
				return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value);
			}
			/**
			* Checks if `value` is an empty object, collection, map, or set.
			*
			* Objects are considered empty if they have no own enumerable string keyed
			* properties.
			*
			* Array-like values such as `arguments` objects, arrays, buffers, strings, or
			* jQuery-like collections are considered empty if they have a `length` of `0`.
			* Similarly, maps and sets are considered empty if they have a `size` of `0`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is empty, else `false`.
			* @example
			*
			* _.isEmpty(null);
			* // => true
			*
			* _.isEmpty(true);
			* // => true
			*
			* _.isEmpty(1);
			* // => true
			*
			* _.isEmpty([1, 2, 3]);
			* // => false
			*
			* _.isEmpty({ 'a': 1 });
			* // => false
			*/
			function isEmpty(value) {
				if (value == null) return true;
				if (isArrayLike(value) && (isArray(value) || typeof value == "string" || typeof value.splice == "function" || isBuffer(value) || isTypedArray(value) || isArguments(value))) return !value.length;
				var tag = getTag(value);
				if (tag == mapTag || tag == setTag) return !value.size;
				if (isPrototype(value)) return !baseKeys(value).length;
				for (var key in value) if (hasOwnProperty.call(value, key)) return false;
				return true;
			}
			/**
			* Performs a deep comparison between two values to determine if they are
			* equivalent.
			*
			* **Note:** This method supports comparing arrays, array buffers, booleans,
			* date objects, error objects, maps, numbers, `Object` objects, regexes,
			* sets, strings, symbols, and typed arrays. `Object` objects are compared
			* by their own, not inherited, enumerable properties. Functions and DOM
			* nodes are compared by strict equality, i.e. `===`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
			* @example
			*
			* var object = { 'a': 1 };
			* var other = { 'a': 1 };
			*
			* _.isEqual(object, other);
			* // => true
			*
			* object === other;
			* // => false
			*/
			function isEqual(value, other) {
				return baseIsEqual(value, other);
			}
			/**
			* This method is like `_.isEqual` except that it accepts `customizer` which
			* is invoked to compare values. If `customizer` returns `undefined`, comparisons
			* are handled by the method instead. The `customizer` is invoked with up to
			* six arguments: (objValue, othValue [, index|key, object, other, stack]).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @param {Function} [customizer] The function to customize comparisons.
			* @returns {boolean} Returns `true` if the values are equivalent, else `false`.
			* @example
			*
			* function isGreeting(value) {
			*   return /^h(?:i|ello)$/.test(value);
			* }
			*
			* function customizer(objValue, othValue) {
			*   if (isGreeting(objValue) && isGreeting(othValue)) {
			*     return true;
			*   }
			* }
			*
			* var array = ['hello', 'goodbye'];
			* var other = ['hi', 'goodbye'];
			*
			* _.isEqualWith(array, other, customizer);
			* // => true
			*/
			function isEqualWith(value, other, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				var result = customizer ? customizer(value, other) : undefined;
				return result === undefined ? baseIsEqual(value, other, undefined, customizer) : !!result;
			}
			/**
			* Checks if `value` is an `Error`, `EvalError`, `RangeError`, `ReferenceError`,
			* `SyntaxError`, `TypeError`, or `URIError` object.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an error object, else `false`.
			* @example
			*
			* _.isError(new Error);
			* // => true
			*
			* _.isError(Error);
			* // => false
			*/
			function isError(value) {
				if (!isObjectLike(value)) return false;
				var tag = baseGetTag(value);
				return tag == errorTag || tag == domExcTag || typeof value.message == "string" && typeof value.name == "string" && !isPlainObject(value);
			}
			/**
			* Checks if `value` is a finite primitive number.
			*
			* **Note:** This method is based on
			* [`Number.isFinite`](https://mdn.io/Number/isFinite).
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a finite number, else `false`.
			* @example
			*
			* _.isFinite(3);
			* // => true
			*
			* _.isFinite(Number.MIN_VALUE);
			* // => true
			*
			* _.isFinite(Infinity);
			* // => false
			*
			* _.isFinite('3');
			* // => false
			*/
			function isFinite(value) {
				return typeof value == "number" && nativeIsFinite(value);
			}
			/**
			* Checks if `value` is classified as a `Function` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a function, else `false`.
			* @example
			*
			* _.isFunction(_);
			* // => true
			*
			* _.isFunction(/abc/);
			* // => false
			*/
			function isFunction(value) {
				if (!isObject(value)) return false;
				var tag = baseGetTag(value);
				return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
			}
			/**
			* Checks if `value` is an integer.
			*
			* **Note:** This method is based on
			* [`Number.isInteger`](https://mdn.io/Number/isInteger).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an integer, else `false`.
			* @example
			*
			* _.isInteger(3);
			* // => true
			*
			* _.isInteger(Number.MIN_VALUE);
			* // => false
			*
			* _.isInteger(Infinity);
			* // => false
			*
			* _.isInteger('3');
			* // => false
			*/
			function isInteger(value) {
				return typeof value == "number" && value == toInteger(value);
			}
			/**
			* Checks if `value` is a valid array-like length.
			*
			* **Note:** This method is loosely based on
			* [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
			* @example
			*
			* _.isLength(3);
			* // => true
			*
			* _.isLength(Number.MIN_VALUE);
			* // => false
			*
			* _.isLength(Infinity);
			* // => false
			*
			* _.isLength('3');
			* // => false
			*/
			function isLength(value) {
				return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
			}
			/**
			* Checks if `value` is the
			* [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
			* of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is an object, else `false`.
			* @example
			*
			* _.isObject({});
			* // => true
			*
			* _.isObject([1, 2, 3]);
			* // => true
			*
			* _.isObject(_.noop);
			* // => true
			*
			* _.isObject(null);
			* // => false
			*/
			function isObject(value) {
				var type = typeof value;
				return value != null && (type == "object" || type == "function");
			}
			/**
			* Checks if `value` is object-like. A value is object-like if it's not `null`
			* and has a `typeof` result of "object".
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is object-like, else `false`.
			* @example
			*
			* _.isObjectLike({});
			* // => true
			*
			* _.isObjectLike([1, 2, 3]);
			* // => true
			*
			* _.isObjectLike(_.noop);
			* // => false
			*
			* _.isObjectLike(null);
			* // => false
			*/
			function isObjectLike(value) {
				return value != null && typeof value == "object";
			}
			/**
			* Checks if `value` is classified as a `Map` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a map, else `false`.
			* @example
			*
			* _.isMap(new Map);
			* // => true
			*
			* _.isMap(new WeakMap);
			* // => false
			*/
			var isMap = nodeIsMap ? baseUnary(nodeIsMap) : baseIsMap;
			/**
			* Performs a partial deep comparison between `object` and `source` to
			* determine if `object` contains equivalent property values.
			*
			* **Note:** This method is equivalent to `_.matches` when `source` is
			* partially applied.
			*
			* Partial comparisons will match empty array and empty object `source`
			* values against any array or object value, respectively. See `_.isEqual`
			* for a list of supported value comparisons.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property values to match.
			* @returns {boolean} Returns `true` if `object` is a match, else `false`.
			* @example
			*
			* var object = { 'a': 1, 'b': 2 };
			*
			* _.isMatch(object, { 'b': 2 });
			* // => true
			*
			* _.isMatch(object, { 'b': 1 });
			* // => false
			*/
			function isMatch(object, source) {
				return object === source || baseIsMatch(object, source, getMatchData(source));
			}
			/**
			* This method is like `_.isMatch` except that it accepts `customizer` which
			* is invoked to compare values. If `customizer` returns `undefined`, comparisons
			* are handled by the method instead. The `customizer` is invoked with five
			* arguments: (objValue, srcValue, index|key, object, source).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {Object} object The object to inspect.
			* @param {Object} source The object of property values to match.
			* @param {Function} [customizer] The function to customize comparisons.
			* @returns {boolean} Returns `true` if `object` is a match, else `false`.
			* @example
			*
			* function isGreeting(value) {
			*   return /^h(?:i|ello)$/.test(value);
			* }
			*
			* function customizer(objValue, srcValue) {
			*   if (isGreeting(objValue) && isGreeting(srcValue)) {
			*     return true;
			*   }
			* }
			*
			* var object = { 'greeting': 'hello' };
			* var source = { 'greeting': 'hi' };
			*
			* _.isMatchWith(object, source, customizer);
			* // => true
			*/
			function isMatchWith(object, source, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return baseIsMatch(object, source, getMatchData(source), customizer);
			}
			/**
			* Checks if `value` is `NaN`.
			*
			* **Note:** This method is based on
			* [`Number.isNaN`](https://mdn.io/Number/isNaN) and is not the same as
			* global [`isNaN`](https://mdn.io/isNaN) which returns `true` for
			* `undefined` and other non-number values.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
			* @example
			*
			* _.isNaN(NaN);
			* // => true
			*
			* _.isNaN(new Number(NaN));
			* // => true
			*
			* isNaN(undefined);
			* // => true
			*
			* _.isNaN(undefined);
			* // => false
			*/
			function isNaN(value) {
				return isNumber(value) && value != +value;
			}
			/**
			* Checks if `value` is a pristine native function.
			*
			* **Note:** This method can't reliably detect native functions in the presence
			* of the core-js package because core-js circumvents this kind of detection.
			* Despite multiple requests, the core-js maintainer has made it clear: any
			* attempt to fix the detection will be obstructed. As a result, we're left
			* with little choice but to throw an error. Unfortunately, this also affects
			* packages, like [babel-polyfill](https://www.npmjs.com/package/babel-polyfill),
			* which rely on core-js.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a native function,
			*  else `false`.
			* @example
			*
			* _.isNative(Array.prototype.push);
			* // => true
			*
			* _.isNative(_);
			* // => false
			*/
			function isNative(value) {
				if (isMaskable(value)) throw new Error(CORE_ERROR_TEXT);
				return baseIsNative(value);
			}
			/**
			* Checks if `value` is `null`.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is `null`, else `false`.
			* @example
			*
			* _.isNull(null);
			* // => true
			*
			* _.isNull(void 0);
			* // => false
			*/
			function isNull(value) {
				return value === null;
			}
			/**
			* Checks if `value` is `null` or `undefined`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is nullish, else `false`.
			* @example
			*
			* _.isNil(null);
			* // => true
			*
			* _.isNil(void 0);
			* // => true
			*
			* _.isNil(NaN);
			* // => false
			*/
			function isNil(value) {
				return value == null;
			}
			/**
			* Checks if `value` is classified as a `Number` primitive or object.
			*
			* **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are
			* classified as numbers, use the `_.isFinite` method.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a number, else `false`.
			* @example
			*
			* _.isNumber(3);
			* // => true
			*
			* _.isNumber(Number.MIN_VALUE);
			* // => true
			*
			* _.isNumber(Infinity);
			* // => true
			*
			* _.isNumber('3');
			* // => false
			*/
			function isNumber(value) {
				return typeof value == "number" || isObjectLike(value) && baseGetTag(value) == numberTag;
			}
			/**
			* Checks if `value` is a plain object, that is, an object created by the
			* `Object` constructor or one with a `[[Prototype]]` of `null`.
			*
			* @static
			* @memberOf _
			* @since 0.8.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			* }
			*
			* _.isPlainObject(new Foo);
			* // => false
			*
			* _.isPlainObject([1, 2, 3]);
			* // => false
			*
			* _.isPlainObject({ 'x': 0, 'y': 0 });
			* // => true
			*
			* _.isPlainObject(Object.create(null));
			* // => true
			*/
			function isPlainObject(value) {
				if (!isObjectLike(value) || baseGetTag(value) != objectTag) return false;
				var proto = getPrototype(value);
				if (proto === null) return true;
				var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
				return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
			}
			/**
			* Checks if `value` is classified as a `RegExp` object.
			*
			* @static
			* @memberOf _
			* @since 0.1.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a regexp, else `false`.
			* @example
			*
			* _.isRegExp(/abc/);
			* // => true
			*
			* _.isRegExp('/abc/');
			* // => false
			*/
			var isRegExp = nodeIsRegExp ? baseUnary(nodeIsRegExp) : baseIsRegExp;
			/**
			* Checks if `value` is a safe integer. An integer is safe if it's an IEEE-754
			* double precision number which isn't the result of a rounded unsafe integer.
			*
			* **Note:** This method is based on
			* [`Number.isSafeInteger`](https://mdn.io/Number/isSafeInteger).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a safe integer, else `false`.
			* @example
			*
			* _.isSafeInteger(3);
			* // => true
			*
			* _.isSafeInteger(Number.MIN_VALUE);
			* // => false
			*
			* _.isSafeInteger(Infinity);
			* // => false
			*
			* _.isSafeInteger('3');
			* // => false
			*/
			function isSafeInteger(value) {
				return isInteger(value) && value >= -MAX_SAFE_INTEGER && value <= MAX_SAFE_INTEGER;
			}
			/**
			* Checks if `value` is classified as a `Set` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a set, else `false`.
			* @example
			*
			* _.isSet(new Set);
			* // => true
			*
			* _.isSet(new WeakSet);
			* // => false
			*/
			var isSet = nodeIsSet ? baseUnary(nodeIsSet) : baseIsSet;
			/**
			* Checks if `value` is classified as a `String` primitive or object.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a string, else `false`.
			* @example
			*
			* _.isString('abc');
			* // => true
			*
			* _.isString(1);
			* // => false
			*/
			function isString(value) {
				return typeof value == "string" || !isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag;
			}
			/**
			* Checks if `value` is classified as a `Symbol` primitive or object.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
			* @example
			*
			* _.isSymbol(Symbol.iterator);
			* // => true
			*
			* _.isSymbol('abc');
			* // => false
			*/
			function isSymbol(value) {
				return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
			}
			/**
			* Checks if `value` is classified as a typed array.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
			* @example
			*
			* _.isTypedArray(new Uint8Array);
			* // => true
			*
			* _.isTypedArray([]);
			* // => false
			*/
			var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
			/**
			* Checks if `value` is `undefined`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
			* @example
			*
			* _.isUndefined(void 0);
			* // => true
			*
			* _.isUndefined(null);
			* // => false
			*/
			function isUndefined(value) {
				return value === undefined;
			}
			/**
			* Checks if `value` is classified as a `WeakMap` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a weak map, else `false`.
			* @example
			*
			* _.isWeakMap(new WeakMap);
			* // => true
			*
			* _.isWeakMap(new Map);
			* // => false
			*/
			function isWeakMap(value) {
				return isObjectLike(value) && getTag(value) == weakMapTag;
			}
			/**
			* Checks if `value` is classified as a `WeakSet` object.
			*
			* @static
			* @memberOf _
			* @since 4.3.0
			* @category Lang
			* @param {*} value The value to check.
			* @returns {boolean} Returns `true` if `value` is a weak set, else `false`.
			* @example
			*
			* _.isWeakSet(new WeakSet);
			* // => true
			*
			* _.isWeakSet(new Set);
			* // => false
			*/
			function isWeakSet(value) {
				return isObjectLike(value) && baseGetTag(value) == weakSetTag;
			}
			/**
			* Checks if `value` is less than `other`.
			*
			* @static
			* @memberOf _
			* @since 3.9.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is less than `other`,
			*  else `false`.
			* @see _.gt
			* @example
			*
			* _.lt(1, 3);
			* // => true
			*
			* _.lt(3, 3);
			* // => false
			*
			* _.lt(3, 1);
			* // => false
			*/
			var lt = createRelationalOperation(baseLt);
			/**
			* Checks if `value` is less than or equal to `other`.
			*
			* @static
			* @memberOf _
			* @since 3.9.0
			* @category Lang
			* @param {*} value The value to compare.
			* @param {*} other The other value to compare.
			* @returns {boolean} Returns `true` if `value` is less than or equal to
			*  `other`, else `false`.
			* @see _.gte
			* @example
			*
			* _.lte(1, 3);
			* // => true
			*
			* _.lte(3, 3);
			* // => true
			*
			* _.lte(3, 1);
			* // => false
			*/
			var lte = createRelationalOperation(function(value, other) {
				return value <= other;
			});
			/**
			* Converts `value` to an array.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {Array} Returns the converted array.
			* @example
			*
			* _.toArray({ 'a': 1, 'b': 2 });
			* // => [1, 2]
			*
			* _.toArray('abc');
			* // => ['a', 'b', 'c']
			*
			* _.toArray(1);
			* // => []
			*
			* _.toArray(null);
			* // => []
			*/
			function toArray(value) {
				if (!value) return [];
				if (isArrayLike(value)) return isString(value) ? stringToArray(value) : copyArray(value);
				if (symIterator && value[symIterator]) return iteratorToArray(value[symIterator]());
				var tag = getTag(value);
				return (tag == mapTag ? mapToArray : tag == setTag ? setToArray : values)(value);
			}
			/**
			* Converts `value` to a finite number.
			*
			* @static
			* @memberOf _
			* @since 4.12.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {number} Returns the converted number.
			* @example
			*
			* _.toFinite(3.2);
			* // => 3.2
			*
			* _.toFinite(Number.MIN_VALUE);
			* // => 5e-324
			*
			* _.toFinite(Infinity);
			* // => 1.7976931348623157e+308
			*
			* _.toFinite('3.2');
			* // => 3.2
			*/
			function toFinite(value) {
				if (!value) return value === 0 ? value : 0;
				value = toNumber(value);
				if (value === INFINITY || value === -Infinity) return (value < 0 ? -1 : 1) * MAX_INTEGER;
				return value === value ? value : 0;
			}
			/**
			* Converts `value` to an integer.
			*
			* **Note:** This method is loosely based on
			* [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {number} Returns the converted integer.
			* @example
			*
			* _.toInteger(3.2);
			* // => 3
			*
			* _.toInteger(Number.MIN_VALUE);
			* // => 0
			*
			* _.toInteger(Infinity);
			* // => 1.7976931348623157e+308
			*
			* _.toInteger('3.2');
			* // => 3
			*/
			function toInteger(value) {
				var result = toFinite(value), remainder = result % 1;
				return result === result ? remainder ? result - remainder : result : 0;
			}
			/**
			* Converts `value` to an integer suitable for use as the length of an
			* array-like object.
			*
			* **Note:** This method is based on
			* [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {number} Returns the converted integer.
			* @example
			*
			* _.toLength(3.2);
			* // => 3
			*
			* _.toLength(Number.MIN_VALUE);
			* // => 0
			*
			* _.toLength(Infinity);
			* // => 4294967295
			*
			* _.toLength('3.2');
			* // => 3
			*/
			function toLength(value) {
				return value ? baseClamp(toInteger(value), 0, MAX_ARRAY_LENGTH) : 0;
			}
			/**
			* Converts `value` to a number.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to process.
			* @returns {number} Returns the number.
			* @example
			*
			* _.toNumber(3.2);
			* // => 3.2
			*
			* _.toNumber(Number.MIN_VALUE);
			* // => 5e-324
			*
			* _.toNumber(Infinity);
			* // => Infinity
			*
			* _.toNumber('3.2');
			* // => 3.2
			*/
			function toNumber(value) {
				if (typeof value == "number") return value;
				if (isSymbol(value)) return NAN;
				if (isObject(value)) {
					var other = typeof value.valueOf == "function" ? value.valueOf() : value;
					value = isObject(other) ? other + "" : other;
				}
				if (typeof value != "string") return value === 0 ? value : +value;
				value = baseTrim(value);
				var isBinary = reIsBinary.test(value);
				return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
			}
			/**
			* Converts `value` to a plain object flattening inherited enumerable string
			* keyed properties of `value` to own properties of the plain object.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {Object} Returns the converted plain object.
			* @example
			*
			* function Foo() {
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.assign({ 'a': 1 }, new Foo);
			* // => { 'a': 1, 'b': 2 }
			*
			* _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
			* // => { 'a': 1, 'b': 2, 'c': 3 }
			*/
			function toPlainObject(value) {
				return copyObject(value, keysIn(value));
			}
			/**
			* Converts `value` to a safe integer. A safe integer can be compared and
			* represented correctly.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {number} Returns the converted integer.
			* @example
			*
			* _.toSafeInteger(3.2);
			* // => 3
			*
			* _.toSafeInteger(Number.MIN_VALUE);
			* // => 0
			*
			* _.toSafeInteger(Infinity);
			* // => 9007199254740991
			*
			* _.toSafeInteger('3.2');
			* // => 3
			*/
			function toSafeInteger(value) {
				return value ? baseClamp(toInteger(value), -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER) : value === 0 ? value : 0;
			}
			/**
			* Converts `value` to a string. An empty string is returned for `null`
			* and `undefined` values. The sign of `-0` is preserved.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Lang
			* @param {*} value The value to convert.
			* @returns {string} Returns the converted string.
			* @example
			*
			* _.toString(null);
			* // => ''
			*
			* _.toString(-0);
			* // => '-0'
			*
			* _.toString([1, 2, 3]);
			* // => '1,2,3'
			*/
			function toString(value) {
				return value == null ? "" : baseToString(value);
			}
			/**
			* Assigns own enumerable string keyed properties of source objects to the
			* destination object. Source objects are applied from left to right.
			* Subsequent sources overwrite property assignments of previous sources.
			*
			* **Note:** This method mutates `object` and is loosely based on
			* [`Object.assign`](https://mdn.io/Object/assign).
			*
			* @static
			* @memberOf _
			* @since 0.10.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @see _.assignIn
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			* }
			*
			* function Bar() {
			*   this.c = 3;
			* }
			*
			* Foo.prototype.b = 2;
			* Bar.prototype.d = 4;
			*
			* _.assign({ 'a': 0 }, new Foo, new Bar);
			* // => { 'a': 1, 'c': 3 }
			*/
			var assign = createAssigner(function(object, source) {
				if (isPrototype(source) || isArrayLike(source)) {
					copyObject(source, keys(source), object);
					return;
				}
				for (var key in source) if (hasOwnProperty.call(source, key)) assignValue(object, key, source[key]);
			});
			/**
			* This method is like `_.assign` except that it iterates over own and
			* inherited source properties.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @alias extend
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @see _.assign
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			* }
			*
			* function Bar() {
			*   this.c = 3;
			* }
			*
			* Foo.prototype.b = 2;
			* Bar.prototype.d = 4;
			*
			* _.assignIn({ 'a': 0 }, new Foo, new Bar);
			* // => { 'a': 1, 'b': 2, 'c': 3, 'd': 4 }
			*/
			var assignIn = createAssigner(function(object, source) {
				copyObject(source, keysIn(source), object);
			});
			/**
			* This method is like `_.assignIn` except that it accepts `customizer`
			* which is invoked to produce the assigned values. If `customizer` returns
			* `undefined`, assignment is handled by the method instead. The `customizer`
			* is invoked with five arguments: (objValue, srcValue, key, object, source).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @alias extendWith
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} sources The source objects.
			* @param {Function} [customizer] The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @see _.assignWith
			* @example
			*
			* function customizer(objValue, srcValue) {
			*   return _.isUndefined(objValue) ? srcValue : objValue;
			* }
			*
			* var defaults = _.partialRight(_.assignInWith, customizer);
			*
			* defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
			* // => { 'a': 1, 'b': 2 }
			*/
			var assignInWith = createAssigner(function(object, source, srcIndex, customizer) {
				copyObject(source, keysIn(source), object, customizer);
			});
			/**
			* This method is like `_.assign` except that it accepts `customizer`
			* which is invoked to produce the assigned values. If `customizer` returns
			* `undefined`, assignment is handled by the method instead. The `customizer`
			* is invoked with five arguments: (objValue, srcValue, key, object, source).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} sources The source objects.
			* @param {Function} [customizer] The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @see _.assignInWith
			* @example
			*
			* function customizer(objValue, srcValue) {
			*   return _.isUndefined(objValue) ? srcValue : objValue;
			* }
			*
			* var defaults = _.partialRight(_.assignWith, customizer);
			*
			* defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
			* // => { 'a': 1, 'b': 2 }
			*/
			var assignWith = createAssigner(function(object, source, srcIndex, customizer) {
				copyObject(source, keys(source), object, customizer);
			});
			/**
			* Creates an array of values corresponding to `paths` of `object`.
			*
			* @static
			* @memberOf _
			* @since 1.0.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {...(string|string[])} [paths] The property paths to pick.
			* @returns {Array} Returns the picked values.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }, 4] };
			*
			* _.at(object, ['a[0].b.c', 'a[1]']);
			* // => [3, 4]
			*/
			var at = flatRest(baseAt);
			/**
			* Creates an object that inherits from the `prototype` object. If a
			* `properties` object is given, its own enumerable string keyed properties
			* are assigned to the created object.
			*
			* @static
			* @memberOf _
			* @since 2.3.0
			* @category Object
			* @param {Object} prototype The object to inherit from.
			* @param {Object} [properties] The properties to assign to the object.
			* @returns {Object} Returns the new object.
			* @example
			*
			* function Shape() {
			*   this.x = 0;
			*   this.y = 0;
			* }
			*
			* function Circle() {
			*   Shape.call(this);
			* }
			*
			* Circle.prototype = _.create(Shape.prototype, {
			*   'constructor': Circle
			* });
			*
			* var circle = new Circle;
			* circle instanceof Circle;
			* // => true
			*
			* circle instanceof Shape;
			* // => true
			*/
			function create(prototype, properties) {
				var result = baseCreate(prototype);
				return properties == null ? result : baseAssign(result, properties);
			}
			/**
			* Assigns own and inherited enumerable string keyed properties of source
			* objects to the destination object for all destination properties that
			* resolve to `undefined`. Source objects are applied from left to right.
			* Once a property is set, additional values of the same property are ignored.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @see _.defaultsDeep
			* @example
			*
			* _.defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
			* // => { 'a': 1, 'b': 2 }
			*/
			var defaults = baseRest(function(object, sources) {
				object = Object(object);
				var index = -1;
				var length = sources.length;
				var guard = length > 2 ? sources[2] : undefined;
				if (guard && isIterateeCall(sources[0], sources[1], guard)) length = 1;
				while (++index < length) {
					var source = sources[index];
					var props = keysIn(source);
					var propsIndex = -1;
					var propsLength = props.length;
					while (++propsIndex < propsLength) {
						var key = props[propsIndex];
						var value = object[key];
						if (value === undefined || eq(value, objectProto[key]) && !hasOwnProperty.call(object, key)) object[key] = source[key];
					}
				}
				return object;
			});
			/**
			* This method is like `_.defaults` except that it recursively assigns
			* default properties.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 3.10.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @see _.defaults
			* @example
			*
			* _.defaultsDeep({ 'a': { 'b': 2 } }, { 'a': { 'b': 1, 'c': 3 } });
			* // => { 'a': { 'b': 2, 'c': 3 } }
			*/
			var defaultsDeep = baseRest(function(args) {
				args.push(undefined, customDefaultsMerge);
				return apply(mergeWith, undefined, args);
			});
			/**
			* This method is like `_.find` except that it returns the key of the first
			* element `predicate` returns truthy for instead of the element itself.
			*
			* @static
			* @memberOf _
			* @since 1.1.0
			* @category Object
			* @param {Object} object The object to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {string|undefined} Returns the key of the matched element,
			*  else `undefined`.
			* @example
			*
			* var users = {
			*   'barney':  { 'age': 36, 'active': true },
			*   'fred':    { 'age': 40, 'active': false },
			*   'pebbles': { 'age': 1,  'active': true }
			* };
			*
			* _.findKey(users, function(o) { return o.age < 40; });
			* // => 'barney' (iteration order is not guaranteed)
			*
			* // The `_.matches` iteratee shorthand.
			* _.findKey(users, { 'age': 1, 'active': true });
			* // => 'pebbles'
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.findKey(users, ['active', false]);
			* // => 'fred'
			*
			* // The `_.property` iteratee shorthand.
			* _.findKey(users, 'active');
			* // => 'barney'
			*/
			function findKey(object, predicate) {
				return baseFindKey(object, getIteratee(predicate, 3), baseForOwn);
			}
			/**
			* This method is like `_.findKey` except that it iterates over elements of
			* a collection in the opposite order.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Object
			* @param {Object} object The object to inspect.
			* @param {Function} [predicate=_.identity] The function invoked per iteration.
			* @returns {string|undefined} Returns the key of the matched element,
			*  else `undefined`.
			* @example
			*
			* var users = {
			*   'barney':  { 'age': 36, 'active': true },
			*   'fred':    { 'age': 40, 'active': false },
			*   'pebbles': { 'age': 1,  'active': true }
			* };
			*
			* _.findLastKey(users, function(o) { return o.age < 40; });
			* // => returns 'pebbles' assuming `_.findKey` returns 'barney'
			*
			* // The `_.matches` iteratee shorthand.
			* _.findLastKey(users, { 'age': 36, 'active': true });
			* // => 'barney'
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.findLastKey(users, ['active', false]);
			* // => 'fred'
			*
			* // The `_.property` iteratee shorthand.
			* _.findLastKey(users, 'active');
			* // => 'pebbles'
			*/
			function findLastKey(object, predicate) {
				return baseFindKey(object, getIteratee(predicate, 3), baseForOwnRight);
			}
			/**
			* Iterates over own and inherited enumerable string keyed properties of an
			* object and invokes `iteratee` for each property. The iteratee is invoked
			* with three arguments: (value, key, object). Iteratee functions may exit
			* iteration early by explicitly returning `false`.
			*
			* @static
			* @memberOf _
			* @since 0.3.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns `object`.
			* @see _.forInRight
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.forIn(new Foo, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'a', 'b', then 'c' (iteration order is not guaranteed).
			*/
			function forIn(object, iteratee) {
				return object == null ? object : baseFor(object, getIteratee(iteratee, 3), keysIn);
			}
			/**
			* This method is like `_.forIn` except that it iterates over properties of
			* `object` in the opposite order.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns `object`.
			* @see _.forIn
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.forInRight(new Foo, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'c', 'b', then 'a' assuming `_.forIn` logs 'a', 'b', then 'c'.
			*/
			function forInRight(object, iteratee) {
				return object == null ? object : baseForRight(object, getIteratee(iteratee, 3), keysIn);
			}
			/**
			* Iterates over own enumerable string keyed properties of an object and
			* invokes `iteratee` for each property. The iteratee is invoked with three
			* arguments: (value, key, object). Iteratee functions may exit iteration
			* early by explicitly returning `false`.
			*
			* @static
			* @memberOf _
			* @since 0.3.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns `object`.
			* @see _.forOwnRight
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.forOwn(new Foo, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'a' then 'b' (iteration order is not guaranteed).
			*/
			function forOwn(object, iteratee) {
				return object && baseForOwn(object, getIteratee(iteratee, 3));
			}
			/**
			* This method is like `_.forOwn` except that it iterates over properties of
			* `object` in the opposite order.
			*
			* @static
			* @memberOf _
			* @since 2.0.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns `object`.
			* @see _.forOwn
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.forOwnRight(new Foo, function(value, key) {
			*   console.log(key);
			* });
			* // => Logs 'b' then 'a' assuming `_.forOwn` logs 'a' then 'b'.
			*/
			function forOwnRight(object, iteratee) {
				return object && baseForOwnRight(object, getIteratee(iteratee, 3));
			}
			/**
			* Creates an array of function property names from own enumerable properties
			* of `object`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to inspect.
			* @returns {Array} Returns the function names.
			* @see _.functionsIn
			* @example
			*
			* function Foo() {
			*   this.a = _.constant('a');
			*   this.b = _.constant('b');
			* }
			*
			* Foo.prototype.c = _.constant('c');
			*
			* _.functions(new Foo);
			* // => ['a', 'b']
			*/
			function functions(object) {
				return object == null ? [] : baseFunctions(object, keys(object));
			}
			/**
			* Creates an array of function property names from own and inherited
			* enumerable properties of `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to inspect.
			* @returns {Array} Returns the function names.
			* @see _.functions
			* @example
			*
			* function Foo() {
			*   this.a = _.constant('a');
			*   this.b = _.constant('b');
			* }
			*
			* Foo.prototype.c = _.constant('c');
			*
			* _.functionsIn(new Foo);
			* // => ['a', 'b', 'c']
			*/
			function functionsIn(object) {
				return object == null ? [] : baseFunctions(object, keysIn(object));
			}
			/**
			* Gets the value at `path` of `object`. If the resolved value is
			* `undefined`, the `defaultValue` is returned in its place.
			*
			* @static
			* @memberOf _
			* @since 3.7.0
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the property to get.
			* @param {*} [defaultValue] The value returned for `undefined` resolved values.
			* @returns {*} Returns the resolved value.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }] };
			*
			* _.get(object, 'a[0].b.c');
			* // => 3
			*
			* _.get(object, ['a', '0', 'b', 'c']);
			* // => 3
			*
			* _.get(object, 'a.b.c', 'default');
			* // => 'default'
			*/
			function get(object, path, defaultValue) {
				var result = object == null ? undefined : baseGet(object, path);
				return result === undefined ? defaultValue : result;
			}
			/**
			* Checks if `path` is a direct property of `object`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path to check.
			* @returns {boolean} Returns `true` if `path` exists, else `false`.
			* @example
			*
			* var object = { 'a': { 'b': 2 } };
			* var other = _.create({ 'a': _.create({ 'b': 2 }) });
			*
			* _.has(object, 'a');
			* // => true
			*
			* _.has(object, 'a.b');
			* // => true
			*
			* _.has(object, ['a', 'b']);
			* // => true
			*
			* _.has(other, 'a');
			* // => false
			*/
			function has(object, path) {
				return object != null && hasPath(object, path, baseHas);
			}
			/**
			* Checks if `path` is a direct or inherited property of `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path to check.
			* @returns {boolean} Returns `true` if `path` exists, else `false`.
			* @example
			*
			* var object = _.create({ 'a': _.create({ 'b': 2 }) });
			*
			* _.hasIn(object, 'a');
			* // => true
			*
			* _.hasIn(object, 'a.b');
			* // => true
			*
			* _.hasIn(object, ['a', 'b']);
			* // => true
			*
			* _.hasIn(object, 'b');
			* // => false
			*/
			function hasIn(object, path) {
				return object != null && hasPath(object, path, baseHasIn);
			}
			/**
			* Creates an object composed of the inverted keys and values of `object`.
			* If `object` contains duplicate values, subsequent values overwrite
			* property assignments of previous values.
			*
			* @static
			* @memberOf _
			* @since 0.7.0
			* @category Object
			* @param {Object} object The object to invert.
			* @returns {Object} Returns the new inverted object.
			* @example
			*
			* var object = { 'a': 1, 'b': 2, 'c': 1 };
			*
			* _.invert(object);
			* // => { '1': 'c', '2': 'b' }
			*/
			var invert = createInverter(function(result, value, key) {
				if (value != null && typeof value.toString != "function") value = nativeObjectToString.call(value);
				result[value] = key;
			}, constant(identity));
			/**
			* This method is like `_.invert` except that the inverted object is generated
			* from the results of running each element of `object` thru `iteratee`. The
			* corresponding inverted value of each inverted key is an array of keys
			* responsible for generating the inverted value. The iteratee is invoked
			* with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.1.0
			* @category Object
			* @param {Object} object The object to invert.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {Object} Returns the new inverted object.
			* @example
			*
			* var object = { 'a': 1, 'b': 2, 'c': 1 };
			*
			* _.invertBy(object);
			* // => { '1': ['a', 'c'], '2': ['b'] }
			*
			* _.invertBy(object, function(value) {
			*   return 'group' + value;
			* });
			* // => { 'group1': ['a', 'c'], 'group2': ['b'] }
			*/
			var invertBy = createInverter(function(result, value, key) {
				if (value != null && typeof value.toString != "function") value = nativeObjectToString.call(value);
				if (hasOwnProperty.call(result, value)) result[value].push(key);
				else result[value] = [key];
			}, getIteratee);
			/**
			* Invokes the method at `path` of `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the method to invoke.
			* @param {...*} [args] The arguments to invoke the method with.
			* @returns {*} Returns the result of the invoked method.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': [1, 2, 3, 4] } }] };
			*
			* _.invoke(object, 'a[0].b.c.slice', 1, 3);
			* // => [2, 3]
			*/
			var invoke = baseRest(baseInvoke);
			/**
			* Creates an array of the own enumerable property names of `object`.
			*
			* **Note:** Non-object values are coerced to objects. See the
			* [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
			* for more details.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.keys(new Foo);
			* // => ['a', 'b'] (iteration order is not guaranteed)
			*
			* _.keys('hi');
			* // => ['0', '1']
			*/
			function keys(object) {
				return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
			}
			/**
			* Creates an array of the own and inherited enumerable property names of `object`.
			*
			* **Note:** Non-object values are coerced to objects.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property names.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.keysIn(new Foo);
			* // => ['a', 'b', 'c'] (iteration order is not guaranteed)
			*/
			function keysIn(object) {
				return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
			}
			/**
			* The opposite of `_.mapValues`; this method creates an object with the
			* same values as `object` and keys generated by running each own enumerable
			* string keyed property of `object` thru `iteratee`. The iteratee is invoked
			* with three arguments: (value, key, object).
			*
			* @static
			* @memberOf _
			* @since 3.8.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns the new mapped object.
			* @see _.mapValues
			* @example
			*
			* _.mapKeys({ 'a': 1, 'b': 2 }, function(value, key) {
			*   return key + value;
			* });
			* // => { 'a1': 1, 'b2': 2 }
			*/
			function mapKeys(object, iteratee) {
				var result = {};
				iteratee = getIteratee(iteratee, 3);
				baseForOwn(object, function(value, key, object) {
					baseAssignValue(result, iteratee(value, key, object), value);
				});
				return result;
			}
			/**
			* Creates an object with the same keys as `object` and values generated
			* by running each own enumerable string keyed property of `object` thru
			* `iteratee`. The iteratee is invoked with three arguments:
			* (value, key, object).
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Object} Returns the new mapped object.
			* @see _.mapKeys
			* @example
			*
			* var users = {
			*   'fred':    { 'user': 'fred',    'age': 40 },
			*   'pebbles': { 'user': 'pebbles', 'age': 1 }
			* };
			*
			* _.mapValues(users, function(o) { return o.age; });
			* // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
			*
			* // The `_.property` iteratee shorthand.
			* _.mapValues(users, 'age');
			* // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
			*/
			function mapValues(object, iteratee) {
				var result = {};
				iteratee = getIteratee(iteratee, 3);
				baseForOwn(object, function(value, key, object) {
					baseAssignValue(result, key, iteratee(value, key, object));
				});
				return result;
			}
			/**
			* This method is like `_.assign` except that it recursively merges own and
			* inherited enumerable string keyed properties of source objects into the
			* destination object. Source properties that resolve to `undefined` are
			* skipped if a destination value exists. Array and plain object properties
			* are merged recursively. Other objects and value types are overridden by
			* assignment. Source objects are applied from left to right. Subsequent
			* sources overwrite property assignments of previous sources.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 0.5.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} [sources] The source objects.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = {
			*   'a': [{ 'b': 2 }, { 'd': 4 }]
			* };
			*
			* var other = {
			*   'a': [{ 'c': 3 }, { 'e': 5 }]
			* };
			*
			* _.merge(object, other);
			* // => { 'a': [{ 'b': 2, 'c': 3 }, { 'd': 4, 'e': 5 }] }
			*/
			var merge = createAssigner(function(object, source, srcIndex) {
				baseMerge(object, source, srcIndex);
			});
			/**
			* This method is like `_.merge` except that it accepts `customizer` which
			* is invoked to produce the merged values of the destination and source
			* properties. If `customizer` returns `undefined`, merging is handled by the
			* method instead. The `customizer` is invoked with six arguments:
			* (objValue, srcValue, key, object, source, stack).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The destination object.
			* @param {...Object} sources The source objects.
			* @param {Function} customizer The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @example
			*
			* function customizer(objValue, srcValue) {
			*   if (_.isArray(objValue)) {
			*     return objValue.concat(srcValue);
			*   }
			* }
			*
			* var object = { 'a': [1], 'b': [2] };
			* var other = { 'a': [3], 'b': [4] };
			*
			* _.mergeWith(object, other, customizer);
			* // => { 'a': [1, 3], 'b': [2, 4] }
			*/
			var mergeWith = createAssigner(function(object, source, srcIndex, customizer) {
				baseMerge(object, source, srcIndex, customizer);
			});
			/**
			* The opposite of `_.pick`; this method creates an object composed of the
			* own and inherited enumerable property paths of `object` that are not omitted.
			*
			* **Note:** This method is considerably slower than `_.pick`.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The source object.
			* @param {...(string|string[])} [paths] The property paths to omit.
			* @returns {Object} Returns the new object.
			* @example
			*
			* var object = { 'a': 1, 'b': '2', 'c': 3 };
			*
			* _.omit(object, ['a', 'c']);
			* // => { 'b': '2' }
			*/
			var omit = flatRest(function(object, paths) {
				var result = {};
				if (object == null) return result;
				var isDeep = false;
				paths = arrayMap(paths, function(path) {
					path = castPath(path, object);
					isDeep || (isDeep = path.length > 1);
					return path;
				});
				copyObject(object, getAllKeysIn(object), result);
				if (isDeep) result = baseClone(result, 7, customOmitClone);
				var length = paths.length;
				while (length--) baseUnset(result, paths[length]);
				return result;
			});
			/**
			* The opposite of `_.pickBy`; this method creates an object composed of
			* the own and inherited enumerable string keyed properties of `object` that
			* `predicate` doesn't return truthy for. The predicate is invoked with two
			* arguments: (value, key).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The source object.
			* @param {Function} [predicate=_.identity] The function invoked per property.
			* @returns {Object} Returns the new object.
			* @example
			*
			* var object = { 'a': 1, 'b': '2', 'c': 3 };
			*
			* _.omitBy(object, _.isNumber);
			* // => { 'b': '2' }
			*/
			function omitBy(object, predicate) {
				return pickBy(object, negate(getIteratee(predicate)));
			}
			/**
			* Creates an object composed of the picked `object` properties.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The source object.
			* @param {...(string|string[])} [paths] The property paths to pick.
			* @returns {Object} Returns the new object.
			* @example
			*
			* var object = { 'a': 1, 'b': '2', 'c': 3 };
			*
			* _.pick(object, ['a', 'c']);
			* // => { 'a': 1, 'c': 3 }
			*/
			var pick = flatRest(function(object, paths) {
				return object == null ? {} : basePick(object, paths);
			});
			/**
			* Creates an object composed of the `object` properties `predicate` returns
			* truthy for. The predicate is invoked with two arguments: (value, key).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The source object.
			* @param {Function} [predicate=_.identity] The function invoked per property.
			* @returns {Object} Returns the new object.
			* @example
			*
			* var object = { 'a': 1, 'b': '2', 'c': 3 };
			*
			* _.pickBy(object, _.isNumber);
			* // => { 'a': 1, 'c': 3 }
			*/
			function pickBy(object, predicate) {
				if (object == null) return {};
				var props = arrayMap(getAllKeysIn(object), function(prop) {
					return [prop];
				});
				predicate = getIteratee(predicate);
				return basePickBy(object, props, function(value, path) {
					return predicate(value, path[0]);
				});
			}
			/**
			* This method is like `_.get` except that if the resolved value is a
			* function it's invoked with the `this` binding of its parent object and
			* its result is returned.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to query.
			* @param {Array|string} path The path of the property to resolve.
			* @param {*} [defaultValue] The value returned for `undefined` resolved values.
			* @returns {*} Returns the resolved value.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c1': 3, 'c2': _.constant(4) } }] };
			*
			* _.result(object, 'a[0].b.c1');
			* // => 3
			*
			* _.result(object, 'a[0].b.c2');
			* // => 4
			*
			* _.result(object, 'a[0].b.c3', 'default');
			* // => 'default'
			*
			* _.result(object, 'a[0].b.c3', _.constant('default'));
			* // => 'default'
			*/
			function result(object, path, defaultValue) {
				path = castPath(path, object);
				var index = -1, length = path.length;
				if (!length) {
					length = 1;
					object = undefined;
				}
				while (++index < length) {
					var value = object == null ? undefined : object[toKey(path[index])];
					if (value === undefined) {
						index = length;
						value = defaultValue;
					}
					object = isFunction(value) ? value.call(object) : value;
				}
				return object;
			}
			/**
			* Sets the value at `path` of `object`. If a portion of `path` doesn't exist,
			* it's created. Arrays are created for missing index properties while objects
			* are created for all other missing properties. Use `_.setWith` to customize
			* `path` creation.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 3.7.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {*} value The value to set.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }] };
			*
			* _.set(object, 'a[0].b.c', 4);
			* console.log(object.a[0].b.c);
			* // => 4
			*
			* _.set(object, ['x', '0', 'y', 'z'], 5);
			* console.log(object.x[0].y.z);
			* // => 5
			*/
			function set(object, path, value) {
				return object == null ? object : baseSet(object, path, value);
			}
			/**
			* This method is like `_.set` except that it accepts `customizer` which is
			* invoked to produce the objects of `path`.  If `customizer` returns `undefined`
			* path creation is handled by the method instead. The `customizer` is invoked
			* with three arguments: (nsValue, key, nsObject).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {*} value The value to set.
			* @param {Function} [customizer] The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = {};
			*
			* _.setWith(object, '[0][1]', 'a', Object);
			* // => { '0': { '1': 'a' } }
			*/
			function setWith(object, path, value, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return object == null ? object : baseSet(object, path, value, customizer);
			}
			/**
			* Creates an array of own enumerable string keyed-value pairs for `object`
			* which can be consumed by `_.fromPairs`. If `object` is a map or set, its
			* entries are returned.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @alias entries
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the key-value pairs.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.toPairs(new Foo);
			* // => [['a', 1], ['b', 2]] (iteration order is not guaranteed)
			*/
			var toPairs = createToPairs(keys);
			/**
			* Creates an array of own and inherited enumerable string keyed-value pairs
			* for `object` which can be consumed by `_.fromPairs`. If `object` is a map
			* or set, its entries are returned.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @alias entriesIn
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the key-value pairs.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.toPairsIn(new Foo);
			* // => [['a', 1], ['b', 2], ['c', 3]] (iteration order is not guaranteed)
			*/
			var toPairsIn = createToPairs(keysIn);
			/**
			* An alternative to `_.reduce`; this method transforms `object` to a new
			* `accumulator` object which is the result of running each of its own
			* enumerable string keyed properties thru `iteratee`, with each invocation
			* potentially mutating the `accumulator` object. If `accumulator` is not
			* provided, a new object with the same `[[Prototype]]` will be used. The
			* iteratee is invoked with four arguments: (accumulator, value, key, object).
			* Iteratee functions may exit iteration early by explicitly returning `false`.
			*
			* @static
			* @memberOf _
			* @since 1.3.0
			* @category Object
			* @param {Object} object The object to iterate over.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @param {*} [accumulator] The custom accumulator value.
			* @returns {*} Returns the accumulated value.
			* @example
			*
			* _.transform([2, 3, 4], function(result, n) {
			*   result.push(n *= n);
			*   return n % 2 == 0;
			* }, []);
			* // => [4, 9]
			*
			* _.transform({ 'a': 1, 'b': 2, 'c': 1 }, function(result, value, key) {
			*   (result[value] || (result[value] = [])).push(key);
			* }, {});
			* // => { '1': ['a', 'c'], '2': ['b'] }
			*/
			function transform(object, iteratee, accumulator) {
				var isArr = isArray(object), isArrLike = isArr || isBuffer(object) || isTypedArray(object);
				iteratee = getIteratee(iteratee, 4);
				if (accumulator == null) {
					var Ctor = object && object.constructor;
					if (isArrLike) accumulator = isArr ? new Ctor() : [];
					else if (isObject(object)) accumulator = isFunction(Ctor) ? baseCreate(getPrototype(object)) : {};
					else accumulator = {};
				}
				(isArrLike ? arrayEach : baseForOwn)(object, function(value, index, object) {
					return iteratee(accumulator, value, index, object);
				});
				return accumulator;
			}
			/**
			* Removes the property at `path` of `object`.
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to unset.
			* @returns {boolean} Returns `true` if the property is deleted, else `false`.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 7 } }] };
			* _.unset(object, 'a[0].b.c');
			* // => true
			*
			* console.log(object);
			* // => { 'a': [{ 'b': {} }] };
			*
			* _.unset(object, ['a', '0', 'b', 'c']);
			* // => true
			*
			* console.log(object);
			* // => { 'a': [{ 'b': {} }] };
			*/
			function unset(object, path) {
				return object == null ? true : baseUnset(object, path);
			}
			/**
			* This method is like `_.set` except that accepts `updater` to produce the
			* value to set. Use `_.updateWith` to customize `path` creation. The `updater`
			* is invoked with one argument: (value).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.6.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {Function} updater The function to produce the updated value.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = { 'a': [{ 'b': { 'c': 3 } }] };
			*
			* _.update(object, 'a[0].b.c', function(n) { return n * n; });
			* console.log(object.a[0].b.c);
			* // => 9
			*
			* _.update(object, 'x[0].y.z', function(n) { return n ? n + 1 : 0; });
			* console.log(object.x[0].y.z);
			* // => 0
			*/
			function update(object, path, updater) {
				return object == null ? object : baseUpdate(object, path, castFunction(updater));
			}
			/**
			* This method is like `_.update` except that it accepts `customizer` which is
			* invoked to produce the objects of `path`.  If `customizer` returns `undefined`
			* path creation is handled by the method instead. The `customizer` is invoked
			* with three arguments: (nsValue, key, nsObject).
			*
			* **Note:** This method mutates `object`.
			*
			* @static
			* @memberOf _
			* @since 4.6.0
			* @category Object
			* @param {Object} object The object to modify.
			* @param {Array|string} path The path of the property to set.
			* @param {Function} updater The function to produce the updated value.
			* @param {Function} [customizer] The function to customize assigned values.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var object = {};
			*
			* _.updateWith(object, '[0][1]', _.constant('a'), Object);
			* // => { '0': { '1': 'a' } }
			*/
			function updateWith(object, path, updater, customizer) {
				customizer = typeof customizer == "function" ? customizer : undefined;
				return object == null ? object : baseUpdate(object, path, castFunction(updater), customizer);
			}
			/**
			* Creates an array of the own enumerable string keyed property values of `object`.
			*
			* **Note:** Non-object values are coerced to objects.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property values.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.values(new Foo);
			* // => [1, 2] (iteration order is not guaranteed)
			*
			* _.values('hi');
			* // => ['h', 'i']
			*/
			function values(object) {
				return object == null ? [] : baseValues(object, keys(object));
			}
			/**
			* Creates an array of the own and inherited enumerable string keyed property
			* values of `object`.
			*
			* **Note:** Non-object values are coerced to objects.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Object
			* @param {Object} object The object to query.
			* @returns {Array} Returns the array of property values.
			* @example
			*
			* function Foo() {
			*   this.a = 1;
			*   this.b = 2;
			* }
			*
			* Foo.prototype.c = 3;
			*
			* _.valuesIn(new Foo);
			* // => [1, 2, 3] (iteration order is not guaranteed)
			*/
			function valuesIn(object) {
				return object == null ? [] : baseValues(object, keysIn(object));
			}
			/**
			* Clamps `number` within the inclusive `lower` and `upper` bounds.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Number
			* @param {number} number The number to clamp.
			* @param {number} [lower] The lower bound.
			* @param {number} upper The upper bound.
			* @returns {number} Returns the clamped number.
			* @example
			*
			* _.clamp(-10, -5, 5);
			* // => -5
			*
			* _.clamp(10, -5, 5);
			* // => 5
			*/
			function clamp(number, lower, upper) {
				if (upper === undefined) {
					upper = lower;
					lower = undefined;
				}
				if (upper !== undefined) {
					upper = toNumber(upper);
					upper = upper === upper ? upper : 0;
				}
				if (lower !== undefined) {
					lower = toNumber(lower);
					lower = lower === lower ? lower : 0;
				}
				return baseClamp(toNumber(number), lower, upper);
			}
			/**
			* Checks if `n` is between `start` and up to, but not including, `end`. If
			* `end` is not specified, it's set to `start` with `start` then set to `0`.
			* If `start` is greater than `end` the params are swapped to support
			* negative ranges.
			*
			* @static
			* @memberOf _
			* @since 3.3.0
			* @category Number
			* @param {number} number The number to check.
			* @param {number} [start=0] The start of the range.
			* @param {number} end The end of the range.
			* @returns {boolean} Returns `true` if `number` is in the range, else `false`.
			* @see _.range, _.rangeRight
			* @example
			*
			* _.inRange(3, 2, 4);
			* // => true
			*
			* _.inRange(4, 8);
			* // => true
			*
			* _.inRange(4, 2);
			* // => false
			*
			* _.inRange(2, 2);
			* // => false
			*
			* _.inRange(1.2, 2);
			* // => true
			*
			* _.inRange(5.2, 4);
			* // => false
			*
			* _.inRange(-3, -2, -6);
			* // => true
			*/
			function inRange(number, start, end) {
				start = toFinite(start);
				if (end === undefined) {
					end = start;
					start = 0;
				} else end = toFinite(end);
				number = toNumber(number);
				return baseInRange(number, start, end);
			}
			/**
			* Produces a random number between the inclusive `lower` and `upper` bounds.
			* If only one argument is provided a number between `0` and the given number
			* is returned. If `floating` is `true`, or either `lower` or `upper` are
			* floats, a floating-point number is returned instead of an integer.
			*
			* **Note:** JavaScript follows the IEEE-754 standard for resolving
			* floating-point values which can produce unexpected results.
			*
			* @static
			* @memberOf _
			* @since 0.7.0
			* @category Number
			* @param {number} [lower=0] The lower bound.
			* @param {number} [upper=1] The upper bound.
			* @param {boolean} [floating] Specify returning a floating-point number.
			* @returns {number} Returns the random number.
			* @example
			*
			* _.random(0, 5);
			* // => an integer between 0 and 5
			*
			* _.random(5);
			* // => also an integer between 0 and 5
			*
			* _.random(5, true);
			* // => a floating-point number between 0 and 5
			*
			* _.random(1.2, 5.2);
			* // => a floating-point number between 1.2 and 5.2
			*/
			function random(lower, upper, floating) {
				if (floating && typeof floating != "boolean" && isIterateeCall(lower, upper, floating)) upper = floating = undefined;
				if (floating === undefined) {
					if (typeof upper == "boolean") {
						floating = upper;
						upper = undefined;
					} else if (typeof lower == "boolean") {
						floating = lower;
						lower = undefined;
					}
				}
				if (lower === undefined && upper === undefined) {
					lower = 0;
					upper = 1;
				} else {
					lower = toFinite(lower);
					if (upper === undefined) {
						upper = lower;
						lower = 0;
					} else upper = toFinite(upper);
				}
				if (lower > upper) {
					var temp = lower;
					lower = upper;
					upper = temp;
				}
				if (floating || lower % 1 || upper % 1) {
					var rand = nativeRandom();
					return nativeMin(lower + rand * (upper - lower + freeParseFloat("1e-" + ((rand + "").length - 1))), upper);
				}
				return baseRandom(lower, upper);
			}
			/**
			* Converts `string` to [camel case](https://en.wikipedia.org/wiki/CamelCase).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the camel cased string.
			* @example
			*
			* _.camelCase('Foo Bar');
			* // => 'fooBar'
			*
			* _.camelCase('--foo-bar--');
			* // => 'fooBar'
			*
			* _.camelCase('__FOO_BAR__');
			* // => 'fooBar'
			*/
			var camelCase = createCompounder(function(result, word, index) {
				word = word.toLowerCase();
				return result + (index ? capitalize(word) : word);
			});
			/**
			* Converts the first character of `string` to upper case and the remaining
			* to lower case.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to capitalize.
			* @returns {string} Returns the capitalized string.
			* @example
			*
			* _.capitalize('FRED');
			* // => 'Fred'
			*/
			function capitalize(string) {
				return upperFirst(toString(string).toLowerCase());
			}
			/**
			* Deburrs `string` by converting
			* [Latin-1 Supplement](https://en.wikipedia.org/wiki/Latin-1_Supplement_(Unicode_block)#Character_table)
			* and [Latin Extended-A](https://en.wikipedia.org/wiki/Latin_Extended-A)
			* letters to basic Latin letters and removing
			* [combining diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to deburr.
			* @returns {string} Returns the deburred string.
			* @example
			*
			* _.deburr('déjà vu');
			* // => 'deja vu'
			*/
			function deburr(string) {
				string = toString(string);
				return string && string.replace(reLatin, deburrLetter).replace(reComboMark, "");
			}
			/**
			* Checks if `string` ends with the given target string.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to inspect.
			* @param {string} [target] The string to search for.
			* @param {number} [position=string.length] The position to search up to.
			* @returns {boolean} Returns `true` if `string` ends with `target`,
			*  else `false`.
			* @example
			*
			* _.endsWith('abc', 'c');
			* // => true
			*
			* _.endsWith('abc', 'b');
			* // => false
			*
			* _.endsWith('abc', 'b', 2);
			* // => true
			*/
			function endsWith(string, target, position) {
				string = toString(string);
				target = baseToString(target);
				var length = string.length;
				position = position === undefined ? length : baseClamp(toInteger(position), 0, length);
				var end = position;
				position -= target.length;
				return position >= 0 && string.slice(position, end) == target;
			}
			/**
			* Converts the characters "&", "<", ">", '"', and "'" in `string` to their
			* corresponding HTML entities.
			*
			* **Note:** No other characters are escaped. To escape additional
			* characters use a third-party library like [_he_](https://mths.be/he).
			*
			* Though the ">" character is escaped for symmetry, characters like
			* ">" and "/" don't need escaping in HTML and have no special meaning
			* unless they're part of a tag or unquoted attribute value. See
			* [Mathias Bynens's article](https://mathiasbynens.be/notes/ambiguous-ampersands)
			* (under "semi-related fun fact") for more details.
			*
			* When working with HTML you should always
			* [quote attribute values](http://wonko.com/post/html-escaping) to reduce
			* XSS vectors.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category String
			* @param {string} [string=''] The string to escape.
			* @returns {string} Returns the escaped string.
			* @example
			*
			* _.escape('fred, barney, & pebbles');
			* // => 'fred, barney, &amp; pebbles'
			*/
			function escape(string) {
				string = toString(string);
				return string && reHasUnescapedHtml.test(string) ? string.replace(reUnescapedHtml, escapeHtmlChar) : string;
			}
			/**
			* Escapes the `RegExp` special characters "^", "$", "\", ".", "*", "+",
			* "?", "(", ")", "[", "]", "{", "}", and "|" in `string`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to escape.
			* @returns {string} Returns the escaped string.
			* @example
			*
			* _.escapeRegExp('[lodash](https://lodash.com/)');
			* // => '\[lodash\]\(https://lodash\.com/\)'
			*/
			function escapeRegExp(string) {
				string = toString(string);
				return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, "\\$&") : string;
			}
			/**
			* Converts `string` to
			* [kebab case](https://en.wikipedia.org/wiki/Letter_case#Special_case_styles).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the kebab cased string.
			* @example
			*
			* _.kebabCase('Foo Bar');
			* // => 'foo-bar'
			*
			* _.kebabCase('fooBar');
			* // => 'foo-bar'
			*
			* _.kebabCase('__FOO_BAR__');
			* // => 'foo-bar'
			*/
			var kebabCase = createCompounder(function(result, word, index) {
				return result + (index ? "-" : "") + word.toLowerCase();
			});
			/**
			* Converts `string`, as space separated words, to lower case.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the lower cased string.
			* @example
			*
			* _.lowerCase('--Foo-Bar--');
			* // => 'foo bar'
			*
			* _.lowerCase('fooBar');
			* // => 'foo bar'
			*
			* _.lowerCase('__FOO_BAR__');
			* // => 'foo bar'
			*/
			var lowerCase = createCompounder(function(result, word, index) {
				return result + (index ? " " : "") + word.toLowerCase();
			});
			/**
			* Converts the first character of `string` to lower case.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the converted string.
			* @example
			*
			* _.lowerFirst('Fred');
			* // => 'fred'
			*
			* _.lowerFirst('FRED');
			* // => 'fRED'
			*/
			var lowerFirst = createCaseFirst("toLowerCase");
			/**
			* Pads `string` on the left and right sides if it's shorter than `length`.
			* Padding characters are truncated if they can't be evenly divided by `length`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to pad.
			* @param {number} [length=0] The padding length.
			* @param {string} [chars=' '] The string used as padding.
			* @returns {string} Returns the padded string.
			* @example
			*
			* _.pad('abc', 8);
			* // => '  abc   '
			*
			* _.pad('abc', 8, '_-');
			* // => '_-abc_-_'
			*
			* _.pad('abc', 3);
			* // => 'abc'
			*/
			function pad(string, length, chars) {
				string = toString(string);
				length = toInteger(length);
				var strLength = length ? stringSize(string) : 0;
				if (!length || strLength >= length) return string;
				var mid = (length - strLength) / 2;
				return createPadding(nativeFloor(mid), chars) + string + createPadding(nativeCeil(mid), chars);
			}
			/**
			* Pads `string` on the right side if it's shorter than `length`. Padding
			* characters are truncated if they exceed `length`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to pad.
			* @param {number} [length=0] The padding length.
			* @param {string} [chars=' '] The string used as padding.
			* @returns {string} Returns the padded string.
			* @example
			*
			* _.padEnd('abc', 6);
			* // => 'abc   '
			*
			* _.padEnd('abc', 6, '_-');
			* // => 'abc_-_'
			*
			* _.padEnd('abc', 3);
			* // => 'abc'
			*/
			function padEnd(string, length, chars) {
				string = toString(string);
				length = toInteger(length);
				var strLength = length ? stringSize(string) : 0;
				return length && strLength < length ? string + createPadding(length - strLength, chars) : string;
			}
			/**
			* Pads `string` on the left side if it's shorter than `length`. Padding
			* characters are truncated if they exceed `length`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to pad.
			* @param {number} [length=0] The padding length.
			* @param {string} [chars=' '] The string used as padding.
			* @returns {string} Returns the padded string.
			* @example
			*
			* _.padStart('abc', 6);
			* // => '   abc'
			*
			* _.padStart('abc', 6, '_-');
			* // => '_-_abc'
			*
			* _.padStart('abc', 3);
			* // => 'abc'
			*/
			function padStart(string, length, chars) {
				string = toString(string);
				length = toInteger(length);
				var strLength = length ? stringSize(string) : 0;
				return length && strLength < length ? createPadding(length - strLength, chars) + string : string;
			}
			/**
			* Converts `string` to an integer of the specified radix. If `radix` is
			* `undefined` or `0`, a `radix` of `10` is used unless `value` is a
			* hexadecimal, in which case a `radix` of `16` is used.
			*
			* **Note:** This method aligns with the
			* [ES5 implementation](https://es5.github.io/#x15.1.2.2) of `parseInt`.
			*
			* @static
			* @memberOf _
			* @since 1.1.0
			* @category String
			* @param {string} string The string to convert.
			* @param {number} [radix=10] The radix to interpret `value` by.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {number} Returns the converted integer.
			* @example
			*
			* _.parseInt('08');
			* // => 8
			*
			* _.map(['6', '08', '10'], _.parseInt);
			* // => [6, 8, 10]
			*/
			function parseInt(string, radix, guard) {
				if (guard || radix == null) radix = 0;
				else if (radix) radix = +radix;
				return nativeParseInt(toString(string).replace(reTrimStart, ""), radix || 0);
			}
			/**
			* Repeats the given string `n` times.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to repeat.
			* @param {number} [n=1] The number of times to repeat the string.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {string} Returns the repeated string.
			* @example
			*
			* _.repeat('*', 3);
			* // => '***'
			*
			* _.repeat('abc', 2);
			* // => 'abcabc'
			*
			* _.repeat('abc', 0);
			* // => ''
			*/
			function repeat(string, n, guard) {
				if (guard ? isIterateeCall(string, n, guard) : n === undefined) n = 1;
				else n = toInteger(n);
				return baseRepeat(toString(string), n);
			}
			/**
			* Replaces matches for `pattern` in `string` with `replacement`.
			*
			* **Note:** This method is based on
			* [`String#replace`](https://mdn.io/String/replace).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to modify.
			* @param {RegExp|string} pattern The pattern to replace.
			* @param {Function|string} replacement The match replacement.
			* @returns {string} Returns the modified string.
			* @example
			*
			* _.replace('Hi Fred', 'Fred', 'Barney');
			* // => 'Hi Barney'
			*/
			function replace() {
				var args = arguments, string = toString(args[0]);
				return args.length < 3 ? string : string.replace(args[1], args[2]);
			}
			/**
			* Converts `string` to
			* [snake case](https://en.wikipedia.org/wiki/Snake_case).
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the snake cased string.
			* @example
			*
			* _.snakeCase('Foo Bar');
			* // => 'foo_bar'
			*
			* _.snakeCase('fooBar');
			* // => 'foo_bar'
			*
			* _.snakeCase('--FOO-BAR--');
			* // => 'foo_bar'
			*/
			var snakeCase = createCompounder(function(result, word, index) {
				return result + (index ? "_" : "") + word.toLowerCase();
			});
			/**
			* Splits `string` by `separator`.
			*
			* **Note:** This method is based on
			* [`String#split`](https://mdn.io/String/split).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to split.
			* @param {RegExp|string} separator The separator pattern to split by.
			* @param {number} [limit] The length to truncate results to.
			* @returns {Array} Returns the string segments.
			* @example
			*
			* _.split('a-b-c', '-', 2);
			* // => ['a', 'b']
			*/
			function split(string, separator, limit) {
				if (limit && typeof limit != "number" && isIterateeCall(string, separator, limit)) separator = limit = undefined;
				limit = limit === undefined ? MAX_ARRAY_LENGTH : limit >>> 0;
				if (!limit) return [];
				string = toString(string);
				if (string && (typeof separator == "string" || separator != null && !isRegExp(separator))) {
					separator = baseToString(separator);
					if (!separator && hasUnicode(string)) return castSlice(stringToArray(string), 0, limit);
				}
				return string.split(separator, limit);
			}
			/**
			* Converts `string` to
			* [start case](https://en.wikipedia.org/wiki/Letter_case#Stylistic_or_specialised_usage).
			*
			* @static
			* @memberOf _
			* @since 3.1.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the start cased string.
			* @example
			*
			* _.startCase('--foo-bar--');
			* // => 'Foo Bar'
			*
			* _.startCase('fooBar');
			* // => 'Foo Bar'
			*
			* _.startCase('__FOO_BAR__');
			* // => 'FOO BAR'
			*/
			var startCase = createCompounder(function(result, word, index) {
				return result + (index ? " " : "") + upperFirst(word);
			});
			/**
			* Checks if `string` starts with the given target string.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to inspect.
			* @param {string} [target] The string to search for.
			* @param {number} [position=0] The position to search from.
			* @returns {boolean} Returns `true` if `string` starts with `target`,
			*  else `false`.
			* @example
			*
			* _.startsWith('abc', 'a');
			* // => true
			*
			* _.startsWith('abc', 'b');
			* // => false
			*
			* _.startsWith('abc', 'b', 1);
			* // => true
			*/
			function startsWith(string, target, position) {
				string = toString(string);
				position = position == null ? 0 : baseClamp(toInteger(position), 0, string.length);
				target = baseToString(target);
				return string.slice(position, position + target.length) == target;
			}
			/**
			* Creates a compiled template function that can interpolate data properties
			* in "interpolate" delimiters, HTML-escape interpolated data properties in
			* "escape" delimiters, and execute JavaScript in "evaluate" delimiters. Data
			* properties may be accessed as free variables in the template. If a setting
			* object is given, it takes precedence over `_.templateSettings` values.
			*
			* **Note:** In the development build `_.template` utilizes
			* [sourceURLs](http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl)
			* for easier debugging.
			*
			* For more information on precompiling templates see
			* [lodash's custom builds documentation](https://lodash.com/custom-builds).
			*
			* For more information on Chrome extension sandboxes see
			* [Chrome's extensions documentation](https://developer.chrome.com/extensions/sandboxingEval).
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category String
			* @param {string} [string=''] The template string.
			* @param {Object} [options={}] The options object.
			* @param {RegExp} [options.escape=_.templateSettings.escape]
			*  The HTML "escape" delimiter.
			* @param {RegExp} [options.evaluate=_.templateSettings.evaluate]
			*  The "evaluate" delimiter.
			* @param {Object} [options.imports=_.templateSettings.imports]
			*  An object to import into the template as free variables.
			* @param {RegExp} [options.interpolate=_.templateSettings.interpolate]
			*  The "interpolate" delimiter.
			* @param {string} [options.sourceURL='lodash.templateSources[n]']
			*  The sourceURL of the compiled template.
			* @param {string} [options.variable='obj']
			*  The data object variable name.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Function} Returns the compiled template function.
			* @example
			*
			* // Use the "interpolate" delimiter to create a compiled template.
			* var compiled = _.template('hello <%= user %>!');
			* compiled({ 'user': 'fred' });
			* // => 'hello fred!'
			*
			* // Use the HTML "escape" delimiter to escape data property values.
			* var compiled = _.template('<b><%- value %></b>');
			* compiled({ 'value': '<script>' });
			* // => '<b>&lt;script&gt;</b>'
			*
			* // Use the "evaluate" delimiter to execute JavaScript and generate HTML.
			* var compiled = _.template('<% _.forEach(users, function(user) { %><li><%- user %></li><% }); %>');
			* compiled({ 'users': ['fred', 'barney'] });
			* // => '<li>fred</li><li>barney</li>'
			*
			* // Use the internal `print` function in "evaluate" delimiters.
			* var compiled = _.template('<% print("hello " + user); %>!');
			* compiled({ 'user': 'barney' });
			* // => 'hello barney!'
			*
			* // Use the ES template literal delimiter as an "interpolate" delimiter.
			* // Disable support by replacing the "interpolate" delimiter.
			* var compiled = _.template('hello ${ user }!');
			* compiled({ 'user': 'pebbles' });
			* // => 'hello pebbles!'
			*
			* // Use backslashes to treat delimiters as plain text.
			* var compiled = _.template('<%= "\\<%- value %\\>" %>');
			* compiled({ 'value': 'ignored' });
			* // => '<%- value %>'
			*
			* // Use the `imports` option to import `jQuery` as `jq`.
			* var text = '<% jq.each(users, function(user) { %><li><%- user %></li><% }); %>';
			* var compiled = _.template(text, { 'imports': { 'jq': jQuery } });
			* compiled({ 'users': ['fred', 'barney'] });
			* // => '<li>fred</li><li>barney</li>'
			*
			* // Use the `sourceURL` option to specify a custom sourceURL for the template.
			* var compiled = _.template('hello <%= user %>!', { 'sourceURL': '/basic/greeting.jst' });
			* compiled(data);
			* // => Find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector.
			*
			* // Use the `variable` option to ensure a with-statement isn't used in the compiled template.
			* var compiled = _.template('hi <%= data.user %>!', { 'variable': 'data' });
			* compiled.source;
			* // => function(data) {
			* //   var __t, __p = '';
			* //   __p += 'hi ' + ((__t = ( data.user )) == null ? '' : __t) + '!';
			* //   return __p;
			* // }
			*
			* // Use custom template delimiters.
			* _.templateSettings.interpolate = /{{([\s\S]+?)}}/g;
			* var compiled = _.template('hello {{ user }}!');
			* compiled({ 'user': 'mustache' });
			* // => 'hello mustache!'
			*
			* // Use the `source` property to inline compiled templates for meaningful
			* // line numbers in error messages and stack traces.
			* fs.writeFileSync(path.join(process.cwd(), 'jst.js'), '\
			*   var JST = {\
			*     "main": ' + _.template(mainText).source + '\
			*   };\
			* ');
			*/
			function template(string, options, guard) {
				var settings = lodash.templateSettings;
				if (guard && isIterateeCall(string, options, guard)) options = undefined;
				string = toString(string);
				options = assignInWith({}, options, settings, customDefaultsAssignIn);
				var imports = assignInWith({}, options.imports, settings.imports, customDefaultsAssignIn), importsKeys = keys(imports), importsValues = baseValues(imports, importsKeys);
				var isEscaping, isEvaluating, index = 0, interpolate = options.interpolate || reNoMatch, source = "__p += '";
				var reDelimiters = RegExp((options.escape || reNoMatch).source + "|" + interpolate.source + "|" + (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + "|" + (options.evaluate || reNoMatch).source + "|$", "g");
				var sourceURL = "//# sourceURL=" + (hasOwnProperty.call(options, "sourceURL") ? (options.sourceURL + "").replace(/\s/g, " ") : "lodash.templateSources[" + ++templateCounter + "]") + "\n";
				string.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
					interpolateValue || (interpolateValue = esTemplateValue);
					source += string.slice(index, offset).replace(reUnescapedString, escapeStringChar);
					if (escapeValue) {
						isEscaping = true;
						source += "' +\n__e(" + escapeValue + ") +\n'";
					}
					if (evaluateValue) {
						isEvaluating = true;
						source += "';\n" + evaluateValue + ";\n__p += '";
					}
					if (interpolateValue) source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
					index = offset + match.length;
					return match;
				});
				source += "';\n";
				var variable = hasOwnProperty.call(options, "variable") && options.variable;
				if (!variable) source = "with (obj) {\n" + source + "\n}\n";
				else if (reForbiddenIdentifierChars.test(variable)) throw new Error(INVALID_TEMPL_VAR_ERROR_TEXT);
				source = (isEvaluating ? source.replace(reEmptyStringLeading, "") : source).replace(reEmptyStringMiddle, "$1").replace(reEmptyStringTrailing, "$1;");
				source = "function(" + (variable || "obj") + ") {\n" + (variable ? "" : "obj || (obj = {});\n") + "var __t, __p = ''" + (isEscaping ? ", __e = _.escape" : "") + (isEvaluating ? ", __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, '') }\n" : ";\n") + source + "return __p\n}";
				var result = attempt(function() {
					return Function(importsKeys, sourceURL + "return " + source).apply(undefined, importsValues);
				});
				result.source = source;
				if (isError(result)) throw result;
				return result;
			}
			/**
			* Converts `string`, as a whole, to lower case just like
			* [String#toLowerCase](https://mdn.io/toLowerCase).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the lower cased string.
			* @example
			*
			* _.toLower('--Foo-Bar--');
			* // => '--foo-bar--'
			*
			* _.toLower('fooBar');
			* // => 'foobar'
			*
			* _.toLower('__FOO_BAR__');
			* // => '__foo_bar__'
			*/
			function toLower(value) {
				return toString(value).toLowerCase();
			}
			/**
			* Converts `string`, as a whole, to upper case just like
			* [String#toUpperCase](https://mdn.io/toUpperCase).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the upper cased string.
			* @example
			*
			* _.toUpper('--foo-bar--');
			* // => '--FOO-BAR--'
			*
			* _.toUpper('fooBar');
			* // => 'FOOBAR'
			*
			* _.toUpper('__foo_bar__');
			* // => '__FOO_BAR__'
			*/
			function toUpper(value) {
				return toString(value).toUpperCase();
			}
			/**
			* Removes leading and trailing whitespace or specified characters from `string`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to trim.
			* @param {string} [chars=whitespace] The characters to trim.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {string} Returns the trimmed string.
			* @example
			*
			* _.trim('  abc  ');
			* // => 'abc'
			*
			* _.trim('-_-abc-_-', '_-');
			* // => 'abc'
			*
			* _.map(['  foo  ', '  bar  '], _.trim);
			* // => ['foo', 'bar']
			*/
			function trim(string, chars, guard) {
				string = toString(string);
				if (string && (guard || chars === undefined)) return baseTrim(string);
				if (!string || !(chars = baseToString(chars))) return string;
				var strSymbols = stringToArray(string), chrSymbols = stringToArray(chars);
				return castSlice(strSymbols, charsStartIndex(strSymbols, chrSymbols), charsEndIndex(strSymbols, chrSymbols) + 1).join("");
			}
			/**
			* Removes trailing whitespace or specified characters from `string`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to trim.
			* @param {string} [chars=whitespace] The characters to trim.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {string} Returns the trimmed string.
			* @example
			*
			* _.trimEnd('  abc  ');
			* // => '  abc'
			*
			* _.trimEnd('-_-abc-_-', '_-');
			* // => '-_-abc'
			*/
			function trimEnd(string, chars, guard) {
				string = toString(string);
				if (string && (guard || chars === undefined)) return string.slice(0, trimmedEndIndex(string) + 1);
				if (!string || !(chars = baseToString(chars))) return string;
				var strSymbols = stringToArray(string);
				return castSlice(strSymbols, 0, charsEndIndex(strSymbols, stringToArray(chars)) + 1).join("");
			}
			/**
			* Removes leading whitespace or specified characters from `string`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to trim.
			* @param {string} [chars=whitespace] The characters to trim.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {string} Returns the trimmed string.
			* @example
			*
			* _.trimStart('  abc  ');
			* // => 'abc  '
			*
			* _.trimStart('-_-abc-_-', '_-');
			* // => 'abc-_-'
			*/
			function trimStart(string, chars, guard) {
				string = toString(string);
				if (string && (guard || chars === undefined)) return string.replace(reTrimStart, "");
				if (!string || !(chars = baseToString(chars))) return string;
				var strSymbols = stringToArray(string);
				return castSlice(strSymbols, charsStartIndex(strSymbols, stringToArray(chars))).join("");
			}
			/**
			* Truncates `string` if it's longer than the given maximum string length.
			* The last characters of the truncated string are replaced with the omission
			* string which defaults to "...".
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to truncate.
			* @param {Object} [options={}] The options object.
			* @param {number} [options.length=30] The maximum string length.
			* @param {string} [options.omission='...'] The string to indicate text is omitted.
			* @param {RegExp|string} [options.separator] The separator pattern to truncate to.
			* @returns {string} Returns the truncated string.
			* @example
			*
			* _.truncate('hi-diddly-ho there, neighborino');
			* // => 'hi-diddly-ho there, neighbo...'
			*
			* _.truncate('hi-diddly-ho there, neighborino', {
			*   'length': 24,
			*   'separator': ' '
			* });
			* // => 'hi-diddly-ho there,...'
			*
			* _.truncate('hi-diddly-ho there, neighborino', {
			*   'length': 24,
			*   'separator': /,? +/
			* });
			* // => 'hi-diddly-ho there...'
			*
			* _.truncate('hi-diddly-ho there, neighborino', {
			*   'omission': ' [...]'
			* });
			* // => 'hi-diddly-ho there, neig [...]'
			*/
			function truncate(string, options) {
				var length = DEFAULT_TRUNC_LENGTH, omission = DEFAULT_TRUNC_OMISSION;
				if (isObject(options)) {
					var separator = "separator" in options ? options.separator : separator;
					length = "length" in options ? toInteger(options.length) : length;
					omission = "omission" in options ? baseToString(options.omission) : omission;
				}
				string = toString(string);
				var strLength = string.length;
				if (hasUnicode(string)) {
					var strSymbols = stringToArray(string);
					strLength = strSymbols.length;
				}
				if (length >= strLength) return string;
				var end = length - stringSize(omission);
				if (end < 1) return omission;
				var result = strSymbols ? castSlice(strSymbols, 0, end).join("") : string.slice(0, end);
				if (separator === undefined) return result + omission;
				if (strSymbols) end += result.length - end;
				if (isRegExp(separator)) {
					if (string.slice(end).search(separator)) {
						var match, substring = result;
						if (!separator.global) separator = RegExp(separator.source, toString(reFlags.exec(separator)) + "g");
						separator.lastIndex = 0;
						while (match = separator.exec(substring)) var newEnd = match.index;
						result = result.slice(0, newEnd === undefined ? end : newEnd);
					}
				} else if (string.indexOf(baseToString(separator), end) != end) {
					var index = result.lastIndexOf(separator);
					if (index > -1) result = result.slice(0, index);
				}
				return result + omission;
			}
			/**
			* The inverse of `_.escape`; this method converts the HTML entities
			* `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to
			* their corresponding characters.
			*
			* **Note:** No other HTML entities are unescaped. To unescape additional
			* HTML entities use a third-party library like [_he_](https://mths.be/he).
			*
			* @static
			* @memberOf _
			* @since 0.6.0
			* @category String
			* @param {string} [string=''] The string to unescape.
			* @returns {string} Returns the unescaped string.
			* @example
			*
			* _.unescape('fred, barney, &amp; pebbles');
			* // => 'fred, barney, & pebbles'
			*/
			function unescape(string) {
				string = toString(string);
				return string && reHasEscapedHtml.test(string) ? string.replace(reEscapedHtml, unescapeHtmlChar) : string;
			}
			/**
			* Converts `string`, as space separated words, to upper case.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the upper cased string.
			* @example
			*
			* _.upperCase('--foo-bar');
			* // => 'FOO BAR'
			*
			* _.upperCase('fooBar');
			* // => 'FOO BAR'
			*
			* _.upperCase('__foo_bar__');
			* // => 'FOO BAR'
			*/
			var upperCase = createCompounder(function(result, word, index) {
				return result + (index ? " " : "") + word.toUpperCase();
			});
			/**
			* Converts the first character of `string` to upper case.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category String
			* @param {string} [string=''] The string to convert.
			* @returns {string} Returns the converted string.
			* @example
			*
			* _.upperFirst('fred');
			* // => 'Fred'
			*
			* _.upperFirst('FRED');
			* // => 'FRED'
			*/
			var upperFirst = createCaseFirst("toUpperCase");
			/**
			* Splits `string` into an array of its words.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category String
			* @param {string} [string=''] The string to inspect.
			* @param {RegExp|string} [pattern] The pattern to match words.
			* @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
			* @returns {Array} Returns the words of `string`.
			* @example
			*
			* _.words('fred, barney, & pebbles');
			* // => ['fred', 'barney', 'pebbles']
			*
			* _.words('fred, barney, & pebbles', /[^, ]+/g);
			* // => ['fred', 'barney', '&', 'pebbles']
			*/
			function words(string, pattern, guard) {
				string = toString(string);
				pattern = guard ? undefined : pattern;
				if (pattern === undefined) return hasUnicodeWord(string) ? unicodeWords(string) : asciiWords(string);
				return string.match(pattern) || [];
			}
			/**
			* Attempts to invoke `func`, returning either the result or the caught error
			* object. Any additional arguments are provided to `func` when it's invoked.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Util
			* @param {Function} func The function to attempt.
			* @param {...*} [args] The arguments to invoke `func` with.
			* @returns {*} Returns the `func` result or error object.
			* @example
			*
			* // Avoid throwing errors for invalid selectors.
			* var elements = _.attempt(function(selector) {
			*   return document.querySelectorAll(selector);
			* }, '>_>');
			*
			* if (_.isError(elements)) {
			*   elements = [];
			* }
			*/
			var attempt = baseRest(function(func, args) {
				try {
					return apply(func, undefined, args);
				} catch (e) {
					return isError(e) ? e : new Error(e);
				}
			});
			/**
			* Binds methods of an object to the object itself, overwriting the existing
			* method.
			*
			* **Note:** This method doesn't set the "length" property of bound functions.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {Object} object The object to bind and assign the bound methods to.
			* @param {...(string|string[])} methodNames The object method names to bind.
			* @returns {Object} Returns `object`.
			* @example
			*
			* var view = {
			*   'label': 'docs',
			*   'click': function() {
			*     console.log('clicked ' + this.label);
			*   }
			* };
			*
			* _.bindAll(view, ['click']);
			* jQuery(element).on('click', view.click);
			* // => Logs 'clicked docs' when clicked.
			*/
			var bindAll = flatRest(function(object, methodNames) {
				arrayEach(methodNames, function(key) {
					key = toKey(key);
					baseAssignValue(object, key, bind(object[key], object));
				});
				return object;
			});
			/**
			* Creates a function that iterates over `pairs` and invokes the corresponding
			* function of the first predicate to return truthy. The predicate-function
			* pairs are invoked with the `this` binding and arguments of the created
			* function.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {Array} pairs The predicate-function pairs.
			* @returns {Function} Returns the new composite function.
			* @example
			*
			* var func = _.cond([
			*   [_.matches({ 'a': 1 }),           _.constant('matches A')],
			*   [_.conforms({ 'b': _.isNumber }), _.constant('matches B')],
			*   [_.stubTrue,                      _.constant('no match')]
			* ]);
			*
			* func({ 'a': 1, 'b': 2 });
			* // => 'matches A'
			*
			* func({ 'a': 0, 'b': 1 });
			* // => 'matches B'
			*
			* func({ 'a': '1', 'b': '2' });
			* // => 'no match'
			*/
			function cond(pairs) {
				var length = pairs == null ? 0 : pairs.length, toIteratee = getIteratee();
				pairs = !length ? [] : arrayMap(pairs, function(pair) {
					if (typeof pair[1] != "function") throw new TypeError(FUNC_ERROR_TEXT);
					return [toIteratee(pair[0]), pair[1]];
				});
				return baseRest(function(args) {
					var index = -1;
					while (++index < length) {
						var pair = pairs[index];
						if (apply(pair[0], this, args)) return apply(pair[1], this, args);
					}
				});
			}
			/**
			* Creates a function that invokes the predicate properties of `source` with
			* the corresponding property values of a given object, returning `true` if
			* all predicates return truthy, else `false`.
			*
			* **Note:** The created function is equivalent to `_.conformsTo` with
			* `source` partially applied.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {Object} source The object of property predicates to conform to.
			* @returns {Function} Returns the new spec function.
			* @example
			*
			* var objects = [
			*   { 'a': 2, 'b': 1 },
			*   { 'a': 1, 'b': 2 }
			* ];
			*
			* _.filter(objects, _.conforms({ 'b': function(n) { return n > 1; } }));
			* // => [{ 'a': 1, 'b': 2 }]
			*/
			function conforms(source) {
				return baseConforms(baseClone(source, CLONE_DEEP_FLAG));
			}
			/**
			* Creates a function that returns `value`.
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Util
			* @param {*} value The value to return from the new function.
			* @returns {Function} Returns the new constant function.
			* @example
			*
			* var objects = _.times(2, _.constant({ 'a': 1 }));
			*
			* console.log(objects);
			* // => [{ 'a': 1 }, { 'a': 1 }]
			*
			* console.log(objects[0] === objects[1]);
			* // => true
			*/
			function constant(value) {
				return function() {
					return value;
				};
			}
			/**
			* Checks `value` to determine whether a default value should be returned in
			* its place. The `defaultValue` is returned if `value` is `NaN`, `null`,
			* or `undefined`.
			*
			* @static
			* @memberOf _
			* @since 4.14.0
			* @category Util
			* @param {*} value The value to check.
			* @param {*} defaultValue The default value.
			* @returns {*} Returns the resolved value.
			* @example
			*
			* _.defaultTo(1, 10);
			* // => 1
			*
			* _.defaultTo(undefined, 10);
			* // => 10
			*/
			function defaultTo(value, defaultValue) {
				return value == null || value !== value ? defaultValue : value;
			}
			/**
			* Creates a function that returns the result of invoking the given functions
			* with the `this` binding of the created function, where each successive
			* invocation is supplied the return value of the previous.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Util
			* @param {...(Function|Function[])} [funcs] The functions to invoke.
			* @returns {Function} Returns the new composite function.
			* @see _.flowRight
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var addSquare = _.flow([_.add, square]);
			* addSquare(1, 2);
			* // => 9
			*/
			var flow = createFlow();
			/**
			* This method is like `_.flow` except that it creates a function that
			* invokes the given functions from right to left.
			*
			* @static
			* @since 3.0.0
			* @memberOf _
			* @category Util
			* @param {...(Function|Function[])} [funcs] The functions to invoke.
			* @returns {Function} Returns the new composite function.
			* @see _.flow
			* @example
			*
			* function square(n) {
			*   return n * n;
			* }
			*
			* var addSquare = _.flowRight([square, _.add]);
			* addSquare(1, 2);
			* // => 9
			*/
			var flowRight = createFlow(true);
			/**
			* This method returns the first argument it receives.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {*} value Any value.
			* @returns {*} Returns `value`.
			* @example
			*
			* var object = { 'a': 1 };
			*
			* console.log(_.identity(object) === object);
			* // => true
			*/
			function identity(value) {
				return value;
			}
			/**
			* Creates a function that invokes `func` with the arguments of the created
			* function. If `func` is a property name, the created function returns the
			* property value for a given element. If `func` is an array or object, the
			* created function returns `true` for elements that contain the equivalent
			* source properties, otherwise it returns `false`.
			*
			* @static
			* @since 4.0.0
			* @memberOf _
			* @category Util
			* @param {*} [func=_.identity] The value to convert to a callback.
			* @returns {Function} Returns the callback.
			* @example
			*
			* var users = [
			*   { 'user': 'barney', 'age': 36, 'active': true },
			*   { 'user': 'fred',   'age': 40, 'active': false }
			* ];
			*
			* // The `_.matches` iteratee shorthand.
			* _.filter(users, _.iteratee({ 'user': 'barney', 'active': true }));
			* // => [{ 'user': 'barney', 'age': 36, 'active': true }]
			*
			* // The `_.matchesProperty` iteratee shorthand.
			* _.filter(users, _.iteratee(['user', 'fred']));
			* // => [{ 'user': 'fred', 'age': 40 }]
			*
			* // The `_.property` iteratee shorthand.
			* _.map(users, _.iteratee('user'));
			* // => ['barney', 'fred']
			*
			* // Create custom iteratee shorthands.
			* _.iteratee = _.wrap(_.iteratee, function(iteratee, func) {
			*   return !_.isRegExp(func) ? iteratee(func) : function(string) {
			*     return func.test(string);
			*   };
			* });
			*
			* _.filter(['abc', 'def'], /ef/);
			* // => ['def']
			*/
			function iteratee(func) {
				return baseIteratee(typeof func == "function" ? func : baseClone(func, CLONE_DEEP_FLAG));
			}
			/**
			* Creates a function that performs a partial deep comparison between a given
			* object and `source`, returning `true` if the given object has equivalent
			* property values, else `false`.
			*
			* **Note:** The created function is equivalent to `_.isMatch` with `source`
			* partially applied.
			*
			* Partial comparisons will match empty array and empty object `source`
			* values against any array or object value, respectively. See `_.isEqual`
			* for a list of supported value comparisons.
			*
			* **Note:** Multiple values can be checked by combining several matchers
			* using `_.overSome`
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Util
			* @param {Object} source The object of property values to match.
			* @returns {Function} Returns the new spec function.
			* @example
			*
			* var objects = [
			*   { 'a': 1, 'b': 2, 'c': 3 },
			*   { 'a': 4, 'b': 5, 'c': 6 }
			* ];
			*
			* _.filter(objects, _.matches({ 'a': 4, 'c': 6 }));
			* // => [{ 'a': 4, 'b': 5, 'c': 6 }]
			*
			* // Checking for several possible values
			* _.filter(objects, _.overSome([_.matches({ 'a': 1 }), _.matches({ 'a': 4 })]));
			* // => [{ 'a': 1, 'b': 2, 'c': 3 }, { 'a': 4, 'b': 5, 'c': 6 }]
			*/
			function matches(source) {
				return baseMatches(baseClone(source, CLONE_DEEP_FLAG));
			}
			/**
			* Creates a function that performs a partial deep comparison between the
			* value at `path` of a given object to `srcValue`, returning `true` if the
			* object value is equivalent, else `false`.
			*
			* **Note:** Partial comparisons will match empty array and empty object
			* `srcValue` values against any array or object value, respectively. See
			* `_.isEqual` for a list of supported value comparisons.
			*
			* **Note:** Multiple values can be checked by combining several matchers
			* using `_.overSome`
			*
			* @static
			* @memberOf _
			* @since 3.2.0
			* @category Util
			* @param {Array|string} path The path of the property to get.
			* @param {*} srcValue The value to match.
			* @returns {Function} Returns the new spec function.
			* @example
			*
			* var objects = [
			*   { 'a': 1, 'b': 2, 'c': 3 },
			*   { 'a': 4, 'b': 5, 'c': 6 }
			* ];
			*
			* _.find(objects, _.matchesProperty('a', 4));
			* // => { 'a': 4, 'b': 5, 'c': 6 }
			*
			* // Checking for several possible values
			* _.filter(objects, _.overSome([_.matchesProperty('a', 1), _.matchesProperty('a', 4)]));
			* // => [{ 'a': 1, 'b': 2, 'c': 3 }, { 'a': 4, 'b': 5, 'c': 6 }]
			*/
			function matchesProperty(path, srcValue) {
				return baseMatchesProperty(path, baseClone(srcValue, CLONE_DEEP_FLAG));
			}
			/**
			* Creates a function that invokes the method at `path` of a given object.
			* Any additional arguments are provided to the invoked method.
			*
			* @static
			* @memberOf _
			* @since 3.7.0
			* @category Util
			* @param {Array|string} path The path of the method to invoke.
			* @param {...*} [args] The arguments to invoke the method with.
			* @returns {Function} Returns the new invoker function.
			* @example
			*
			* var objects = [
			*   { 'a': { 'b': _.constant(2) } },
			*   { 'a': { 'b': _.constant(1) } }
			* ];
			*
			* _.map(objects, _.method('a.b'));
			* // => [2, 1]
			*
			* _.map(objects, _.method(['a', 'b']));
			* // => [2, 1]
			*/
			var method = baseRest(function(path, args) {
				return function(object) {
					return baseInvoke(object, path, args);
				};
			});
			/**
			* The opposite of `_.method`; this method creates a function that invokes
			* the method at a given path of `object`. Any additional arguments are
			* provided to the invoked method.
			*
			* @static
			* @memberOf _
			* @since 3.7.0
			* @category Util
			* @param {Object} object The object to query.
			* @param {...*} [args] The arguments to invoke the method with.
			* @returns {Function} Returns the new invoker function.
			* @example
			*
			* var array = _.times(3, _.constant),
			*     object = { 'a': array, 'b': array, 'c': array };
			*
			* _.map(['a[2]', 'c[0]'], _.methodOf(object));
			* // => [2, 0]
			*
			* _.map([['a', '2'], ['c', '0']], _.methodOf(object));
			* // => [2, 0]
			*/
			var methodOf = baseRest(function(object, args) {
				return function(path) {
					return baseInvoke(object, path, args);
				};
			});
			/**
			* Adds all own enumerable string keyed function properties of a source
			* object to the destination object. If `object` is a function, then methods
			* are added to its prototype as well.
			*
			* **Note:** Use `_.runInContext` to create a pristine `lodash` function to
			* avoid conflicts caused by modifying the original.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {Function|Object} [object=lodash] The destination object.
			* @param {Object} source The object of functions to add.
			* @param {Object} [options={}] The options object.
			* @param {boolean} [options.chain=true] Specify whether mixins are chainable.
			* @returns {Function|Object} Returns `object`.
			* @example
			*
			* function vowels(string) {
			*   return _.filter(string, function(v) {
			*     return /[aeiou]/i.test(v);
			*   });
			* }
			*
			* _.mixin({ 'vowels': vowels });
			* _.vowels('fred');
			* // => ['e']
			*
			* _('fred').vowels().value();
			* // => ['e']
			*
			* _.mixin({ 'vowels': vowels }, { 'chain': false });
			* _('fred').vowels();
			* // => ['e']
			*/
			function mixin(object, source, options) {
				var props = keys(source), methodNames = baseFunctions(source, props);
				if (options == null && !(isObject(source) && (methodNames.length || !props.length))) {
					options = source;
					source = object;
					object = this;
					methodNames = baseFunctions(source, keys(source));
				}
				var chain = !(isObject(options) && "chain" in options) || !!options.chain, isFunc = isFunction(object);
				arrayEach(methodNames, function(methodName) {
					var func = source[methodName];
					object[methodName] = func;
					if (isFunc) object.prototype[methodName] = function() {
						var chainAll = this.__chain__;
						if (chain || chainAll) {
							var result = object(this.__wrapped__);
							(result.__actions__ = copyArray(this.__actions__)).push({
								"func": func,
								"args": arguments,
								"thisArg": object
							});
							result.__chain__ = chainAll;
							return result;
						}
						return func.apply(object, arrayPush([this.value()], arguments));
					};
				});
				return object;
			}
			/**
			* Reverts the `_` variable to its previous value and returns a reference to
			* the `lodash` function.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @returns {Function} Returns the `lodash` function.
			* @example
			*
			* var lodash = _.noConflict();
			*/
			function noConflict() {
				if (root._ === this) root._ = oldDash;
				return this;
			}
			/**
			* This method returns `undefined`.
			*
			* @static
			* @memberOf _
			* @since 2.3.0
			* @category Util
			* @example
			*
			* _.times(2, _.noop);
			* // => [undefined, undefined]
			*/
			function noop() {}
			/**
			* Creates a function that gets the argument at index `n`. If `n` is negative,
			* the nth argument from the end is returned.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {number} [n=0] The index of the argument to return.
			* @returns {Function} Returns the new pass-thru function.
			* @example
			*
			* var func = _.nthArg(1);
			* func('a', 'b', 'c', 'd');
			* // => 'b'
			*
			* var func = _.nthArg(-2);
			* func('a', 'b', 'c', 'd');
			* // => 'c'
			*/
			function nthArg(n) {
				n = toInteger(n);
				return baseRest(function(args) {
					return baseNth(args, n);
				});
			}
			/**
			* Creates a function that invokes `iteratees` with the arguments it receives
			* and returns their results.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {...(Function|Function[])} [iteratees=[_.identity]]
			*  The iteratees to invoke.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var func = _.over([Math.max, Math.min]);
			*
			* func(1, 2, 3, 4);
			* // => [4, 1]
			*/
			var over = createOver(arrayMap);
			/**
			* Creates a function that checks if **all** of the `predicates` return
			* truthy when invoked with the arguments it receives.
			*
			* Following shorthands are possible for providing predicates.
			* Pass an `Object` and it will be used as an parameter for `_.matches` to create the predicate.
			* Pass an `Array` of parameters for `_.matchesProperty` and the predicate will be created using them.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {...(Function|Function[])} [predicates=[_.identity]]
			*  The predicates to check.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var func = _.overEvery([Boolean, isFinite]);
			*
			* func('1');
			* // => true
			*
			* func(null);
			* // => false
			*
			* func(NaN);
			* // => false
			*/
			var overEvery = createOver(arrayEvery);
			/**
			* Creates a function that checks if **any** of the `predicates` return
			* truthy when invoked with the arguments it receives.
			*
			* Following shorthands are possible for providing predicates.
			* Pass an `Object` and it will be used as an parameter for `_.matches` to create the predicate.
			* Pass an `Array` of parameters for `_.matchesProperty` and the predicate will be created using them.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {...(Function|Function[])} [predicates=[_.identity]]
			*  The predicates to check.
			* @returns {Function} Returns the new function.
			* @example
			*
			* var func = _.overSome([Boolean, isFinite]);
			*
			* func('1');
			* // => true
			*
			* func(null);
			* // => true
			*
			* func(NaN);
			* // => false
			*
			* var matchesFunc = _.overSome([{ 'a': 1 }, { 'a': 2 }])
			* var matchesPropertyFunc = _.overSome([['a', 1], ['a', 2]])
			*/
			var overSome = createOver(arraySome);
			/**
			* Creates a function that returns the value at `path` of a given object.
			*
			* @static
			* @memberOf _
			* @since 2.4.0
			* @category Util
			* @param {Array|string} path The path of the property to get.
			* @returns {Function} Returns the new accessor function.
			* @example
			*
			* var objects = [
			*   { 'a': { 'b': 2 } },
			*   { 'a': { 'b': 1 } }
			* ];
			*
			* _.map(objects, _.property('a.b'));
			* // => [2, 1]
			*
			* _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
			* // => [1, 2]
			*/
			function property(path) {
				return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
			}
			/**
			* The opposite of `_.property`; this method creates a function that returns
			* the value at a given path of `object`.
			*
			* @static
			* @memberOf _
			* @since 3.0.0
			* @category Util
			* @param {Object} object The object to query.
			* @returns {Function} Returns the new accessor function.
			* @example
			*
			* var array = [0, 1, 2],
			*     object = { 'a': array, 'b': array, 'c': array };
			*
			* _.map(['a[2]', 'c[0]'], _.propertyOf(object));
			* // => [2, 0]
			*
			* _.map([['a', '2'], ['c', '0']], _.propertyOf(object));
			* // => [2, 0]
			*/
			function propertyOf(object) {
				return function(path) {
					return object == null ? undefined : baseGet(object, path);
				};
			}
			/**
			* Creates an array of numbers (positive and/or negative) progressing from
			* `start` up to, but not including, `end`. A step of `-1` is used if a negative
			* `start` is specified without an `end` or `step`. If `end` is not specified,
			* it's set to `start` with `start` then set to `0`.
			*
			* **Note:** JavaScript follows the IEEE-754 standard for resolving
			* floating-point values which can produce unexpected results.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {number} [start=0] The start of the range.
			* @param {number} end The end of the range.
			* @param {number} [step=1] The value to increment or decrement by.
			* @returns {Array} Returns the range of numbers.
			* @see _.inRange, _.rangeRight
			* @example
			*
			* _.range(4);
			* // => [0, 1, 2, 3]
			*
			* _.range(-4);
			* // => [0, -1, -2, -3]
			*
			* _.range(1, 5);
			* // => [1, 2, 3, 4]
			*
			* _.range(0, 20, 5);
			* // => [0, 5, 10, 15]
			*
			* _.range(0, -4, -1);
			* // => [0, -1, -2, -3]
			*
			* _.range(1, 4, 0);
			* // => [1, 1, 1]
			*
			* _.range(0);
			* // => []
			*/
			var range = createRange();
			/**
			* This method is like `_.range` except that it populates values in
			* descending order.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {number} [start=0] The start of the range.
			* @param {number} end The end of the range.
			* @param {number} [step=1] The value to increment or decrement by.
			* @returns {Array} Returns the range of numbers.
			* @see _.inRange, _.range
			* @example
			*
			* _.rangeRight(4);
			* // => [3, 2, 1, 0]
			*
			* _.rangeRight(-4);
			* // => [-3, -2, -1, 0]
			*
			* _.rangeRight(1, 5);
			* // => [4, 3, 2, 1]
			*
			* _.rangeRight(0, 20, 5);
			* // => [15, 10, 5, 0]
			*
			* _.rangeRight(0, -4, -1);
			* // => [-3, -2, -1, 0]
			*
			* _.rangeRight(1, 4, 0);
			* // => [1, 1, 1]
			*
			* _.rangeRight(0);
			* // => []
			*/
			var rangeRight = createRange(true);
			/**
			* This method returns a new empty array.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {Array} Returns the new empty array.
			* @example
			*
			* var arrays = _.times(2, _.stubArray);
			*
			* console.log(arrays);
			* // => [[], []]
			*
			* console.log(arrays[0] === arrays[1]);
			* // => false
			*/
			function stubArray() {
				return [];
			}
			/**
			* This method returns `false`.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {boolean} Returns `false`.
			* @example
			*
			* _.times(2, _.stubFalse);
			* // => [false, false]
			*/
			function stubFalse() {
				return false;
			}
			/**
			* This method returns a new empty object.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {Object} Returns the new empty object.
			* @example
			*
			* var objects = _.times(2, _.stubObject);
			*
			* console.log(objects);
			* // => [{}, {}]
			*
			* console.log(objects[0] === objects[1]);
			* // => false
			*/
			function stubObject() {
				return {};
			}
			/**
			* This method returns an empty string.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {string} Returns the empty string.
			* @example
			*
			* _.times(2, _.stubString);
			* // => ['', '']
			*/
			function stubString() {
				return "";
			}
			/**
			* This method returns `true`.
			*
			* @static
			* @memberOf _
			* @since 4.13.0
			* @category Util
			* @returns {boolean} Returns `true`.
			* @example
			*
			* _.times(2, _.stubTrue);
			* // => [true, true]
			*/
			function stubTrue() {
				return true;
			}
			/**
			* Invokes the iteratee `n` times, returning an array of the results of
			* each invocation. The iteratee is invoked with one argument; (index).
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {number} n The number of times to invoke `iteratee`.
			* @param {Function} [iteratee=_.identity] The function invoked per iteration.
			* @returns {Array} Returns the array of results.
			* @example
			*
			* _.times(3, String);
			* // => ['0', '1', '2']
			*
			*  _.times(4, _.constant(0));
			* // => [0, 0, 0, 0]
			*/
			function times(n, iteratee) {
				n = toInteger(n);
				if (n < 1 || n > MAX_SAFE_INTEGER) return [];
				var index = MAX_ARRAY_LENGTH, length = nativeMin(n, MAX_ARRAY_LENGTH);
				iteratee = getIteratee(iteratee);
				n -= MAX_ARRAY_LENGTH;
				var result = baseTimes(length, iteratee);
				while (++index < n) iteratee(index);
				return result;
			}
			/**
			* Converts `value` to a property path array.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Util
			* @param {*} value The value to convert.
			* @returns {Array} Returns the new property path array.
			* @example
			*
			* _.toPath('a.b.c');
			* // => ['a', 'b', 'c']
			*
			* _.toPath('a[0].b.c');
			* // => ['a', '0', 'b', 'c']
			*/
			function toPath(value) {
				if (isArray(value)) return arrayMap(value, toKey);
				return isSymbol(value) ? [value] : copyArray(stringToPath(toString(value)));
			}
			/**
			* Generates a unique ID. If `prefix` is given, the ID is appended to it.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Util
			* @param {string} [prefix=''] The value to prefix the ID with.
			* @returns {string} Returns the unique ID.
			* @example
			*
			* _.uniqueId('contact_');
			* // => 'contact_104'
			*
			* _.uniqueId();
			* // => '105'
			*/
			function uniqueId(prefix) {
				var id = ++idCounter;
				return toString(prefix) + id;
			}
			/**
			* Adds two numbers.
			*
			* @static
			* @memberOf _
			* @since 3.4.0
			* @category Math
			* @param {number} augend The first number in an addition.
			* @param {number} addend The second number in an addition.
			* @returns {number} Returns the total.
			* @example
			*
			* _.add(6, 4);
			* // => 10
			*/
			var add = createMathOperation(function(augend, addend) {
				return augend + addend;
			}, 0);
			/**
			* Computes `number` rounded up to `precision`.
			*
			* @static
			* @memberOf _
			* @since 3.10.0
			* @category Math
			* @param {number} number The number to round up.
			* @param {number} [precision=0] The precision to round up to.
			* @returns {number} Returns the rounded up number.
			* @example
			*
			* _.ceil(4.006);
			* // => 5
			*
			* _.ceil(6.004, 2);
			* // => 6.01
			*
			* _.ceil(6040, -2);
			* // => 6100
			*/
			var ceil = createRound("ceil");
			/**
			* Divide two numbers.
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Math
			* @param {number} dividend The first number in a division.
			* @param {number} divisor The second number in a division.
			* @returns {number} Returns the quotient.
			* @example
			*
			* _.divide(6, 4);
			* // => 1.5
			*/
			var divide = createMathOperation(function(dividend, divisor) {
				return dividend / divisor;
			}, 1);
			/**
			* Computes `number` rounded down to `precision`.
			*
			* @static
			* @memberOf _
			* @since 3.10.0
			* @category Math
			* @param {number} number The number to round down.
			* @param {number} [precision=0] The precision to round down to.
			* @returns {number} Returns the rounded down number.
			* @example
			*
			* _.floor(4.006);
			* // => 4
			*
			* _.floor(0.046, 2);
			* // => 0.04
			*
			* _.floor(4060, -2);
			* // => 4000
			*/
			var floor = createRound("floor");
			/**
			* Computes the maximum value of `array`. If `array` is empty or falsey,
			* `undefined` is returned.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Math
			* @param {Array} array The array to iterate over.
			* @returns {*} Returns the maximum value.
			* @example
			*
			* _.max([4, 2, 8, 6]);
			* // => 8
			*
			* _.max([]);
			* // => undefined
			*/
			function max(array) {
				return array && array.length ? baseExtremum(array, identity, baseGt) : undefined;
			}
			/**
			* This method is like `_.max` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the criterion by which
			* the value is ranked. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {*} Returns the maximum value.
			* @example
			*
			* var objects = [{ 'n': 1 }, { 'n': 2 }];
			*
			* _.maxBy(objects, function(o) { return o.n; });
			* // => { 'n': 2 }
			*
			* // The `_.property` iteratee shorthand.
			* _.maxBy(objects, 'n');
			* // => { 'n': 2 }
			*/
			function maxBy(array, iteratee) {
				return array && array.length ? baseExtremum(array, getIteratee(iteratee, 2), baseGt) : undefined;
			}
			/**
			* Computes the mean of the values in `array`.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @returns {number} Returns the mean.
			* @example
			*
			* _.mean([4, 2, 8, 6]);
			* // => 5
			*/
			function mean(array) {
				return baseMean(array, identity);
			}
			/**
			* This method is like `_.mean` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the value to be averaged.
			* The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {number} Returns the mean.
			* @example
			*
			* var objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }];
			*
			* _.meanBy(objects, function(o) { return o.n; });
			* // => 5
			*
			* // The `_.property` iteratee shorthand.
			* _.meanBy(objects, 'n');
			* // => 5
			*/
			function meanBy(array, iteratee) {
				return baseMean(array, getIteratee(iteratee, 2));
			}
			/**
			* Computes the minimum value of `array`. If `array` is empty or falsey,
			* `undefined` is returned.
			*
			* @static
			* @since 0.1.0
			* @memberOf _
			* @category Math
			* @param {Array} array The array to iterate over.
			* @returns {*} Returns the minimum value.
			* @example
			*
			* _.min([4, 2, 8, 6]);
			* // => 2
			*
			* _.min([]);
			* // => undefined
			*/
			function min(array) {
				return array && array.length ? baseExtremum(array, identity, baseLt) : undefined;
			}
			/**
			* This method is like `_.min` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the criterion by which
			* the value is ranked. The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {*} Returns the minimum value.
			* @example
			*
			* var objects = [{ 'n': 1 }, { 'n': 2 }];
			*
			* _.minBy(objects, function(o) { return o.n; });
			* // => { 'n': 1 }
			*
			* // The `_.property` iteratee shorthand.
			* _.minBy(objects, 'n');
			* // => { 'n': 1 }
			*/
			function minBy(array, iteratee) {
				return array && array.length ? baseExtremum(array, getIteratee(iteratee, 2), baseLt) : undefined;
			}
			/**
			* Multiply two numbers.
			*
			* @static
			* @memberOf _
			* @since 4.7.0
			* @category Math
			* @param {number} multiplier The first number in a multiplication.
			* @param {number} multiplicand The second number in a multiplication.
			* @returns {number} Returns the product.
			* @example
			*
			* _.multiply(6, 4);
			* // => 24
			*/
			var multiply = createMathOperation(function(multiplier, multiplicand) {
				return multiplier * multiplicand;
			}, 1);
			/**
			* Computes `number` rounded to `precision`.
			*
			* @static
			* @memberOf _
			* @since 3.10.0
			* @category Math
			* @param {number} number The number to round.
			* @param {number} [precision=0] The precision to round to.
			* @returns {number} Returns the rounded number.
			* @example
			*
			* _.round(4.006);
			* // => 4
			*
			* _.round(4.006, 2);
			* // => 4.01
			*
			* _.round(4060, -2);
			* // => 4100
			*/
			var round = createRound("round");
			/**
			* Subtract two numbers.
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {number} minuend The first number in a subtraction.
			* @param {number} subtrahend The second number in a subtraction.
			* @returns {number} Returns the difference.
			* @example
			*
			* _.subtract(6, 4);
			* // => 2
			*/
			var subtract = createMathOperation(function(minuend, subtrahend) {
				return minuend - subtrahend;
			}, 0);
			/**
			* Computes the sum of the values in `array`.
			*
			* @static
			* @memberOf _
			* @since 3.4.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @returns {number} Returns the sum.
			* @example
			*
			* _.sum([4, 2, 8, 6]);
			* // => 20
			*/
			function sum(array) {
				return array && array.length ? baseSum(array, identity) : 0;
			}
			/**
			* This method is like `_.sum` except that it accepts `iteratee` which is
			* invoked for each element in `array` to generate the value to be summed.
			* The iteratee is invoked with one argument: (value).
			*
			* @static
			* @memberOf _
			* @since 4.0.0
			* @category Math
			* @param {Array} array The array to iterate over.
			* @param {Function} [iteratee=_.identity] The iteratee invoked per element.
			* @returns {number} Returns the sum.
			* @example
			*
			* var objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }];
			*
			* _.sumBy(objects, function(o) { return o.n; });
			* // => 20
			*
			* // The `_.property` iteratee shorthand.
			* _.sumBy(objects, 'n');
			* // => 20
			*/
			function sumBy(array, iteratee) {
				return array && array.length ? baseSum(array, getIteratee(iteratee, 2)) : 0;
			}
			lodash.after = after;
			lodash.ary = ary;
			lodash.assign = assign;
			lodash.assignIn = assignIn;
			lodash.assignInWith = assignInWith;
			lodash.assignWith = assignWith;
			lodash.at = at;
			lodash.before = before;
			lodash.bind = bind;
			lodash.bindAll = bindAll;
			lodash.bindKey = bindKey;
			lodash.castArray = castArray;
			lodash.chain = chain;
			lodash.chunk = chunk;
			lodash.compact = compact;
			lodash.concat = concat;
			lodash.cond = cond;
			lodash.conforms = conforms;
			lodash.constant = constant;
			lodash.countBy = countBy;
			lodash.create = create;
			lodash.curry = curry;
			lodash.curryRight = curryRight;
			lodash.debounce = debounce;
			lodash.defaults = defaults;
			lodash.defaultsDeep = defaultsDeep;
			lodash.defer = defer;
			lodash.delay = delay;
			lodash.difference = difference;
			lodash.differenceBy = differenceBy;
			lodash.differenceWith = differenceWith;
			lodash.drop = drop;
			lodash.dropRight = dropRight;
			lodash.dropRightWhile = dropRightWhile;
			lodash.dropWhile = dropWhile;
			lodash.fill = fill;
			lodash.filter = filter;
			lodash.flatMap = flatMap;
			lodash.flatMapDeep = flatMapDeep;
			lodash.flatMapDepth = flatMapDepth;
			lodash.flatten = flatten;
			lodash.flattenDeep = flattenDeep;
			lodash.flattenDepth = flattenDepth;
			lodash.flip = flip;
			lodash.flow = flow;
			lodash.flowRight = flowRight;
			lodash.fromPairs = fromPairs;
			lodash.functions = functions;
			lodash.functionsIn = functionsIn;
			lodash.groupBy = groupBy;
			lodash.initial = initial;
			lodash.intersection = intersection;
			lodash.intersectionBy = intersectionBy;
			lodash.intersectionWith = intersectionWith;
			lodash.invert = invert;
			lodash.invertBy = invertBy;
			lodash.invokeMap = invokeMap;
			lodash.iteratee = iteratee;
			lodash.keyBy = keyBy;
			lodash.keys = keys;
			lodash.keysIn = keysIn;
			lodash.map = map;
			lodash.mapKeys = mapKeys;
			lodash.mapValues = mapValues;
			lodash.matches = matches;
			lodash.matchesProperty = matchesProperty;
			lodash.memoize = memoize;
			lodash.merge = merge;
			lodash.mergeWith = mergeWith;
			lodash.method = method;
			lodash.methodOf = methodOf;
			lodash.mixin = mixin;
			lodash.negate = negate;
			lodash.nthArg = nthArg;
			lodash.omit = omit;
			lodash.omitBy = omitBy;
			lodash.once = once;
			lodash.orderBy = orderBy;
			lodash.over = over;
			lodash.overArgs = overArgs;
			lodash.overEvery = overEvery;
			lodash.overSome = overSome;
			lodash.partial = partial;
			lodash.partialRight = partialRight;
			lodash.partition = partition;
			lodash.pick = pick;
			lodash.pickBy = pickBy;
			lodash.property = property;
			lodash.propertyOf = propertyOf;
			lodash.pull = pull;
			lodash.pullAll = pullAll;
			lodash.pullAllBy = pullAllBy;
			lodash.pullAllWith = pullAllWith;
			lodash.pullAt = pullAt;
			lodash.range = range;
			lodash.rangeRight = rangeRight;
			lodash.rearg = rearg;
			lodash.reject = reject;
			lodash.remove = remove;
			lodash.rest = rest;
			lodash.reverse = reverse;
			lodash.sampleSize = sampleSize;
			lodash.set = set;
			lodash.setWith = setWith;
			lodash.shuffle = shuffle;
			lodash.slice = slice;
			lodash.sortBy = sortBy;
			lodash.sortedUniq = sortedUniq;
			lodash.sortedUniqBy = sortedUniqBy;
			lodash.split = split;
			lodash.spread = spread;
			lodash.tail = tail;
			lodash.take = take;
			lodash.takeRight = takeRight;
			lodash.takeRightWhile = takeRightWhile;
			lodash.takeWhile = takeWhile;
			lodash.tap = tap;
			lodash.throttle = throttle;
			lodash.thru = thru;
			lodash.toArray = toArray;
			lodash.toPairs = toPairs;
			lodash.toPairsIn = toPairsIn;
			lodash.toPath = toPath;
			lodash.toPlainObject = toPlainObject;
			lodash.transform = transform;
			lodash.unary = unary;
			lodash.union = union;
			lodash.unionBy = unionBy;
			lodash.unionWith = unionWith;
			lodash.uniq = uniq;
			lodash.uniqBy = uniqBy;
			lodash.uniqWith = uniqWith;
			lodash.unset = unset;
			lodash.unzip = unzip;
			lodash.unzipWith = unzipWith;
			lodash.update = update;
			lodash.updateWith = updateWith;
			lodash.values = values;
			lodash.valuesIn = valuesIn;
			lodash.without = without;
			lodash.words = words;
			lodash.wrap = wrap;
			lodash.xor = xor;
			lodash.xorBy = xorBy;
			lodash.xorWith = xorWith;
			lodash.zip = zip;
			lodash.zipObject = zipObject;
			lodash.zipObjectDeep = zipObjectDeep;
			lodash.zipWith = zipWith;
			lodash.entries = toPairs;
			lodash.entriesIn = toPairsIn;
			lodash.extend = assignIn;
			lodash.extendWith = assignInWith;
			mixin(lodash, lodash);
			lodash.add = add;
			lodash.attempt = attempt;
			lodash.camelCase = camelCase;
			lodash.capitalize = capitalize;
			lodash.ceil = ceil;
			lodash.clamp = clamp;
			lodash.clone = clone;
			lodash.cloneDeep = cloneDeep;
			lodash.cloneDeepWith = cloneDeepWith;
			lodash.cloneWith = cloneWith;
			lodash.conformsTo = conformsTo;
			lodash.deburr = deburr;
			lodash.defaultTo = defaultTo;
			lodash.divide = divide;
			lodash.endsWith = endsWith;
			lodash.eq = eq;
			lodash.escape = escape;
			lodash.escapeRegExp = escapeRegExp;
			lodash.every = every;
			lodash.find = find;
			lodash.findIndex = findIndex;
			lodash.findKey = findKey;
			lodash.findLast = findLast;
			lodash.findLastIndex = findLastIndex;
			lodash.findLastKey = findLastKey;
			lodash.floor = floor;
			lodash.forEach = forEach;
			lodash.forEachRight = forEachRight;
			lodash.forIn = forIn;
			lodash.forInRight = forInRight;
			lodash.forOwn = forOwn;
			lodash.forOwnRight = forOwnRight;
			lodash.get = get;
			lodash.gt = gt;
			lodash.gte = gte;
			lodash.has = has;
			lodash.hasIn = hasIn;
			lodash.head = head;
			lodash.identity = identity;
			lodash.includes = includes;
			lodash.indexOf = indexOf;
			lodash.inRange = inRange;
			lodash.invoke = invoke;
			lodash.isArguments = isArguments;
			lodash.isArray = isArray;
			lodash.isArrayBuffer = isArrayBuffer;
			lodash.isArrayLike = isArrayLike;
			lodash.isArrayLikeObject = isArrayLikeObject;
			lodash.isBoolean = isBoolean;
			lodash.isBuffer = isBuffer;
			lodash.isDate = isDate;
			lodash.isElement = isElement;
			lodash.isEmpty = isEmpty;
			lodash.isEqual = isEqual;
			lodash.isEqualWith = isEqualWith;
			lodash.isError = isError;
			lodash.isFinite = isFinite;
			lodash.isFunction = isFunction;
			lodash.isInteger = isInteger;
			lodash.isLength = isLength;
			lodash.isMap = isMap;
			lodash.isMatch = isMatch;
			lodash.isMatchWith = isMatchWith;
			lodash.isNaN = isNaN;
			lodash.isNative = isNative;
			lodash.isNil = isNil;
			lodash.isNull = isNull;
			lodash.isNumber = isNumber;
			lodash.isObject = isObject;
			lodash.isObjectLike = isObjectLike;
			lodash.isPlainObject = isPlainObject;
			lodash.isRegExp = isRegExp;
			lodash.isSafeInteger = isSafeInteger;
			lodash.isSet = isSet;
			lodash.isString = isString;
			lodash.isSymbol = isSymbol;
			lodash.isTypedArray = isTypedArray;
			lodash.isUndefined = isUndefined;
			lodash.isWeakMap = isWeakMap;
			lodash.isWeakSet = isWeakSet;
			lodash.join = join;
			lodash.kebabCase = kebabCase;
			lodash.last = last;
			lodash.lastIndexOf = lastIndexOf;
			lodash.lowerCase = lowerCase;
			lodash.lowerFirst = lowerFirst;
			lodash.lt = lt;
			lodash.lte = lte;
			lodash.max = max;
			lodash.maxBy = maxBy;
			lodash.mean = mean;
			lodash.meanBy = meanBy;
			lodash.min = min;
			lodash.minBy = minBy;
			lodash.stubArray = stubArray;
			lodash.stubFalse = stubFalse;
			lodash.stubObject = stubObject;
			lodash.stubString = stubString;
			lodash.stubTrue = stubTrue;
			lodash.multiply = multiply;
			lodash.nth = nth;
			lodash.noConflict = noConflict;
			lodash.noop = noop;
			lodash.now = now;
			lodash.pad = pad;
			lodash.padEnd = padEnd;
			lodash.padStart = padStart;
			lodash.parseInt = parseInt;
			lodash.random = random;
			lodash.reduce = reduce;
			lodash.reduceRight = reduceRight;
			lodash.repeat = repeat;
			lodash.replace = replace;
			lodash.result = result;
			lodash.round = round;
			lodash.runInContext = runInContext;
			lodash.sample = sample;
			lodash.size = size;
			lodash.snakeCase = snakeCase;
			lodash.some = some;
			lodash.sortedIndex = sortedIndex;
			lodash.sortedIndexBy = sortedIndexBy;
			lodash.sortedIndexOf = sortedIndexOf;
			lodash.sortedLastIndex = sortedLastIndex;
			lodash.sortedLastIndexBy = sortedLastIndexBy;
			lodash.sortedLastIndexOf = sortedLastIndexOf;
			lodash.startCase = startCase;
			lodash.startsWith = startsWith;
			lodash.subtract = subtract;
			lodash.sum = sum;
			lodash.sumBy = sumBy;
			lodash.template = template;
			lodash.times = times;
			lodash.toFinite = toFinite;
			lodash.toInteger = toInteger;
			lodash.toLength = toLength;
			lodash.toLower = toLower;
			lodash.toNumber = toNumber;
			lodash.toSafeInteger = toSafeInteger;
			lodash.toString = toString;
			lodash.toUpper = toUpper;
			lodash.trim = trim;
			lodash.trimEnd = trimEnd;
			lodash.trimStart = trimStart;
			lodash.truncate = truncate;
			lodash.unescape = unescape;
			lodash.uniqueId = uniqueId;
			lodash.upperCase = upperCase;
			lodash.upperFirst = upperFirst;
			lodash.each = forEach;
			lodash.eachRight = forEachRight;
			lodash.first = head;
			mixin(lodash, function() {
				var source = {};
				baseForOwn(lodash, function(func, methodName) {
					if (!hasOwnProperty.call(lodash.prototype, methodName)) source[methodName] = func;
				});
				return source;
			}(), { "chain": false });
			/**
			* The semantic version number.
			*
			* @static
			* @memberOf _
			* @type {string}
			*/
			lodash.VERSION = VERSION;
			arrayEach([
				"bind",
				"bindKey",
				"curry",
				"curryRight",
				"partial",
				"partialRight"
			], function(methodName) {
				lodash[methodName].placeholder = lodash;
			});
			arrayEach(["drop", "take"], function(methodName, index) {
				LazyWrapper.prototype[methodName] = function(n) {
					n = n === undefined ? 1 : nativeMax(toInteger(n), 0);
					var result = this.__filtered__ && !index ? new LazyWrapper(this) : this.clone();
					if (result.__filtered__) result.__takeCount__ = nativeMin(n, result.__takeCount__);
					else result.__views__.push({
						"size": nativeMin(n, MAX_ARRAY_LENGTH),
						"type": methodName + (result.__dir__ < 0 ? "Right" : "")
					});
					return result;
				};
				LazyWrapper.prototype[methodName + "Right"] = function(n) {
					return this.reverse()[methodName](n).reverse();
				};
			});
			arrayEach([
				"filter",
				"map",
				"takeWhile"
			], function(methodName, index) {
				var type = index + 1, isFilter = type == LAZY_FILTER_FLAG || type == LAZY_WHILE_FLAG;
				LazyWrapper.prototype[methodName] = function(iteratee) {
					var result = this.clone();
					result.__iteratees__.push({
						"iteratee": getIteratee(iteratee, 3),
						"type": type
					});
					result.__filtered__ = result.__filtered__ || isFilter;
					return result;
				};
			});
			arrayEach(["head", "last"], function(methodName, index) {
				var takeName = "take" + (index ? "Right" : "");
				LazyWrapper.prototype[methodName] = function() {
					return this[takeName](1).value()[0];
				};
			});
			arrayEach(["initial", "tail"], function(methodName, index) {
				var dropName = "drop" + (index ? "" : "Right");
				LazyWrapper.prototype[methodName] = function() {
					return this.__filtered__ ? new LazyWrapper(this) : this[dropName](1);
				};
			});
			LazyWrapper.prototype.compact = function() {
				return this.filter(identity);
			};
			LazyWrapper.prototype.find = function(predicate) {
				return this.filter(predicate).head();
			};
			LazyWrapper.prototype.findLast = function(predicate) {
				return this.reverse().find(predicate);
			};
			LazyWrapper.prototype.invokeMap = baseRest(function(path, args) {
				if (typeof path == "function") return new LazyWrapper(this);
				return this.map(function(value) {
					return baseInvoke(value, path, args);
				});
			});
			LazyWrapper.prototype.reject = function(predicate) {
				return this.filter(negate(getIteratee(predicate)));
			};
			LazyWrapper.prototype.slice = function(start, end) {
				start = toInteger(start);
				var result = this;
				if (result.__filtered__ && (start > 0 || end < 0)) return new LazyWrapper(result);
				if (start < 0) result = result.takeRight(-start);
				else if (start) result = result.drop(start);
				if (end !== undefined) {
					end = toInteger(end);
					result = end < 0 ? result.dropRight(-end) : result.take(end - start);
				}
				return result;
			};
			LazyWrapper.prototype.takeRightWhile = function(predicate) {
				return this.reverse().takeWhile(predicate).reverse();
			};
			LazyWrapper.prototype.toArray = function() {
				return this.take(MAX_ARRAY_LENGTH);
			};
			baseForOwn(LazyWrapper.prototype, function(func, methodName) {
				var checkIteratee = /^(?:filter|find|map|reject)|While$/.test(methodName), isTaker = /^(?:head|last)$/.test(methodName), lodashFunc = lodash[isTaker ? "take" + (methodName == "last" ? "Right" : "") : methodName], retUnwrapped = isTaker || /^find/.test(methodName);
				if (!lodashFunc) return;
				lodash.prototype[methodName] = function() {
					var value = this.__wrapped__, args = isTaker ? [1] : arguments, isLazy = value instanceof LazyWrapper, iteratee = args[0], useLazy = isLazy || isArray(value);
					var interceptor = function(value) {
						var result = lodashFunc.apply(lodash, arrayPush([value], args));
						return isTaker && chainAll ? result[0] : result;
					};
					if (useLazy && checkIteratee && typeof iteratee == "function" && iteratee.length != 1) isLazy = useLazy = false;
					var chainAll = this.__chain__, isHybrid = !!this.__actions__.length, isUnwrapped = retUnwrapped && !chainAll, onlyLazy = isLazy && !isHybrid;
					if (!retUnwrapped && useLazy) {
						value = onlyLazy ? value : new LazyWrapper(this);
						var result = func.apply(value, args);
						result.__actions__.push({
							"func": thru,
							"args": [interceptor],
							"thisArg": undefined
						});
						return new LodashWrapper(result, chainAll);
					}
					if (isUnwrapped && onlyLazy) return func.apply(this, args);
					result = this.thru(interceptor);
					return isUnwrapped ? isTaker ? result.value()[0] : result.value() : result;
				};
			});
			arrayEach([
				"pop",
				"push",
				"shift",
				"sort",
				"splice",
				"unshift"
			], function(methodName) {
				var func = arrayProto[methodName], chainName = /^(?:push|sort|unshift)$/.test(methodName) ? "tap" : "thru", retUnwrapped = /^(?:pop|shift)$/.test(methodName);
				lodash.prototype[methodName] = function() {
					var args = arguments;
					if (retUnwrapped && !this.__chain__) {
						var value = this.value();
						return func.apply(isArray(value) ? value : [], args);
					}
					return this[chainName](function(value) {
						return func.apply(isArray(value) ? value : [], args);
					});
				};
			});
			baseForOwn(LazyWrapper.prototype, function(func, methodName) {
				var lodashFunc = lodash[methodName];
				if (lodashFunc) {
					var key = lodashFunc.name + "";
					if (!hasOwnProperty.call(realNames, key)) realNames[key] = [];
					realNames[key].push({
						"name": methodName,
						"func": lodashFunc
					});
				}
			});
			realNames[createHybrid(undefined, WRAP_BIND_KEY_FLAG).name] = [{
				"name": "wrapper",
				"func": undefined
			}];
			LazyWrapper.prototype.clone = lazyClone;
			LazyWrapper.prototype.reverse = lazyReverse;
			LazyWrapper.prototype.value = lazyValue;
			lodash.prototype.at = wrapperAt;
			lodash.prototype.chain = wrapperChain;
			lodash.prototype.commit = wrapperCommit;
			lodash.prototype.next = wrapperNext;
			lodash.prototype.plant = wrapperPlant;
			lodash.prototype.reverse = wrapperReverse;
			lodash.prototype.toJSON = lodash.prototype.valueOf = lodash.prototype.value = wrapperValue;
			lodash.prototype.first = lodash.prototype.head;
			if (symIterator) lodash.prototype[symIterator] = wrapperToIterator;
			return lodash;
		})();
		if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
			root._ = _;
			define(function() {
				return _;
			});
		} else if (freeModule) {
			(freeModule.exports = _)._ = _;
			freeExports._ = _;
		} else root._ = _;
	}).call(exports);
})))(), 1);
var NOTHING = Symbol.for("immer-nothing");
var DRAFTABLE = Symbol.for("immer-draftable");
var DRAFT_STATE = Symbol.for("immer-state");
function die(error, ...args) {
	throw new Error(`[Immer] minified error nr: ${error}. Full error at: https://bit.ly/3cXEKWf`);
}
var getPrototypeOf = Object.getPrototypeOf;
function isDraft(value) {
	return !!value && !!value[DRAFT_STATE];
}
function isDraftable(value) {
	if (!value) return false;
	return isPlainObject(value) || Array.isArray(value) || !!value[DRAFTABLE] || !!value.constructor?.[DRAFTABLE] || isMap(value) || isSet(value);
}
var objectCtorString = Object.prototype.constructor.toString();
var cachedCtorStrings = /* @__PURE__ */ new WeakMap();
function isPlainObject(value) {
	if (!value || typeof value !== "object") return false;
	const proto = Object.getPrototypeOf(value);
	if (proto === null || proto === Object.prototype) return true;
	const Ctor = Object.hasOwnProperty.call(proto, "constructor") && proto.constructor;
	if (Ctor === Object) return true;
	if (typeof Ctor !== "function") return false;
	let ctorString = cachedCtorStrings.get(Ctor);
	if (ctorString === void 0) {
		ctorString = Function.toString.call(Ctor);
		cachedCtorStrings.set(Ctor, ctorString);
	}
	return ctorString === objectCtorString;
}
function each(obj, iter, strict = true) {
	if (getArchtype(obj) === 0) (strict ? Reflect.ownKeys(obj) : Object.keys(obj)).forEach((key) => {
		iter(key, obj[key], obj);
	});
	else obj.forEach((entry, index) => iter(index, entry, obj));
}
function getArchtype(thing) {
	const state = thing[DRAFT_STATE];
	return state ? state.type_ : Array.isArray(thing) ? 1 : isMap(thing) ? 2 : isSet(thing) ? 3 : 0;
}
function has(thing, prop) {
	return getArchtype(thing) === 2 ? thing.has(prop) : Object.prototype.hasOwnProperty.call(thing, prop);
}
function set$1(thing, propOrOldValue, value) {
	const t = getArchtype(thing);
	if (t === 2) thing.set(propOrOldValue, value);
	else if (t === 3) thing.add(value);
	else thing[propOrOldValue] = value;
}
function is(x, y) {
	if (x === y) return x !== 0 || 1 / x === 1 / y;
	else return x !== x && y !== y;
}
function isMap(target) {
	return target instanceof Map;
}
function isSet(target) {
	return target instanceof Set;
}
function latest(state) {
	return state.copy_ || state.base_;
}
function shallowCopy(base, strict) {
	if (isMap(base)) return new Map(base);
	if (isSet(base)) return new Set(base);
	if (Array.isArray(base)) return Array.prototype.slice.call(base);
	const isPlain = isPlainObject(base);
	if (strict === true || strict === "class_only" && !isPlain) {
		const descriptors = Object.getOwnPropertyDescriptors(base);
		delete descriptors[DRAFT_STATE];
		let keys = Reflect.ownKeys(descriptors);
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			const desc = descriptors[key];
			if (desc.writable === false) {
				desc.writable = true;
				desc.configurable = true;
			}
			if (desc.get || desc.set) descriptors[key] = {
				configurable: true,
				writable: true,
				enumerable: desc.enumerable,
				value: base[key]
			};
		}
		return Object.create(getPrototypeOf(base), descriptors);
	} else {
		const proto = getPrototypeOf(base);
		if (proto !== null && isPlain) return { ...base };
		const obj = Object.create(proto);
		return Object.assign(obj, base);
	}
}
function freeze(obj, deep = false) {
	if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj)) return obj;
	if (getArchtype(obj) > 1) Object.defineProperties(obj, {
		set: dontMutateMethodOverride,
		add: dontMutateMethodOverride,
		clear: dontMutateMethodOverride,
		delete: dontMutateMethodOverride
	});
	Object.freeze(obj);
	if (deep) Object.values(obj).forEach((value) => freeze(value, true));
	return obj;
}
function dontMutateFrozenCollections() {
	die(2);
}
var dontMutateMethodOverride = { value: dontMutateFrozenCollections };
function isFrozen(obj) {
	if (obj === null || typeof obj !== "object") return true;
	return Object.isFrozen(obj);
}
var plugins = {};
function getPlugin(pluginKey) {
	const plugin = plugins[pluginKey];
	if (!plugin) die(0, pluginKey);
	return plugin;
}
var currentScope;
function getCurrentScope() {
	return currentScope;
}
function createScope(parent_, immer_) {
	return {
		drafts_: [],
		parent_,
		immer_,
		canAutoFreeze_: true,
		unfinalizedDrafts_: 0
	};
}
function usePatchesInScope(scope, patchListener) {
	if (patchListener) {
		getPlugin("Patches");
		scope.patches_ = [];
		scope.inversePatches_ = [];
		scope.patchListener_ = patchListener;
	}
}
function revokeScope(scope) {
	leaveScope(scope);
	scope.drafts_.forEach(revokeDraft);
	scope.drafts_ = null;
}
function leaveScope(scope) {
	if (scope === currentScope) currentScope = scope.parent_;
}
function enterScope(immer2) {
	return currentScope = createScope(currentScope, immer2);
}
function revokeDraft(draft) {
	const state = draft[DRAFT_STATE];
	if (state.type_ === 0 || state.type_ === 1) state.revoke_();
	else state.revoked_ = true;
}
function processResult(result, scope) {
	scope.unfinalizedDrafts_ = scope.drafts_.length;
	const baseDraft = scope.drafts_[0];
	if (result !== void 0 && result !== baseDraft) {
		if (baseDraft[DRAFT_STATE].modified_) {
			revokeScope(scope);
			die(4);
		}
		if (isDraftable(result)) {
			result = finalize(scope, result);
			if (!scope.parent_) maybeFreeze(scope, result);
		}
		if (scope.patches_) getPlugin("Patches").generateReplacementPatches_(baseDraft[DRAFT_STATE].base_, result, scope.patches_, scope.inversePatches_);
	} else result = finalize(scope, baseDraft, []);
	revokeScope(scope);
	if (scope.patches_) scope.patchListener_(scope.patches_, scope.inversePatches_);
	return result !== NOTHING ? result : void 0;
}
function finalize(rootScope, value, path) {
	if (isFrozen(value)) return value;
	const useStrictIteration = rootScope.immer_.shouldUseStrictIteration();
	const state = value[DRAFT_STATE];
	if (!state) {
		each(value, (key, childValue) => finalizeProperty(rootScope, state, value, key, childValue, path), useStrictIteration);
		return value;
	}
	if (state.scope_ !== rootScope) return value;
	if (!state.modified_) {
		maybeFreeze(rootScope, state.base_, true);
		return state.base_;
	}
	if (!state.finalized_) {
		state.finalized_ = true;
		state.scope_.unfinalizedDrafts_--;
		const result = state.copy_;
		let resultEach = result;
		let isSet2 = false;
		if (state.type_ === 3) {
			resultEach = new Set(result);
			result.clear();
			isSet2 = true;
		}
		each(resultEach, (key, childValue) => finalizeProperty(rootScope, state, result, key, childValue, path, isSet2), useStrictIteration);
		maybeFreeze(rootScope, result, false);
		if (path && rootScope.patches_) getPlugin("Patches").generatePatches_(state, path, rootScope.patches_, rootScope.inversePatches_);
	}
	return state.copy_;
}
function finalizeProperty(rootScope, parentState, targetObject, prop, childValue, rootPath, targetIsSet) {
	if (childValue == null) return;
	if (typeof childValue !== "object" && !targetIsSet) return;
	const childIsFrozen = isFrozen(childValue);
	if (childIsFrozen && !targetIsSet) return;
	if (isDraft(childValue)) {
		const res = finalize(rootScope, childValue, rootPath && parentState && parentState.type_ !== 3 && !has(parentState.assigned_, prop) ? rootPath.concat(prop) : void 0);
		set$1(targetObject, prop, res);
		if (isDraft(res)) rootScope.canAutoFreeze_ = false;
		else return;
	} else if (targetIsSet) targetObject.add(childValue);
	if (isDraftable(childValue) && !childIsFrozen) {
		if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) return;
		if (parentState && parentState.base_ && parentState.base_[prop] === childValue && childIsFrozen) return;
		finalize(rootScope, childValue);
		if ((!parentState || !parentState.scope_.parent_) && typeof prop !== "symbol" && (isMap(targetObject) ? targetObject.has(prop) : Object.prototype.propertyIsEnumerable.call(targetObject, prop))) maybeFreeze(rootScope, childValue);
	}
}
function maybeFreeze(scope, value, deep = false) {
	if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) freeze(value, deep);
}
function createProxyProxy(base, parent) {
	const isArray = Array.isArray(base);
	const state = {
		type_: isArray ? 1 : 0,
		scope_: parent ? parent.scope_ : getCurrentScope(),
		modified_: false,
		finalized_: false,
		assigned_: {},
		parent_: parent,
		base_: base,
		draft_: null,
		copy_: null,
		revoke_: null,
		isManual_: false
	};
	let target = state;
	let traps = objectTraps;
	if (isArray) {
		target = [state];
		traps = arrayTraps;
	}
	const { revoke, proxy } = Proxy.revocable(target, traps);
	state.draft_ = proxy;
	state.revoke_ = revoke;
	return proxy;
}
var objectTraps = {
	get(state, prop) {
		if (prop === DRAFT_STATE) return state;
		const source = latest(state);
		if (!has(source, prop)) return readPropFromProto(state, source, prop);
		const value = source[prop];
		if (state.finalized_ || !isDraftable(value)) return value;
		if (value === peek(state.base_, prop)) {
			prepareCopy(state);
			return state.copy_[prop] = createProxy(value, state);
		}
		return value;
	},
	has(state, prop) {
		return prop in latest(state);
	},
	ownKeys(state) {
		return Reflect.ownKeys(latest(state));
	},
	set(state, prop, value) {
		const desc = getDescriptorFromProto(latest(state), prop);
		if (desc?.set) {
			desc.set.call(state.draft_, value);
			return true;
		}
		if (!state.modified_) {
			const current2 = peek(latest(state), prop);
			const currentState = current2?.[DRAFT_STATE];
			if (currentState && currentState.base_ === value) {
				state.copy_[prop] = value;
				state.assigned_[prop] = false;
				return true;
			}
			if (is(value, current2) && (value !== void 0 || has(state.base_, prop))) return true;
			prepareCopy(state);
			markChanged(state);
		}
		if (state.copy_[prop] === value && (value !== void 0 || prop in state.copy_) || Number.isNaN(value) && Number.isNaN(state.copy_[prop])) return true;
		state.copy_[prop] = value;
		state.assigned_[prop] = true;
		return true;
	},
	deleteProperty(state, prop) {
		if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
			state.assigned_[prop] = false;
			prepareCopy(state);
			markChanged(state);
		} else delete state.assigned_[prop];
		if (state.copy_) delete state.copy_[prop];
		return true;
	},
	getOwnPropertyDescriptor(state, prop) {
		const owner = latest(state);
		const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
		if (!desc) return desc;
		return {
			writable: true,
			configurable: state.type_ !== 1 || prop !== "length",
			enumerable: desc.enumerable,
			value: owner[prop]
		};
	},
	defineProperty() {
		die(11);
	},
	getPrototypeOf(state) {
		return getPrototypeOf(state.base_);
	},
	setPrototypeOf() {
		die(12);
	}
};
var arrayTraps = {};
each(objectTraps, (key, fn) => {
	arrayTraps[key] = function() {
		arguments[0] = arguments[0][0];
		return fn.apply(this, arguments);
	};
});
arrayTraps.deleteProperty = function(state, prop) {
	return arrayTraps.set.call(this, state, prop, void 0);
};
arrayTraps.set = function(state, prop, value) {
	return objectTraps.set.call(this, state[0], prop, value, state[0]);
};
function peek(draft, prop) {
	const state = draft[DRAFT_STATE];
	return (state ? latest(state) : draft)[prop];
}
function readPropFromProto(state, source, prop) {
	const desc = getDescriptorFromProto(source, prop);
	return desc ? `value` in desc ? desc.value : desc.get?.call(state.draft_) : void 0;
}
function getDescriptorFromProto(source, prop) {
	if (!(prop in source)) return void 0;
	let proto = getPrototypeOf(source);
	while (proto) {
		const desc = Object.getOwnPropertyDescriptor(proto, prop);
		if (desc) return desc;
		proto = getPrototypeOf(proto);
	}
}
function markChanged(state) {
	if (!state.modified_) {
		state.modified_ = true;
		if (state.parent_) markChanged(state.parent_);
	}
}
function prepareCopy(state) {
	if (!state.copy_) state.copy_ = shallowCopy(state.base_, state.scope_.immer_.useStrictShallowCopy_);
}
var Immer2 = class {
	constructor(config) {
		this.autoFreeze_ = true;
		this.useStrictShallowCopy_ = false;
		this.useStrictIteration_ = true;
		/**
		* The `produce` function takes a value and a "recipe function" (whose
		* return value often depends on the base state). The recipe function is
		* free to mutate its first argument however it wants. All mutations are
		* only ever applied to a __copy__ of the base state.
		*
		* Pass only a function to create a "curried producer" which relieves you
		* from passing the recipe function every time.
		*
		* Only plain objects and arrays are made mutable. All other objects are
		* considered uncopyable.
		*
		* Note: This function is __bound__ to its `Immer` instance.
		*
		* @param {any} base - the initial state
		* @param {Function} recipe - function that receives a proxy of the base state as first argument and which can be freely modified
		* @param {Function} patchListener - optional function that will be called with all the patches produced here
		* @returns {any} a new state, or the initial state if nothing was modified
		*/
		this.produce = (base, recipe, patchListener) => {
			if (typeof base === "function" && typeof recipe !== "function") {
				const defaultBase = recipe;
				recipe = base;
				const self = this;
				return function curriedProduce(base2 = defaultBase, ...args) {
					return self.produce(base2, (draft) => recipe.call(this, draft, ...args));
				};
			}
			if (typeof recipe !== "function") die(6);
			if (patchListener !== void 0 && typeof patchListener !== "function") die(7);
			let result;
			if (isDraftable(base)) {
				const scope = enterScope(this);
				const proxy = createProxy(base, void 0);
				let hasError = true;
				try {
					result = recipe(proxy);
					hasError = false;
				} finally {
					if (hasError) revokeScope(scope);
					else leaveScope(scope);
				}
				usePatchesInScope(scope, patchListener);
				return processResult(result, scope);
			} else if (!base || typeof base !== "object") {
				result = recipe(base);
				if (result === void 0) result = base;
				if (result === NOTHING) result = void 0;
				if (this.autoFreeze_) freeze(result, true);
				if (patchListener) {
					const p = [];
					const ip = [];
					getPlugin("Patches").generateReplacementPatches_(base, result, p, ip);
					patchListener(p, ip);
				}
				return result;
			} else die(1, base);
		};
		this.produceWithPatches = (base, recipe) => {
			if (typeof base === "function") return (state, ...args) => this.produceWithPatches(state, (draft) => base(draft, ...args));
			let patches, inversePatches;
			return [
				this.produce(base, recipe, (p, ip) => {
					patches = p;
					inversePatches = ip;
				}),
				patches,
				inversePatches
			];
		};
		if (typeof config?.autoFreeze === "boolean") this.setAutoFreeze(config.autoFreeze);
		if (typeof config?.useStrictShallowCopy === "boolean") this.setUseStrictShallowCopy(config.useStrictShallowCopy);
		if (typeof config?.useStrictIteration === "boolean") this.setUseStrictIteration(config.useStrictIteration);
	}
	createDraft(base) {
		if (!isDraftable(base)) die(8);
		if (isDraft(base)) base = current(base);
		const scope = enterScope(this);
		const proxy = createProxy(base, void 0);
		proxy[DRAFT_STATE].isManual_ = true;
		leaveScope(scope);
		return proxy;
	}
	finishDraft(draft, patchListener) {
		const state = draft && draft[DRAFT_STATE];
		if (!state || !state.isManual_) die(9);
		const { scope_: scope } = state;
		usePatchesInScope(scope, patchListener);
		return processResult(void 0, scope);
	}
	/**
	* Pass true to automatically freeze all copies created by Immer.
	*
	* By default, auto-freezing is enabled.
	*/
	setAutoFreeze(value) {
		this.autoFreeze_ = value;
	}
	/**
	* Pass true to enable strict shallow copy.
	*
	* By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
	*/
	setUseStrictShallowCopy(value) {
		this.useStrictShallowCopy_ = value;
	}
	/**
	* Pass false to use faster iteration that skips non-enumerable properties
	* but still handles symbols for compatibility.
	*
	* By default, strict iteration is enabled (includes all own properties).
	*/
	setUseStrictIteration(value) {
		this.useStrictIteration_ = value;
	}
	shouldUseStrictIteration() {
		return this.useStrictIteration_;
	}
	applyPatches(base, patches) {
		let i;
		for (i = patches.length - 1; i >= 0; i--) {
			const patch = patches[i];
			if (patch.path.length === 0 && patch.op === "replace") {
				base = patch.value;
				break;
			}
		}
		if (i > -1) patches = patches.slice(i + 1);
		const applyPatchesImpl = getPlugin("Patches").applyPatches_;
		if (isDraft(base)) return applyPatchesImpl(base, patches);
		return this.produce(base, (draft) => applyPatchesImpl(draft, patches));
	}
};
function createProxy(value, parent) {
	const draft = isMap(value) ? getPlugin("MapSet").proxyMap_(value, parent) : isSet(value) ? getPlugin("MapSet").proxySet_(value, parent) : createProxyProxy(value, parent);
	(parent ? parent.scope_ : getCurrentScope()).drafts_.push(draft);
	return draft;
}
function current(value) {
	if (!isDraft(value)) die(10, value);
	return currentImpl(value);
}
function currentImpl(value) {
	if (!isDraftable(value) || isFrozen(value)) return value;
	const state = value[DRAFT_STATE];
	let copy;
	let strict = true;
	if (state) {
		if (!state.modified_) return state.base_;
		state.finalized_ = true;
		copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
		strict = state.scope_.immer_.shouldUseStrictIteration();
	} else copy = shallowCopy(value, true);
	each(copy, (key, childValue) => {
		set$1(copy, key, currentImpl(childValue));
	}, strict);
	if (state) state.finalized_ = false;
	return copy;
}
var produce = new Immer2().produce;
//#endregion
//#region ../signals/dist/1_SignalCreator.js
var { get, set, isEqual } = import_lodash.default;
var ROOT_PATH = [];
/**
* Global dispatch for signal events. Used by Signal.memo() to track dependencies.
*/
var signalDispatch = new Subject();
/** One level deep, which is what immer's structural sharing already gives per branch. */
function shallowEqual(a, b) {
	if (Object.is(a, b)) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	for (const key of ka) if (!Object.is(a[key], b[key])) return false;
	return true;
}
/** The default distinction for a nested-path selector. */
var distinctShallow = () => distinctUntilChanged(shallowEqual);
var dependencyCollectors = [];
var emitDepth = 0;
var pendingFlush = /* @__PURE__ */ new Map();
function inEmitTurn(run) {
	emitDepth++;
	try {
		return run();
	} finally {
		emitDepth--;
		if (emitDepth === 0 && pendingFlush.size) {
			emitDepth++;
			try {
				while (pendingFlush.size) {
					let due;
					let lowest = Infinity;
					for (const [flush, rank] of pendingFlush) if (rank < lowest) {
						lowest = rank;
						due = flush;
					}
					pendingFlush.delete(due);
					due();
				}
			} finally {
				emitDepth--;
			}
		}
	}
}
var computingRanks = [];
/**
* Creates a signal tree with proxy-based nested access.
*
* @example
* ```ts
* const state = SignalCreator({ initialState: { user: { name: "chris" } } })
* state.user.name.$()        // "chris"
* state.user.name.$("new")   // set
* state.user.name.$.pipe()   // Observable
* ```
*/
function SignalCreator(options) {
	const { initialState, observable, event = false, read, write, createBase } = options;
	const state$ = event || observable && initialState === void 0 ? new Subject() : new BehaviorSubject(initialState);
	let latest = initialState;
	const pushState = (next, from = ROOT_PATH) => {
		latest = next;
		write?.(next);
		if (LOG.on) LOG.emit(CAT_EMIT, "emit {path}", {
			path: from,
			observerCount: state$.observers.length
		});
		inEmitTurn(() => state$.next(next));
	};
	const root$ = !observable ? state$ : merge(state$, observable.pipe(tap({ next: (next) => {
		latest = next;
	} }))).pipe(shareReplay({
		refCount: true,
		bufferSize: 1
	}));
	const activeSubs = [];
	const createProxy = (_path, base) => {
		const path = _path.filter((i) => typeof i === "string");
		const depth = path.length;
		const setterImmer = (recipe) => {
			const curr = get(latest, path);
			if (isDraftable(curr)) {
				const next = produce(curr, recipe);
				return setter(next);
			}
		};
		const applySet = (n) => {
			if (!depth) return pushState(n, path);
			const next = produce(latest || {}, (draft) => {
				set(draft, path, n);
			});
			return pushState(next, path);
		};
		const setter = (n) => {
			if (!LOG.on) return applySet(n);
			const started = performance.now();
			const hasSubscribers = state$.observers.length > 0 || activeSubs.length > 0;
			const result = applySet(n);
			LOG.emit(CAT_WRITE, "write {path}", {
				path,
				depth,
				hasSubscribers,
				durationMs: performance.now() - started
			});
			return result;
		};
		const getter = () => {
			const root = read ? read() : latest;
			if (!depth) return root;
			const val = get(root, path);
			if (typeof val === "function") {
				const context = depth === 1 ? root : get(root, path.slice(0, -1));
				if (Array.isArray(context)) return ((...args) => {
					let toReturn = void 0;
					const next = produce(context, (draft) => {
						toReturn = draft[path[path.length - 1]](...args);
					});
					if (!isEqual(next, context)) (depth > 1 ? get(rootProxy, path.slice(0, -1)) : rootProxy).$.next(next);
					return toReturn;
				});
				return val.bind(context);
			}
			return val;
		};
		const selfFnName = path.join("/") || "root";
		const selfFn = { [selfFnName]: (...args) => {
			if (args.length) {
				setter(args[0]);
				signalDispatch.next({
					type: "set",
					value: {
						signal: proxy,
						path,
						value: args[0]
					}
				});
				return proxy;
			}
			signalDispatch.next({
				type: "get",
				value: {
					signal: proxy,
					path
				}
			});
			if (!event) dependencyCollectors.at(-1)?.(proxy);
			return getter();
		} }[selfFnName];
		let ID = "";
		const $proxy = new Proxy(selfFn, {
			get(target, p) {
				if (p === "value") return getter();
				if (p === "next") return setter;
				if (p === "setImmer") return setterImmer;
				if (p === "path") return path;
				if (p === "pipe$") return (...operators) => {
					return SignalCreator({
						observable: $proxy.pipe(...operators),
						distinct: options.distinct
					});
				};
				if (p === "$") return signalDispatch.pipe(filter((i) => i.value.signal === proxy));
				if (p in target) return target[p];
				if (p in root$) {
					let autoSelector$ = root$;
					if (depth) {
						if (LOG.on) LOG.emit(CAT_SELECTOR, "selector {path} {reason}", {
							path,
							reason: "create"
						});
						const distinct = options.distinct === void 0 ? distinctShallow() : options.distinct;
						autoSelector$ = root$.pipe(map((i) => get(i, path)), distinct === null ? identity : distinct, tap({
							subscribe: () => {
								if (LOG.on) LOG.emit(CAT_SELECTOR, "selector {path} {reason}", {
									path,
									reason: "resubscribe"
								});
								if (!activeSubs.includes(proxy)) activeSubs.push(proxy);
							},
							finalize: () => {
								const idx = activeSubs.indexOf(proxy);
								if (idx >= 0) activeSubs.splice(idx, 1);
							}
						}), shareReplay({
							refCount: true,
							bufferSize: 1
						}));
					}
					let it = autoSelector$[p];
					if (typeof it === "function") it = it.bind(autoSelector$);
					return target[p] ??= it;
				}
				if (p === "id") return target[p] ??= (setId) => {
					if (setId) {
						ID = setId;
						return proxy;
					}
					return ID;
				};
				if (p === "use") return target[p];
			},
			apply(_target, _thisArg, args) {
				return selfFn(...args);
			}
		});
		const self = {
			$: $proxy,
			...base && { $field: base }
		};
		const proxy = new Proxy(self, { get(target, p) {
			if (p in target) return target[p];
			if (typeof p === "symbol") return target[p];
			return target[p] ??= createProxy([...path, p], createBase?.(rootProxy, [...path, p]));
		} });
		return proxy;
	};
	const rootProxy = createProxy([], createBase?.(void 0, []));
	return rootProxy;
}
/**
* Creates the Observable + synchronous reader used by Signal(fn).
*
* A computation discovers dependencies from synchronous signal `get` events.
* Dependencies are replaced after every run, so conditional branches behave
* like Solid's createMemo rather than a static combineLatest. The computation
* is lazy, shared across readers, and keeps its last successful value when a
* transient computation throws.
*/
var computedSeq = 0;
function isStream(value) {
	if (value === null || value === void 0) return false;
	if (isObservable(value)) return true;
	if (typeof value !== "object" && typeof value !== "function") return false;
	if (typeof value.then === "function") return true;
	return Symbol.asyncIterator in value;
}
/**
* The body receives the current value as `prev`. A stream result feeds the value one emission at a
* time: a dependency change cancels it and reruns (switch), completion after at least one emission
* reruns (expand), completion with none settles until a dependency changes.
*/
function createComputedSignal(compute, seed, options = {}) {
	const id = `memo#${++computedSeq}`;
	let dirty = true;
	let hasValue = arguments.length >= 2;
	let value = seed;
	let running = false;
	let rerun = false;
	let streamed = false;
	let lastRunFailed = false;
	let subscriberCount = 0;
	let readPinned = false;
	let pushOwed = false;
	let rank = 0;
	let emitVersion = 0;
	const observers = /* @__PURE__ */ new Set();
	const dependencySubs = /* @__PURE__ */ new Map();
	let inner;
	let token = {};
	const clearDependencies = () => {
		for (const [dependency, sub] of dependencySubs) {
			sub.unsubscribe();
			if (LOG.on) LOG.emit(CAT_UNSUBSCRIBE, "unsubscribe {id} {path}", {
				id,
				path: dependency.$.path
			});
		}
		dependencySubs.clear();
	};
	const cancelInner = () => {
		token = {};
		inner?.unsubscribe();
		inner = void 0;
	};
	const emit = (next) => {
		emitVersion++;
		for (const observer of [...observers]) observer.next(next);
	};
	const syncDependencies = (deps) => {
		let added = 0;
		let removed = 0;
		for (const [dependency, sub] of dependencySubs) {
			if (deps.has(dependency)) continue;
			sub.unsubscribe();
			dependencySubs.delete(dependency);
			removed++;
			if (LOG.on) LOG.emit(CAT_UNSUBSCRIBE, "unsubscribe {id} {path}", {
				id,
				path: dependency.$.path
			});
		}
		for (const dependency of deps) {
			if (dependencySubs.has(dependency)) continue;
			let initializing = true;
			const sub = dependency.$.subscribe(() => {
				if (!initializing) invalidate(dependency);
			});
			initializing = false;
			dependencySubs.set(dependency, sub);
			added++;
			if (LOG.on) LOG.emit(CAT_SUBSCRIBE, "subscribe {id} {path}", {
				id,
				path: dependency.$.path
			});
		}
		return {
			added,
			removed
		};
	};
	const recompute = (trigger) => {
		if (running) return value;
		running = true;
		do {
			rerun = false;
			cancelInner();
			const started = LOG.on ? performance.now() : 0;
			const dependencies = /* @__PURE__ */ new Set();
			dependencyCollectors.push((dependency) => dependencies.add(dependency));
			computingRanks.push(0);
			const report = (diff) => {
				if (!LOG.on) return;
				LOG.emit(CAT_COMPUTE, "compute {id} {durationMs}ms", {
					id,
					durationMs: performance.now() - started,
					depCount: dependencies.size,
					depsAdded: diff.added,
					depsRemoved: diff.removed,
					trigger
				});
			};
			let out;
			try {
				out = compute(value);
			} catch (error) {
				dependencyCollectors.pop();
				rank = computingRanks.pop();
				running = false;
				dirty = true;
				lastRunFailed = true;
				report(syncDependencies(dependencies));
				if (hasValue) return value;
				throw error;
			}
			dependencyCollectors.pop();
			rank = computingRanks.pop();
			dirty = false;
			lastRunFailed = false;
			report(syncDependencies(dependencies));
			streamed = isStream(out);
			if (!streamed) {
				value = out;
				hasValue = true;
				break;
			}
			const mine = token = {};
			let emitted = false;
			const sub = from(out).subscribe({
				next: (next) => {
					emitted = true;
					value = next;
					hasValue = true;
					emit(next);
				},
				error: (error) => {
					for (const observer of [...observers]) observer.error(error);
				},
				complete: () => {
					if (token !== mine || !emitted) return;
					inner = void 0;
					if (running) rerun = true;
					else invalidate();
				}
			});
			if (token === mine && !sub.closed) inner = sub;
		} while (rerun);
		running = false;
		return value;
	};
	const invalidate = (by) => {
		dirty = true;
		const eager = !!subscriberCount && !running;
		if (LOG.on) LOG.emit(CAT_INVALIDATE, "invalidate {id} by {by}", {
			id,
			by: by ? by.$.path : null,
			eager
		});
		if (!eager) return;
		pushOwed = true;
		if (emitDepth > 0) {
			pendingFlush.set(flush, rank);
			return;
		}
		inEmitTurn(flush);
	};
	const flush = () => {
		if (!dirty && !pushOwed) return;
		pushOwed = false;
		const before = emitVersion;
		const next = dirty ? recompute("invalidate") : value;
		if (!lastRunFailed && !streamed && before === emitVersion) emit(next);
	};
	const readMemo = () => {
		if (!subscriberCount) readPinned = true;
		const result = dirty || !hasValue ? recompute("read") : value;
		const frame = computingRanks.length - 1;
		if (frame >= 0) computingRanks[frame] = Math.max(computingRanks[frame], rank + 1);
		return result;
	};
	return SignalCreator({
		observable: new Observable((subscriber) => {
			subscriberCount++;
			readPinned = false;
			observers.add(subscriber);
			try {
				const before = emitVersion;
				const next = dirty || !hasValue ? recompute("read") : value;
				if (before === emitVersion) subscriber.next(next);
			} catch (error) {
				observers.delete(subscriber);
				subscriberCount--;
				subscriber.error(error);
				return;
			}
			return () => {
				observers.delete(subscriber);
				subscriberCount--;
				if (!subscriberCount && !readPinned) {
					cancelInner();
					clearDependencies();
					dirty = true;
				}
			};
		}),
		read: readMemo,
		write: options.writable !== false ? (next) => {
			value = next;
			hasValue = true;
		} : void 0
	});
}
//#endregion
//#region ../signals/dist/2_Signal.js
function isSignal(value) {
	if (!value || typeof value !== "object") return false;
	const accessor = value.$;
	return typeof accessor === "function" && typeof accessor.subscribe === "function";
}
function Signal(obs_or_state, defaults, options) {
	if (arguments.length === 0) return SignalCreator({ event: true });
	if (isObservable(obs_or_state)) return SignalCreator({
		initialState: defaults,
		observable: obs_or_state
	});
	if (typeof obs_or_state === "function") {
		if (obs_or_state.length >= 1) return createComputedSignal(obs_or_state, defaults, options);
		return createComputedSignal(obs_or_state);
	}
	return SignalCreator({ initialState: obs_or_state });
}
//#endregion
//#region ../signals/dist/6_Storage.js
function storageSignal(backend, fallback, options = {}) {
	const serialize = options.serialize ?? JSON.stringify;
	const parse = options.parse ?? JSON.parse;
	const decode = (raw) => {
		if (raw == null || raw === "") return fallback;
		try {
			return parse(raw);
		} catch {
			return fallback;
		}
	};
	let seed = fallback;
	backend.read.subscribe((raw) => {
		seed = decode(raw);
	}).unsubscribe();
	const signal = Signal(seed);
	const writes = signal.$.subscribe((value) => backend.write.next(serialize(value)));
	const reads = backend.read.subscribe((raw) => {
		const next = decode(raw);
		if (next !== signal.$()) signal.$(next);
	});
	signal.close = () => {
		writes.unsubscribe();
		reads.unsubscribe();
	};
	return signal;
}
function readOn(events, read, accept = () => true) {
	return merge(of(null), ...events.map((name) => fromEvent(window, name).pipe(filter(accept)))).pipe(map(read));
}
function urlAdapter(key) {
	return {
		read: readOn(["popstate"], () => new URLSearchParams(location.search).get(key) ?? ""),
		write: {
			next: (value) => {
				const params = new URLSearchParams(location.search);
				if (value === "") params.delete(key);
				else params.set(key, value);
				history.replaceState(null, "", `${location.pathname}?${params.toString()}${location.hash}`);
			},
			error() {},
			complete() {}
		}
	};
}
//#endregion
//#region ../signals/dist/10_slice.js
function createSlice(config) {
	const state = config.state ?? Signal(config.initial);
	const bus = new Subject();
	const actions$ = bus.pipe(observeOn(queueScheduler), share());
	const dispatch = (action) => {
		const prev = state.$();
		const next = config.reduce(prev, action);
		if (next !== prev) state.$(next);
		bus.next(action);
	};
	const ctx = config.ctx;
	return {
		state,
		actions$,
		dispatch,
		epics$: runEpics(actions$, state, ctx, config.epics ?? [], dispatch)
	};
}
function runEpics(actions$, state, ctx, epics, dispatch) {
	return defer(() => merge(...epics.map((epic) => epic(actions$, state, ctx)))).pipe(tap((action) => dispatch(action)), ignoreElements(), share());
}
//#endregion
//#region src/11_detail.ts
var DETAIL_PREFIX = "\0d:";
var isDetailKey = (key) => key.startsWith(DETAIL_PREFIX);
var detailKeyFor = (row) => DETAIL_PREFIX + row;
/** Not a detail key means the caller already holds the row, so it answers itself. */
var rowOfDetailKey = (key) => isDetailKey(key) ? key.slice(DETAIL_PREFIX.length) : key;
/** One node per open row, inserted right after it in its sibling list. @feature row.detail */
function withDetail(axis, open, make) {
	const panels = /* @__PURE__ */ new Map();
	for (const row of Object.keys(open)) {
		if (open[row] === void 0) continue;
		const key = row;
		if (!axis.by.has(key) || axis.by.has(detailKeyFor(row))) continue;
		const value = make(row);
		if (value === void 0) continue;
		panels.set(key, value);
	}
	if (panels.size === 0) return axis;
	const rows = panels;
	const insert = (list) => {
		const out = [];
		let touched = false;
		for (const key of list) {
			out.push(key);
			if (!rows.has(key)) continue;
			out.push(detailKeyFor(key));
			touched = true;
		}
		return touched ? out : list;
	};
	const by = new Map(axis.by);
	const parent = new Map(axis.parent);
	const children = new Map(axis.children);
	for (const [key, value] of panels) {
		const detail = detailKeyFor(key);
		by.set(detail, value);
		const up = axis.parent.get(key);
		if (up !== void 0) parent.set(detail, up);
	}
	for (const [key, kids] of axis.children) {
		const next = insert(kids);
		if (next !== kids) children.set(key, next);
	}
	return {
		roots: insert(axis.roots),
		children,
		parent,
		by
	};
}
//#endregion
//#region src/5_columns.ts
/** Default ids, one namespace so a data column called `check` still keeps its own seat. */
var BUILT_IN_IDS = Object.freeze({
	check: "__check",
	radio: "__radio",
	expand: "__expand",
	drag: "__drag",
	detail: "__detail",
	rowNumber: "__rowNumber"
});
var BUILT_IN_ID_SET = new Set(Object.values(BUILT_IN_IDS));
/** By the discriminator first, because `opts.id` may rename any of them. */
var isBuiltIn = (col) => typeof col.builtIn === "string" || BUILT_IN_ID_SET.has(col.id);
var rowSelectionMode = (columns) => columns.some((it) => isBuiltIn(it) && it.builtIn === "radio") ? "single" : "multi";
/** An empty list is `none`: nothing is selected, and there is nothing to select. */
function selectAllState(rows, selection) {
	let on = 0;
	for (const row of rows) if (selection[row] === true) on++;
	if (on === 0) return "none";
	return on === rows.length ? "all" : "some";
}
/** All means clear, anything else means fill. A row outside `rows` keeps whatever flag it had. */
function toggleSelectAll(rows, selection) {
	const next = { ...selection };
	const fill = selectAllState(rows, selection) !== "all";
	for (const row of rows) next[row] = fill;
	return next;
}
/** The mirror over the rows that have children. A forest with no branch is `none`. */
function expandAllState(rows, expanded) {
	let open = 0;
	for (const row of rows) if (expanded[row] === true) open++;
	if (open === 0) return "none";
	return open === rows.length ? "all" : "some";
}
function toggleExpandAll(rows, expanded) {
	const next = { ...expanded };
	const open = expandAllState(rows, expanded) !== "all";
	for (const row of rows) next[row] = open;
	return next;
}
/** What select-all is about: the visible rows that are rows. A group heading and a detail panel are
* not selectable, so counting them would leave the toggle stuck on `some`. */
var selectableRows = (flat) => flat.map((it) => it.key).filter((it) => !isGroupKey(it) && !isDetailKey(it));
/** What expand-all is about: every row with children, open or closed. Read off the axis rather than
* the flat list, because a collapsed parent hides the branches under it from that list. */
var expandableRows = (axis) => {
	const out = [];
	for (const [key, kids] of axis.children) if (kids.length > 0) out.push(key);
	return out;
};
Object.freeze({
	none: "□",
	some: "▣",
	all: "☑"
});
Object.freeze({
	none: "▶",
	some: "▽",
	all: "▼"
});
var active = {
	move$: defer(() => fromEvent(window, "pointermove")),
	up$: defer(() => merge(fromEvent(window, "pointerup"), fromEvent(window, "pointercancel")))
};
/** Reads `active` per subscription, so a swap made after an epic was built still takes effect. */
var LIVE_DRAG = {
	move$: defer(() => active.move$),
	up$: defer(() => active.up$)
};
function drag(down$, spec, streams = LIVE_DRAG) {
	const commit = spec.commit;
	return down$.pipe(map((down) => spec.from(down)), filter((start) => start !== null), switchMap((start) => {
		const up$ = streams.up$.pipe(take(1), share());
		return merge(streams.move$.pipe(takeUntil(up$), map((it) => spec.move(start, it))), up$.pipe(map((it) => commit === void 0 ? null : commit(start, it))));
	}), filter((action) => action !== null));
}
function landingIndex(order, from, delta, sizeOf) {
	let index = from;
	let travelled = 0;
	const step = delta > 0 ? 1 : -1;
	const distance = Math.abs(delta);
	while (index + step >= 0 && index + step < order.length) {
		const key = order[index + step];
		if (key === void 0) break;
		const size = sizeOf(key);
		if (travelled + size / 2 > distance) break;
		travelled += size;
		index += step;
	}
	return index;
}
//#endregion
//#region src/12_transpose.ts
/**
* The only statement in the package that knows what a transpose is. Every other decision is an
* index read off this table, which is why no `if` on orientation exists anywhere: a third
* orientation would be a third row here and no other edit.
*/
var SEATS = {
	rows: [0, 1],
	columns: [1, 0]
};
/** Picks the seat standing on the y dimension. The vertical run is the one that scrolls and pages. */
var verticalOf = (pair, orientation) => pair[SEATS[orientation][0]];
/** Picks the other seat. Always the complement, so the two can never name the same axis. */
var horizontalOf = (pair, orientation) => pair[SEATS[orientation][1]];
var verticalFacet = (pair, orientation) => verticalOf(pair, orientation)();
var horizontalFacet = (pair, orientation) => horizontalOf(pair, orientation)();
/**
* List view is the degenerate transpose: the horizontal axis keeps one entry, so every vertical
* entry renders as a single cell. Same lever one notch further, not a second rendering mode.
*
* The survivor is the first leaf. A header group is a band over its leaves, and a band of one leaf
* is the leaf, so keeping the group node instead would leave a run whose only entry has no cell.
*/
function collapseToOneEntry(nodes, on) {
	if (!on) return nodes;
	const first = nodes.find((it) => !it.hasChildren);
	if (first === void 0) return [];
	return [{
		key: first.key,
		depth: 0,
		index: 0,
		parent: null,
		hasChildren: false
	}];
}
var NO_SPANS = /* @__PURE__ */ new Map();
var NO_COVER = /* @__PURE__ */ new Set();
var countOf = (value) => Math.max(1, Math.trunc(value ?? 1));
/**
* The boundary, crossed once. A `ColumnDef.span` speaks rows and columns because that is what a
* table config has always spelled; the seating chart turns the pair into a neutral one and the
* kernel never sees the conventional names again.
*/
function neutralSpan(span, orientation) {
	const seats = [countOf(span.rows), countOf(span.cols)];
	return {
		vertical: verticalOf(seats, orientation),
		horizontal: horizontalOf(seats, orientation)
	};
}
/** The same crossing for the address. `cellId` is already a tuple, so only the seat order moves. */
function neutralCell(row, col, orientation) {
	const seats = [row, col];
	return cellId(verticalOf(seats, orientation), horizontalOf(seats, orientation));
}
/**
* The crossing read back the other way, for a renderer holding a vertical and a horizontal key and
* needing the row and the column behind them.
*
* The same body as `neutralCell` because the map is an involution: seat 0 is the row axis, and
* asking the seat table which seat stands vertical returns the pair to conventional order exactly
* as sending it the other way took it out of one.
*/
function conventionalParts(vertical, horizontal, orientation) {
	const seats = [vertical, horizontal];
	return [verticalOf(seats, orientation), horizontalOf(seats, orientation)];
}
/** `conventionalParts` with both lookups attached, so the key that addresses the data is chosen by
* the seat table once rather than once per caller. A second copy is a second code path. */
function addressedEntry(vertical, horizontal, orientation, defs, by) {
	const [row, col] = conventionalParts(vertical, horizontal, orientation);
	return {
		row,
		col,
		def: col === "" ? void 0 : defs.get(col),
		data: row === "" ? void 0 : by.get(row)
	};
}
/**
* Every cell a span reaches that is not the anchor itself. A covered cell renders nothing: the
* neighbour already occupies the space, and two elements in one seat is how a spanning grid tears.
*
* Both key lists arrive in run order, because a span reaches the next entries along each dimension
* and "next" is only defined by that order. Nothing here knows which list holds rows.
*/
function coveredBy(spans, vertical, horizontal) {
	if (spans.size === 0) return NO_COVER;
	const verticalAt = new Map(vertical.map((key, index) => [key, index]));
	const horizontalAt = new Map(horizontal.map((key, index) => [key, index]));
	const covered = /* @__PURE__ */ new Set();
	for (const [anchor, extent] of spans) {
		const parts = cellParts(anchor);
		const fromVertical = verticalAt.get(parts[0]);
		const fromHorizontal = horizontalAt.get(parts[1]);
		if (fromVertical === void 0 || fromHorizontal === void 0) continue;
		for (let stepVertical = 0; stepVertical < extent.vertical; stepVertical++) for (let stepHorizontal = 0; stepHorizontal < extent.horizontal; stepHorizontal++) {
			if (stepVertical === 0 && stepHorizontal === 0) continue;
			const overVertical = vertical[fromVertical + stepVertical];
			const overHorizontal = horizontal[fromHorizontal + stepHorizontal];
			if (overVertical === void 0 || overHorizontal === void 0) continue;
			covered.add(cellId(overVertical, overHorizontal));
		}
	}
	return covered;
}
//#endregion
//#region src/15_selection.ts
var EMPTY_BLOCKS = [];
var EMPTY_RANGE = {
	anchor: null,
	head: null,
	mode: "cell",
	blocks: EMPTY_BLOCKS
};
/** A header names a horizontal entry only, and `rectOf` reads no vertical half for that mode. */
var columnAnchor = (horizontal) => cellId("", horizontal);
/** Widens the narrow `{ anchor, head }` the state declares until the `0_types.ts` patch lands. */
/** A rectangular range over two ordered axes, with edges for the border. @feature cell.select */
function rangeOf(value) {
	const wide = value;
	if (wide.mode !== void 0 && wide.blocks !== void 0) return wide;
	return {
		anchor: value.anchor,
		head: value.head,
		mode: "cell",
		blocks: EMPTY_BLOCKS
	};
}
/** The pair being dragged. Opened and never extended is one cell, never empty. */
function liveBlock(range) {
	const anchor = range.anchor;
	if (anchor === null) return null;
	return {
		anchor,
		head: range.head ?? anchor,
		mode: range.mode
	};
}
/** Everything the range covers: the live pair first, then what earlier gestures committed. */
function blocksOf(range) {
	const live = liveBlock(range);
	if (live === null) return range.blocks;
	return range.blocks.length === 0 ? [live] : [live, ...range.blocks];
}
var isRangeEmpty = (range) => range.anchor === null && range.blocks.length === 0;
var ordered = (first, second) => first <= second ? [first, second] : [second, first];
/** Null covers nothing. Only the dimensions the mode uses are looked up, so a row block needs no column. */
function boundsOf(block, verticalAt, verticalCount, horizontalAt, horizontalCount) {
	const from = cellParts(block.anchor);
	const to = cellParts(block.head);
	let fromVertical = 0;
	let toVertical = verticalCount - 1;
	if (block.mode !== "column") {
		const span = ordered(verticalAt(from[0]), verticalAt(to[0]));
		if (span[0] === -1) return null;
		fromVertical = span[0];
		toVertical = span[1];
	}
	let fromHorizontal = 0;
	let toHorizontal = horizontalCount - 1;
	if (block.mode !== "row") {
		const span = ordered(horizontalAt(from[1]), horizontalAt(to[1]));
		if (span[0] === -1) return null;
		fromHorizontal = span[0];
		toHorizontal = span[1];
	}
	if (toVertical < fromVertical || toHorizontal < fromHorizontal) return null;
	return {
		fromVertical,
		toVertical,
		fromHorizontal,
		toHorizontal
	};
}
var indexIn = (order) => {
	const at = new Map(order.map((key, index) => [key, index]));
	return (key) => at.get(key) ?? -1;
};
/** Both axes indexed once, so a renderer pays two map lookups and one comparison per block per cell. */
function selectionTest(range, vertical, horizontal) {
	const blocks = blocksOf(range);
	if (blocks.length === 0) return () => false;
	const verticalAt = indexIn(vertical);
	const horizontalAt = indexIn(horizontal);
	const bounds = [];
	for (const block of blocks) {
		const extent = boundsOf(block, verticalAt, vertical.length, horizontalAt, horizontal.length);
		if (extent !== null) bounds.push(extent);
	}
	if (bounds.length === 0) return () => false;
	return (address) => {
		const parts = cellParts(address);
		const down = verticalAt(parts[0]);
		if (down === -1) return false;
		const across = horizontalAt(parts[1]);
		if (across === -1) return false;
		for (const extent of bounds) {
			if (down < extent.fromVertical || down > extent.toVertical) continue;
			if (across < extent.fromHorizontal || across > extent.toHorizontal) continue;
			return true;
		}
		return false;
	};
}
/** Additive keeps the earlier blocks. Anchor equal to head is one cell, never an empty range. */
function beginAt(range, cell, mode, additive) {
	return {
		anchor: cell,
		head: cell,
		mode,
		blocks: additive ? commitBlock(range).blocks : EMPTY_BLOCKS
	};
}
/** A range with no anchor takes the head as both, so an extend can open a block. */
function extendTo(range, head) {
	return range.anchor === null ? {
		...range,
		anchor: head,
		head
	} : {
		...range,
		head
	};
}
/** The pair stays live for a following shift-click and joins `blocks` for a following ctrl-drag. */
function commitBlock(range) {
	const live = liveBlock(range);
	if (live === null) return range;
	const kept = range.blocks.filter((it) => it.anchor !== live.anchor || it.mode !== live.mode);
	return {
		anchor: live.anchor,
		head: live.head,
		mode: live.mode,
		blocks: [...kept, live]
	};
}
/** Identity when there was nothing to clear, so a repeated Escape writes no new state. */
function clearSelection(range) {
	return isRangeEmpty(range) ? range : EMPTY_RANGE;
}
//#endregion
//#region src/7_epics.ts
var intents = (actions$, type) => actions$.pipe(filter((it) => it.phase === "intent" && it.type === type));
var emitted = () => filter((action) => action !== null);
var clamp = (value, low, high) => value < low ? low : value > high ? high : value;
var defOf = (ctx, col) => ctx.columns.$().find((it) => it.id === col);
var DEFAULT_DRAG_MODE = "preview";
/** One key of `GridState`, so the preview reaches the renderer the way every other change does. */
var shows = (preview) => ({
	phase: "change",
	type: "drag",
	drag: preview
});
var kept = (batch) => batch.filter((it) => it !== null);
var unrolled = (batches$) => batches$.pipe(concatMap((it) => it));
/** Which side of the landing entry the line sits on: past the origin it is the trailing edge. */
var dropSide = (from, to) => to > from ? "end" : "start";
/** Visible leaves in current order. Header group nodes carry no def, so they are not draggable. */
var colOrderOf = (ctx) => {
	const defs = new Set(ctx.columns.$().map((it) => it.id));
	return ctx.view.cols.$().map((it) => it.key).filter((key) => defs.has(key));
};
var cycle = (model, col, shift) => {
	const current = model.find((it) => it.field === col);
	const next = current === void 0 ? "asc" : current.sort === "asc" ? "desc" : null;
	if (!shift) return next === null ? [] : [{
		field: col,
		sort: next
	}];
	if (next === null) return model.filter((it) => it.field !== col);
	if (current === void 0) return [...model, {
		field: col,
		sort: next
	}];
	return model.map((it) => it.field === col ? {
		field: col,
		sort: next
	} : it);
};
function sortOnHeaderClick() {
	return (actions$, state, ctx) => intents(actions$, "header.click").pipe(map((it) => {
		if (defOf(ctx, it.col)?.sortable === false) return null;
		return {
			phase: "change",
			type: "sort",
			sort: cycle(state.sort.$(), it.col, it.mods.shift)
		};
	}), emitted());
}
function flipOpen(state, ctx, row, mods) {
	const open = state.expanded.$();
	const next = open[row] !== true;
	const expanded = {
		...open,
		[row]: next
	};
	if (mods.alt) for (const key of descendantsOf(ctx.view.sorted.$(), row)) expanded[key] = next;
	return {
		phase: "change",
		type: "expanded",
		expanded
	};
}
function expandOnExpanderClick() {
	return (actions$, state, ctx) => intents(actions$, "expander.click").pipe(map((it) => flipOpen(state, ctx, it.row, it.mods)));
}
var toggleOne = (current, row) => ({
	...current,
	[row]: current[row] !== true
});
function rowPicker(state, ctx, plain) {
	let anchor = null;
	return (pick) => {
		const current = state.rowSelection.$();
		const order = ctx.view.flat.$().map((it) => it.key);
		const from = anchor === null ? -1 : order.indexOf(anchor);
		const to = order.indexOf(pick.row);
		if (pick.mods.shift && from !== -1 && to !== -1) {
			const rowSelection = { ...current };
			for (let index = Math.min(from, to); index <= Math.max(from, to); index++) {
				const key = order[index];
				if (key !== void 0) rowSelection[key] = true;
			}
			return {
				phase: "change",
				type: "rowSelection",
				rowSelection
			};
		}
		anchor = pick.row;
		if (rowSelectionMode(ctx.columns.$()) === "single") return {
			phase: "change",
			type: "rowSelection",
			rowSelection: { [pick.row]: true }
		};
		return {
			phase: "change",
			type: "rowSelection",
			rowSelection: pick.mods.ctrl || pick.mods.meta ? toggleOne(current, pick.row) : plain(current, pick.row)
		};
	};
}
function selectRowsOnCheckboxClick() {
	return (actions$, state, ctx) => {
		const pick = rowPicker(state, ctx, toggleOne);
		return intents(actions$, "checkbox.click").pipe(map(pick));
	};
}
var headerOf = (ctx, col, kind) => {
	const def = defOf(ctx, col);
	return def !== void 0 && isBuiltIn(def) && def.builtIn === kind;
};
/** In `defaultEpics`: the header draws the tri-state whether or not this is installed, and
* installing it is what makes the header a control. @feature row.select */
function toggleSelectAllOnHeaderClick() {
	return (actions$, state, ctx) => intents(actions$, "header.click").pipe(filter((it) => headerOf(ctx, it.col, "check")), map(() => ({
		phase: "change",
		type: "rowSelection",
		rowSelection: toggleSelectAll(selectableRows(ctx.view.flat.$()), state.rowSelection.$())
	})));
}
/** The mirror on the expand column, reading the same rows `expandAllSignal` counts. */
function toggleExpandAllOnHeaderClick() {
	return (actions$, state, ctx) => intents(actions$, "header.click").pipe(filter((it) => headerOf(ctx, it.col, "expand")), map(() => ({
		phase: "change",
		type: "expanded",
		expanded: toggleExpandAll(expandableRows(ctx.view.sorted.$()), state.expanded.$())
	})));
}
/** The only way a consumer hears "the user picked this row". Modified clicks belong elsewhere. */
function activateOnCellClick() {
	return (actions$, _state, ctx) => intents(actions$, "cell.click").pipe(filter((it) => isPlainClick(it.mods)), map((it) => {
		const value = ctx.view.sorted.$().by.get(it.row);
		return value === void 0 ? null : {
			phase: "effect",
			type: "activate",
			row: it.row,
			col: it.col,
			value
		};
	}), emitted());
}
var DEFAULT_COL_WIDTH$1 = 100;
function resizeOnHeaderDrag(streams, mode = DEFAULT_DRAG_MODE) {
	return (actions$, state, ctx) => {
		const widthAt = (start, x) => clamp(start.width + (x - start.x), start.min, start.max);
		const sized = (start, width) => ({
			phase: "change",
			type: "colWidth",
			colWidth: {
				...state.colWidth.$(),
				[start.col]: width
			}
		});
		const guide = (start, width) => shows({
			kind: "colSize",
			col: start.col,
			width
		});
		return unrolled(drag(intents(actions$, "header.pointerdown").pipe(filter((it) => it.part === "resize")), {
			from: (down) => {
				const def = defOf(ctx, down.col);
				if (def?.resizable === false) return null;
				return {
					col: down.col,
					x: down.x,
					width: down.width || ctx.view.widths.$().get(down.col) || DEFAULT_COL_WIDTH$1,
					min: def?.minWidth ?? 0,
					max: def?.maxWidth ?? Infinity
				};
			},
			move: (start, e) => {
				const width = widthAt(start, e.clientX);
				return [mode === "live" ? sized(start, width) : guide(start, width)];
			},
			commit: (start, e) => {
				const width = widthAt(start, e.clientX);
				return mode === "live" ? [sized(start, width)] : [sized(start, width), shows(null)];
			}
		}, streams));
	};
}
var reinsert = (order, from, to) => {
	const next = [...order];
	const [moved] = next.splice(from, 1);
	if (moved === void 0) return order;
	next.splice(to, 0, moved);
	return next;
};
var same = (a, b) => a.length === b.length && a.every((key, index) => key === b[index]);
function moveColumnOnHeaderDrag(streams, mode = DEFAULT_DRAG_MODE) {
	return (actions$, state, ctx) => {
		const landingAt = (start, x) => {
			const widths = ctx.view.widths.$();
			return landingIndex(start.order, start.from, x - start.x, (key) => widths.get(key) ?? 0);
		};
		const ordered = (start, to) => {
			const colOrder = reinsert(start.order, start.from, to);
			return same(colOrder, state.colOrder.$()) ? null : {
				phase: "change",
				type: "colOrder",
				colOrder
			};
		};
		const guide = (start, to) => shows({
			kind: "colMove",
			col: start.col,
			over: start.order[to] ?? start.col,
			side: dropSide(start.from, to)
		});
		return unrolled(drag(intents(actions$, "header.pointerdown").pipe(filter((it) => it.part === "move")), {
			from: (down) => {
				const order = colOrderOf(ctx);
				const from = order.indexOf(down.col);
				return from === -1 ? null : {
					col: down.col,
					x: down.x,
					order,
					from
				};
			},
			move: (start, e) => {
				const to = landingAt(start, e.clientX);
				return mode === "live" ? kept([ordered(start, to)]) : [guide(start, to)];
			},
			commit: (start, e) => {
				const to = landingAt(start, e.clientX);
				return mode === "live" ? kept([ordered(start, to)]) : kept([ordered(start, to), shows(null)]);
			}
		}, streams));
	};
}
function moveRowOnRowDrag(streams) {
	return (actions$, _state, ctx) => unrolled(drag(intents(actions$, "row.pointerdown"), {
		from: (down) => {
			const order = ctx.view.flat.$().map((it) => it.key);
			const from = order.indexOf(down.row);
			return from === -1 ? null : {
				row: down.row,
				y: down.y,
				order,
				from
			};
		},
		move: (start, e) => {
			const to = landingIndex(start.order, start.from, e.clientY - start.y, ctx.rowHeight);
			return [shows({
				kind: "rowMove",
				row: start.row,
				over: start.order[to] ?? start.row,
				side: dropSide(start.from, to)
			})];
		},
		commit: (start, e) => {
			const to = landingIndex(start.order, start.from, e.clientY - start.y, ctx.rowHeight);
			const cleared = shows(null);
			if (to === start.from) return [cleared];
			const next = reinsert(start.order, start.from, to);
			return [{
				phase: "effect",
				type: "reorderRow",
				row: start.row,
				before: next[to + 1] ?? null
			}, cleared];
		}
	}, streams));
}
var firstCol = (ctx) => colOrderOf(ctx)[0];
function keyAction(intent, state, ctx) {
	const flat = ctx.view.flat.$();
	const focus = state.focus.$();
	const parts = focus === null ? null : cellParts(focus);
	const col = parts?.[1] ?? firstCol(ctx);
	if (col === void 0) return null;
	const at = parts === null ? -1 : flat.findIndex((it) => it.key === parts[0]);
	const node = at === -1 ? void 0 : flat[at];
	const step = (delta) => {
		const next = flat[clamp(at + delta, 0, flat.length - 1)];
		return next === void 0 ? null : {
			phase: "change",
			type: "focus",
			focus: cellId(next.key, col)
		};
	};
	const open = (row, value) => ({
		phase: "change",
		type: "expanded",
		expanded: {
			...state.expanded.$(),
			[row]: value
		}
	});
	switch (intent.key) {
		case "ArrowDown": return step(1);
		case "ArrowUp": return step(-1);
		case "ArrowRight": return node !== void 0 && node.hasChildren && state.expanded.$()[node.key] !== true ? open(node.key, true) : null;
		case "ArrowLeft":
			if (node === void 0) return null;
			if (node.hasChildren && state.expanded.$()[node.key] === true) return open(node.key, false);
			return node.parent === null ? null : {
				phase: "change",
				type: "focus",
				focus: cellId(node.parent, col)
			};
		case " ": {
			if (node === void 0) return null;
			const current = state.rowSelection.$();
			return {
				phase: "change",
				type: "rowSelection",
				rowSelection: {
					...current,
					[node.key]: current[node.key] !== true
				}
			};
		}
		case "Enter": {
			if (node === void 0) return null;
			const value = ctx.view.sorted.$().by.get(node.key);
			return value === void 0 ? null : {
				phase: "effect",
				type: "activate",
				row: node.key,
				col,
				value
			};
		}
		default: return null;
	}
}
function keyboardNav() {
	return (actions$, state, ctx) => intents(actions$, "key").pipe(map((it) => keyAction(it, state, ctx)), emitted());
}
function pageOnScrollNearEnd() {
	return (actions$, state, ctx) => intents(actions$, "viewport.scroll").pipe(map((it) => {
		const page = state.page.$();
		if (page.mode !== "infinite") return null;
		const size = Math.max(1, page.size);
		const loaded = (page.index + 1) * size;
		if (page.total !== null && loaded >= page.total) return null;
		const flat = ctx.view.flat.$();
		const last = flat[Math.min(loaded, flat.length) - 1];
		const height = ctx.rowHeight(last?.key ?? "");
		return it.top + ctx.viewport.$().height < (loaded - ctx.overscan) * height ? null : {
			phase: "change",
			type: "page",
			page: {
				...page,
				index: page.index + 1
			}
		};
	}), emitted());
}
/** The gutter this grid renders. A down here opens a row block, so the cell epic steps aside. */
var ROW_HEADER_KINDS = /* @__PURE__ */ new Set([
	"rowNumber",
	"check",
	"radio"
]);
var isRowHeader = (ctx, col) => {
	const def = defOf(ctx, col);
	return def !== void 0 && isBuiltIn(def) && ROW_HEADER_KINDS.has(def.builtIn);
};
var selectionChange = (range) => ({
	phase: "change",
	type: "selection",
	selection: range
});
/** Conventional going in, neutral coming out: a range is keyed by the two seats, never by name. */
var addressOf = (state, row, col) => neutralCell(row, col, state.orientation.$());
function rangeDrag(down$, open, actions$, state, streams) {
	let live = null;
	const addressFor = (down) => open.mods(down).button === 0 ? open.at(down) : null;
	const opened = (down) => {
		const address = addressFor(down);
		if (address === null) return null;
		const mods = open.mods(down);
		const current = rangeOf(state.selection.$());
		const next = mods.shift && current.anchor !== null && current.mode === open.mode ? extendTo(current, address) : beginAt(current, address, open.mode, mods.ctrl || mods.meta);
		live = next;
		return selectionChange(next);
	};
	const moved = (enter) => {
		const held = live;
		if (held === null) return null;
		const address = addressOf(state, enter.row, enter.col);
		if (address === held.head) return null;
		const next = extendTo(held, address);
		live = next;
		return selectionChange(next);
	};
	return merge(down$.pipe(map(opened), emitted()), intents(actions$, "cell.pointerenter").pipe(map(moved), emitted()), drag(down$, {
		from: (down) => addressFor(down) === null ? null : true,
		move: () => null,
		commit: () => {
			const held = live;
			live = null;
			return held === null ? null : selectionChange(commitBlock(held));
		}
	}, streams));
}
/** Escape clears whatever mode wrote the range, so it rides with the epic nobody drops. */
var clearOnEscape = (actions$, state) => intents(actions$, "key").pipe(filter((it) => it.key === "Escape"), map(() => {
	const current = rangeOf(state.selection.$());
	return isRangeEmpty(current) ? null : selectionChange(clearSelection(current));
}), emitted());
/** @feature cell.select */
function selectCellsOnDrag(streams) {
	return (actions$, state, ctx) => merge(rangeDrag(intents(actions$, "cell.pointerdown"), {
		at: (down) => isRowHeader(ctx, down.col) ? null : addressOf(state, down.row, down.col),
		mods: (down) => down.mods,
		mode: "cell"
	}, actions$, state, streams), clearOnEscape(actions$, state));
}
function selectRowsOnDrag(streams) {
	return (actions$, state, ctx) => rangeDrag(intents(actions$, "cell.pointerdown"), {
		at: (down) => isRowHeader(ctx, down.col) ? addressOf(state, down.row, down.col) : null,
		mods: (down) => down.mods,
		mode: "row"
	}, actions$, state, streams);
}
var opensColumnRange = (part) => part !== "move" && part !== "resize";
function selectColumnsOnDrag(streams, opensOn = opensColumnRange) {
	return (actions$, state) => rangeDrag(intents(actions$, "header.pointerdown").pipe(filter((it) => opensOn(it.part))), {
		at: (down) => columnAnchor(down.col),
		mods: (down) => down.mods,
		mode: "column"
	}, actions$, state, streams);
}
/** Every epic `grid()` installs. Each is exported alone so a consumer can drop one. */
function defaultEpics(streams, mode = DEFAULT_DRAG_MODE) {
	return [
		sortOnHeaderClick(),
		expandOnExpanderClick(),
		selectRowsOnCheckboxClick(),
		toggleSelectAllOnHeaderClick(),
		toggleExpandAllOnHeaderClick(),
		activateOnCellClick(),
		resizeOnHeaderDrag(streams, mode),
		moveColumnOnHeaderDrag(streams, mode),
		moveRowOnRowDrag(streams),
		keyboardNav(),
		pageOnScrollNearEnd(),
		selectCellsOnDrag(streams),
		selectRowsOnDrag(streams),
		selectColumnsOnDrag(streams)
	];
}
//#endregion
//#region src/18_bands.ts
/** One predicate under both seatings: the horizontal axis holds rows under the transpose, and a row
* carries no marker, so nothing below has to ask which axis it is looking at. */
var isHeaderGroup = (value) => typeof value === "object" && value !== null && value.band === true;
/** A band that forgot its marker takes a track and renders a cell in every entry while the track
* list counts leaves, so it is rejected beside the `field` and `value` check in `8_grid.ts`. */
function checkBands(columns) {
	const named = /* @__PURE__ */ new Set();
	for (const col of columns) if (col.group !== void 0) named.add(col.group);
	for (const col of columns) {
		if (!named.has(col.id) || isHeaderGroup(col)) continue;
		throw new Error(`signal-grid: column "${col.id}" is named as a header group and carries no band marker. Mint it with headerGroup({ id: "${col.id}" }).`);
	}
}
/** The band rows the header built. The sticky offsets under the header read it, because that height
* is the schema's band depth and no stylesheet selector can count elements. */
var SG_HEAD_ROWS = "--sg-head-rows";
/** The bands over one entry, outermost first. The marker filter decides the depth and
* `FlatNode.depth` never does, so a transposed tree of rows grows no header row. */
function bandAncestors(axis, key) {
	const out = [];
	for (const up of ancestorsOf(axis, key)) if (isHeaderGroup(axis.by.get(up))) out.push(up);
	return out.reverse();
}
/** One row per band level, plus the row the leaves sit on. Counted over the whole run rather than
* the window, so a horizontal scroll cannot change the header's height under the reader. */
function bandDepth(axis, leaves) {
	let deepest = 0;
	for (const leaf of leaves) deepest = Math.max(deepest, bandAncestors(axis, leaf).length);
	return deepest + 1;
}
/** Row `rows - 1` holds the leaves, each row above the band covering every leaf at that level and a
* filler where none does. Adjacent cells naming one key collapse into one span. @feature col.group */
function bandRow(axis, leaves, depth, rows) {
	const last = depth >= rows - 1;
	const out = [];
	for (const leaf of leaves) {
		const key = last ? leaf : bandAncestors(axis, leaf)[depth] ?? null;
		const held = out[out.length - 1];
		if (held !== void 0 && held.key === key) {
			out[out.length - 1] = {
				key,
				span: held.span + 1
			};
			continue;
		}
		out.push({
			key,
			span: 1
		});
	}
	return out;
}
//#endregion
//#region src/8_grid.ts
function toGridSignal(source, fallback) {
	if (isSignal(source)) return source;
	if (isObservable(source)) return Signal(source, fallback);
	if (typeof source === "function") return Signal(source);
	return Signal(source);
}
/** Mirrors `4_slice.ts`'s track default. Declared here so the sizing lane owns that file alone. */
var DEFAULT_COL_WIDTH = 100;
var DEFAULT_PAGE = {
	mode: "all",
	index: 0,
	size: 100,
	total: null
};
function defaultState(over = {}) {
	return {
		sort: [],
		group: [],
		expanded: {},
		rowSelection: {},
		rowPinning: {},
		rowHeight: {},
		rowOrder: [],
		detail: {},
		page: DEFAULT_PAGE,
		colOrder: [],
		colHidden: {},
		colWidth: {},
		colPinning: {},
		selection: EMPTY_RANGE,
		drag: null,
		focus: null,
		editing: null,
		density: "standard",
		listView: false,
		orientation: "rows",
		virtualize: {
			vertical: true,
			horizontal: false
		},
		...over
	};
}
/** Every key of `GridState`, read off the defaults so a new one joins the mirror by existing. */
var STATE_KEYS = Object.keys(defaultState());
/** The horizontal run is never the axis a pager retains, so its plan is handed the identity page. */
var NO_PAGE = {
	index: 0,
	size: 0
};
/** @feature-declared view.density */
var ROW_HEIGHT = {
	compact: 28,
	standard: 36,
	comfortable: 48
};
var byPhase = (actions$, phase) => actions$.pipe(filter((it) => it.phase === phase));
var reduce = (state, action) => action.phase === "change" ? {
	...state,
	[action.type]: action[action.type]
} : state;
/**
* The three retention rules of `PageMode` expressed as one `paginate` call, so paging runs inside
* `renderPlan` after pinning has already been lifted out. Paging before pinning drops pinned
* rows off the page they happen not to sit on, which defeats the point of pinning them.
* @feature page.infinite
*/
function pageWindow(page) {
	const size = Math.max(1, page.size);
	if (page.mode === "all") return {
		page: {
			index: 0,
			size
		},
		enabled: false
	};
	if (page.mode === "infinite") return {
		page: {
			index: 0,
			size: (page.index + 1) * size
		},
		enabled: true
	};
	return {
		page: {
			index: page.index,
			size
		},
		enabled: true
	};
}
function grid(config) {
	const mode = config.mode ?? "client";
	const id = toGridSignal(config.id, "grid");
	const rows = toGridSignal(config.rows, []);
	const columns = toGridSignal(config.columns, []);
	const rowCount = toGridSignal(config.rowCount ?? null, null);
	const viewport = toGridSignal(config.viewport ?? {
		top: 0,
		left: 0,
		width: 0,
		height: 0
	}, {
		top: 0,
		left: 0,
		width: 0,
		height: 0
	});
	for (const col of columns.$()) columnReader(col, col.id);
	checkBands(columns.$());
	const stateSource = config.state === void 0 ? void 0 : toGridSignal(config.state, {});
	const stateSeed = stateSource?.$();
	const seed = defaultState(stateSeed);
	const loggedId = id.$();
	const syncKey = config.sync === true ? id.$() : typeof config.sync === "string" ? config.sync : null;
	const synced = syncKey === null ? null : storageSignal(urlAdapter(syncKey), seed);
	const store = synced ?? Signal(seed);
	const opened = new Subscription();
	if (synced !== null) opened.add(() => synced.close());
	const epicCtx = {
		get view() {
			return view;
		},
		columns,
		viewport,
		rowHeight: (row) => state.rowHeight.$()[row] ?? ROW_HEIGHT[state.density.$()],
		overscan: config.overscan ?? 4
	};
	const slice = createSlice({
		initial: store.$(),
		state: store,
		reduce,
		epics: config.epics ?? defaultEpics(void 0, config.drag),
		ctx: epicCtx
	});
	const state = slice.state;
	const actions$ = slice.actions$;
	const dispatch = (action) => {
		if (!LOG$1.on || action.phase !== "intent") return slice.dispatch(action);
		const started = performance.now();
		slice.dispatch(action);
		LOG$1.emit(CAT_INTENT, "intent {type} {durationMs}ms", {
			id: loggedId,
			type: action.type,
			durationMs: performance.now() - started
		});
	};
	if (stateSource !== void 0) {
		const held = isSignal(config.state) ? config.state : void 0;
		let mirrored = state.$();
		const mirrorOut = () => {
			if (held === void 0) return;
			const before = mirrored;
			const next = state.$();
			mirrored = next;
			const outward = held.$();
			const outgoing = {};
			let moved = false;
			for (const key of STATE_KEYS) {
				if (!(key in outward) && Object.is(before[key], next[key])) continue;
				outgoing[key] = next[key];
				if (!Object.is(outward[key], next[key])) moved = true;
			}
			if (moved) held.$(outgoing);
		};
		let applying = false;
		if (held !== void 0) opened.add(state.$.subscribe(() => {
			if (!applying) mirrorOut();
		}));
		let consumed = stateSeed;
		opened.add(stateSource.$.subscribe((patch) => {
			if (patch === consumed) return;
			consumed = patch;
			const current = state.$();
			applying = true;
			try {
				for (const key of Object.keys(patch)) {
					const next = patch[key];
					if (next === void 0 || Object.is(current[key], next)) continue;
					dispatch({
						phase: "change",
						type: key,
						[key]: next
					});
				}
			} finally {
				applying = false;
			}
			mirrorOut();
		}));
	}
	const byId = Signal(() => new Map(columns.$().map((it) => [it.id, it])));
	const readerFor = (cols, field) => columnReader(cols.get(field), field);
	const base = Signal(() => {
		const data = rows.$();
		return config.subRows ? axisOfTree(data, config.rowId, config.subRows) : axisOfEntries(data.map((row) => [config.rowId(row), row]));
	});
	const groupValue = (path, key) => ({
		["g:"]: key,
		path
	});
	const grouped = Signal(() => {
		const axis = base.$();
		if (mode === "server") return axis;
		const keys = state.group.$();
		if (!keys.length) return axis;
		const cols = byId.$();
		const readers = keys.map((field) => readerFor(cols, field));
		if (!LOG$1.on) return groupAxis(axis, readers, groupValue);
		const started = performance.now();
		const built = groupAxis(axis, readers, groupValue);
		LOG$1.emit(CAT_GROUP, "group {id} {durationMs}ms", {
			id: loggedId,
			levels: keys.length,
			count: built.by.size,
			durationMs: performance.now() - started
		});
		return built;
	});
	const NO_MODEL = () => [];
	const rowModel = () => state.sort.$();
	const sorted = Signal(() => sortBody(grouped.$(), verticalOf([rowModel, NO_MODEL], state.orientation.$())(), columns.$()));
	function sortBody(axis, model, defs) {
		if (mode === "server") return axis;
		if (!LOG$1.on) return sortOnce(axis, model, defs);
		const started = performance.now();
		const built = sortOnce(axis, model, defs);
		LOG$1.emit(CAT_SORT, "sort {id} {durationMs}ms", {
			id: loggedId,
			keys: model.length,
			count: built.by.size,
			durationMs: performance.now() - started
		});
		return built;
	}
	function sortOnce(axis, model, defs) {
		const cols = new Map(defs.map((it) => [it.id, it]));
		const readers = new Map(model.map((item) => [item.field, readerFor(cols, item.field)]));
		return sortAxis(axis, buildComparator(model, defs, (row, field) => (readers.get(field) ?? readerFor(cols, field))(row)));
	}
	const detailed = Signal(() => {
		const axis = sorted.$();
		return withDetail(axis, state.detail.$(), (row) => axis.by.get(row));
	});
	const flat = Signal(() => {
		const open = state.expanded.$();
		const axis = detailed.$();
		const isOpen = (key) => open[key] === true;
		if (!LOG$1.on) return flattenAxis(axis, isOpen);
		const started = performance.now();
		const built = flattenAxis(axis, isOpen);
		LOG$1.emit(CAT_FLATTEN, "flatten {id} {durationMs}ms", {
			id: loggedId,
			count: built.length,
			durationMs: performance.now() - started
		});
		return built;
	});
	const NO_ORDER = () => null;
	/**
	* The ordering the column axis takes when it is the vertical one. Each sort item carries a bare
	* column of its own, because the values on this axis are the schema, so there is no second
	* schema to look the field up in.
	*/
	const colOrdering = () => {
		if (mode === "server") return null;
		const model = state.sort.$();
		return buildComparator(model, model.map((it) => ({ id: it.field })), (def, field) => def[field]);
	};
	/**
	* The column axis: hidden columns dropped, `colOrder` applied, header groups turned into parent
	* edges. Then the same vertical ordering `sorted` runs, because a sort item names a field and
	* each axis reads that field off its own values: a row object when rows stand vertical, a
	* `ColumnDef` when columns do. The seat table decides which of the two ever sees the model.
	* @feature col.visible
	*/
	const colAxis = Signal(() => {
		const defs = columns.$();
		const hidden = state.colHidden.$();
		const order = state.colOrder.$();
		const visible = defs.filter((it) => hidden[it.id] !== true);
		const rank = new Map(order.map((key, index) => [key, index]));
		return sortAxis(axisOfEntries([...visible].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)).map((it) => [it.id, it]), (_key, value) => value.group), verticalOf([NO_ORDER, colOrdering], state.orientation.$())());
	});
	const colNodes = Signal(() => flattenAxis(colAxis.$(), () => true));
	const seats = [() => ({
		axis: detailed.$(),
		nodes: flat.$(),
		pinning: state.rowPinning.$(),
		extent: state.rowHeight.$()
	}), () => ({
		axis: colAxis.$(),
		nodes: colNodes.$(),
		pinning: state.colPinning.$(),
		extent: state.colWidth.$()
	})];
	const vertical = Signal(() => verticalFacet(seats, state.orientation.$()));
	const horizontal = Signal(() => horizontalFacet(seats, state.orientation.$()));
	const verticalLeaves = Signal(() => {
		const seat = vertical.$();
		return seat.nodes.filter((it) => !isHeaderGroup(seat.axis.by.get(it.key))).map((it) => it.key);
	});
	const planBase$ = Signal(() => {
		const started = LOG$1.on ? performance.now() : 0;
		const seat = vertical.$();
		const fallback = ROW_HEIGHT[state.density.$()];
		const args = pageWindow(state.page.$());
		const input = {
			flat: verticalLeaves.$(),
			side: (key) => seat.pinning[key],
			page: args.page,
			paginate: mode === "client" && args.enabled,
			sizer: (keys) => sizerFor(keys, (it) => seat.extent[it], fallback)
		};
		if (!LOG$1.on) return planBase(input);
		const built = planBase(input);
		LOG$1.emit(CAT_BASE, "base {id} {durationMs}ms", {
			id: loggedId,
			count: input.flat.length,
			durationMs: performance.now() - started
		});
		return built;
	});
	const plan = Signal(() => {
		const base = planBase$.$();
		const start = viewport.top.$();
		const extent = viewport.height.$();
		const window = {
			virtualize: state.virtualize.vertical.$(),
			viewport: {
				start,
				extent
			},
			overscan: config.overscan ?? 4
		};
		if (!LOG$1.on) return planWindow(base, window);
		const started = performance.now();
		const built = planWindow(base, window);
		LOG$1.emit(CAT_PLAN, "plan {id} {durationMs}ms", {
			id: loggedId,
			count: base.paged.length + base.start.length + base.end.length,
			drawn: built.start.length + built.center.length + built.end.length,
			durationMs: performance.now() - started
		});
		return built;
	});
	/** @feature view.list */
	const cols = Signal(() => collapseToOneEntry(horizontal.$().nodes, state.listView.$()));
	/**
	* Declared widths, not resolved ones. The browser owns distribution now: `trackList` emits `fr`
	* and `minmax()` into `grid-template-columns`, so nothing here can know what a flex column
	* ends up occupying without measuring the DOM. A flex column therefore reports the default,
	* and a caller wanting the painted width reads the element.
	*/
	const widths = Signal(() => {
		const defs = byId.$();
		const override = state.colWidth.$();
		const declared = /* @__PURE__ */ new Map();
		for (const node of colNodes.$()) {
			const col = defs.get(node.key);
			if (col === void 0 || isHeaderGroup(col)) continue;
			declared.set(col.id, override[col.id] ?? col.width ?? DEFAULT_COL_WIDTH);
		}
		return declared;
	});
	/** The horizontal run's entries with the bands dropped. A band labels its leaves and occupies no
	* seat, and a row carries no marker, so the one marker test serves under either seating. */
	const colLeaves = Signal(() => {
		const across = horizontal.$();
		return cols.$().filter((it) => across.axis.by.has(it.key) && !isHeaderGroup(across.axis.by.get(it.key))).map((it) => it.key);
	});
	/** The same `renderPlan` the vertical seat runs, handed the other viewport dimension. `partition`
	* lifts pinned entries out first, so the window can never drop one. @feature view.virtualize.col */
	const colPlan = Signal(() => {
		const seat = horizontal.$();
		const start = viewport.left.$();
		const extent = viewport.width.$();
		const resolved = widths.$();
		return renderPlan({
			flat: colLeaves.$(),
			side: (key) => seat.pinning[key],
			page: NO_PAGE,
			paginate: false,
			virtualize: state.virtualize.horizontal.$(),
			sizer: (keys) => sizerFor(keys, (it) => resolved.get(it) ?? seat.extent[it], DEFAULT_COL_WIDTH),
			viewport: {
				start,
				extent
			},
			overscan: config.overscan ?? 4
		});
	});
	const colSpacers = Signal(() => spacersOf(colPlan.$()));
	/**
	* `ColumnDef.span` is the source; this relation is what the kernel reads. The callback is
	* column-shaped and could not survive a transpose, so it is crossed into vertical/horizontal
	* counts once, here, and never spoken of in row and column terms again.
	* @feature cell.span
	*/
	const spans = Signal(() => {
		const spanning = columns.$().filter((it) => it.span !== void 0);
		if (spanning.length === 0) return NO_SPANS;
		const orientation = state.orientation.$();
		const by = detailed.$().by;
		const out = /* @__PURE__ */ new Map();
		for (const node of flat.$()) {
			const row = by.get(node.key);
			if (row === void 0) continue;
			for (const def of spanning) {
				const read = def.span;
				if (read === void 0) continue;
				const declared = read(row, node.index);
				if (declared === void 0) continue;
				const extent = neutralSpan(declared, orientation);
				if (extent.vertical <= 1 && extent.horizontal <= 1) continue;
				out.set(neutralCell(node.key, def.id, orientation), extent);
			}
		}
		return out;
	});
	const view = {
		base,
		grouped,
		sorted,
		detailed,
		flat,
		vertical,
		horizontal,
		plan,
		cols,
		colLeaves,
		colPlan,
		colSpacers,
		widths,
		spans,
		covered: Signal(() => {
			const relation = spans.$();
			if (relation.size === 0) return NO_COVER;
			return coveredBy(relation, vertical.$().nodes.map((it) => it.key), horizontal.$().nodes.map((it) => it.key));
		})
	};
	const query = Signal(() => ({
		sort: state.sort.$(),
		group: state.group.$(),
		page: {
			...state.page.$(),
			total: rowCount.$()
		},
		expand: null
	}));
	return {
		id,
		mode,
		state,
		rows,
		columns,
		view,
		viewport,
		actions$,
		intent$: byPhase(actions$, "intent"),
		change$: byPhase(actions$, "change"),
		effect$: byPhase(actions$, "effect"),
		query,
		page$: actions$.pipe(filter((it) => it.phase === "change" && it.type === "page"), map((it) => ({
			index: it.page.index,
			size: it.page.size
		})), share()),
		dispatch,
		bind: (root) => bindRoot(root, id, dispatch, slice.epics$),
		close: () => opened.unsubscribe(),
		epics$: slice.epics$,
		slots: config.slots ?? {},
		rowId: config.rowId,
		rowHref: config.rowHref
	};
}
function sizerFor(keys, extentOf, fallback) {
	const measured = /* @__PURE__ */ new Map();
	for (let index = 0; index < keys.length; index++) {
		const key = keys[index];
		if (key === void 0) continue;
		const extent = extentOf(key);
		if (extent !== void 0) measured.set(index, extent);
	}
	if (measured.size === 0) return uniformSizer(keys.length, fallback);
	return measuredSizer(keys.length, fallback, measured);
}
/** True when the event's path from target to root (exclusive) crosses another grid's boundary, so a
* key raised inside a nested grid stays that grid's. The root itself is a boundary and is excluded. */
function nestedBoundaryBetween(root, target) {
	let node = target instanceof Node ? target : null;
	while (node !== null && node !== root) {
		if (node instanceof HTMLElement && node.hasAttribute("data-route-boundary")) return true;
		node = node.parentNode;
	}
	return false;
}
function bindRoot(root, id, dispatch, epics$) {
	const dom = gridDom(id.$());
	const subs = new Subscription();
	const on = (source, to) => {
		subs.add(source.pipe(filter((it) => it.params.gridId === id.$() && root.contains(it.delegateElement))).subscribe((it) => dispatch(to(it))));
	};
	on(dom.cell.route.click.pipe(filter((it) => !browserOwnsClick(it))), intentOf["cell.click"]);
	on(dom.cell.route.pointerdown, intentOf["cell.pointerdown"]);
	on(dom.cell.route.pointerover, intentOf["cell.pointerenter"]);
	on(dom.cell.route.dblclick, intentOf["cell.dblclick"]);
	on(dom.header.route.click, intentOf["header.click"]);
	on(dom.headerResize.route.pointerdown, (it) => intentOf["header.pointerdown"](it, "resize"));
	on(dom.headerMove.route.pointerdown, (it) => intentOf["header.pointerdown"](it, "move"));
	on(dom.header.route.pointerdown, (it) => intentOf["header.pointerdown"](it, "select"));
	on(dom.rowMove.route.pointerdown, intentOf["row.pointerdown"]);
	on(dom.expander.route.click, intentOf["expander.click"]);
	on(dom.cellExpander.route.click, intentOf["expander.click"]);
	on(dom.rowCheck.route.click, intentOf["checkbox.click"]);
	subs.add(fromEvent(root, "keydown").pipe(filter((it) => !nestedBoundaryBetween(root, it.target))).subscribe((it) => dispatch(intentOf.key(it))));
	subs.add(epics$.subscribe());
	return () => subs.unsubscribe();
}
//#endregion
//#region src/9_css.ts
/** Density in pixels. The row box reads it, and so does the sticky top of the pinned row run. */
var SG_ROW_H = "--sg-row-h";
/** Scroll spacer height. Measures the paginated center run, not the whole relation. */
var SG_TOTAL_H = "--sg-total-h";
/** Pixels above the first rendered row, applied as a translate on the rendered run. */
var SG_OFFSET_Y = "--sg-offset-y";
/** `grid-template-columns` for the horizontal run. Named for the direction because under
* `orientation: "columns"` that run holds rows and the tracks still describe the inline axis. */
var SG_INLINE_TRACKS = "--sg-inline-tracks";
/** The height one row box reads. Its own property is named after its id, which no selector can
* spell, so the row carries this alias and one generic rule serves every row. */
var SG_ROW_HEIGHT_SELF = "--sg-h";
/** Writes every geometry property onto `root` from one derived node, so two sources changing in
* the same tick cannot paint two different frames. */
function writeGridVars(grid, root) {
	const frame = Signal(() => {
		const plan = grid.view.plan.$();
		const across = grid.view.horizontal.$();
		const down = grid.view.vertical.$();
		return {
			tracks: trackList(tracksOf(grid.view.colPlan.$(), grid.view.colSpacers.$(), across.extent, grid.columns.$())),
			rowHeight: ROW_HEIGHT[grid.state.density.$()],
			extent: down.extent,
			drawn: [
				...plan.start,
				...plan.center,
				...plan.end
			],
			totalHeight: plan.centerTotal,
			offsetY: plan.offsetTop
		};
	});
	let written = /* @__PURE__ */ new Set();
	const held = /* @__PURE__ */ new Map();
	let counted = null;
	let declared = 0;
	const declaredOf = (extent) => {
		if (extent !== counted) {
			counted = extent;
			declared = Object.keys(extent).length;
		}
		return declared;
	};
	const sub = frame.$.subscribe((next) => {
		if (!LOG$1.on) {
			written = writeFrame(root, next, written, held);
			return;
		}
		const started = performance.now();
		written = writeFrame(root, next, written, held);
		const durationMs = performance.now() - started;
		LOG$1.emit(CAT_VARS, "vars {id} {durationMs}ms", {
			id: grid.id.$(),
			declared: declaredOf(next.extent),
			drawn: next.drawn.length,
			written: written.size,
			durationMs
		});
	});
	return () => sub.unsubscribe();
}
/** A skipped run as one fixed track. No column can be placed in it, so it carries no def. */
var spacerTrack = (id, width) => ({
	id,
	width
});
var SPACER_LEAD = "sg-lead";
var SPACER_TRAIL = "sg-trail";
/**
* @comment-ok: the column-window layout decision, weighed against a measured lab result that lives
* outside this repo and has no runtime home here
*
* One track per rendered entry, in run order, so track N and cell N are the same entry and every
* row inherits the one list through `subgrid` rather than carrying a width. The columns the window
* skipped keep their place as one leading and one trailing track.
*
* Spacer tracks rather than an absolute offset per cell. `subgrid`, `grid-column: span` for a
* spanning cell, and the two sticky pinned runs all read this list, so moving rendered cells out of
* it would need a second implementation of each, gated on one toggle. What that costs is one
* `grid-template-columns` write per window shift, and the measured price of that write scales with
* the rows in the document rather than with the relation: 1461 ms over 90 writes at 1000 rows
* against 8005 ms at 5000 (`~/projects/claude-research/labs/grid-resize-perf/RESULTS.md`). Row
* virtualization already holds the document at one viewport of rows, and `writeFrame` skips the
* write on every frame the string did not move, so a horizontal scroll reflows the rendered rows
* once per column crossed and never once per frame.
*/
function tracksOf(plan, spacers, extent, schema) {
	const defs = new Map(schema.map((col) => [col.id, col]));
	const track = (key) => trackFor(key, extent[key], defs.get(key));
	const windowed = plan.center.map(track);
	const center = spacers.tracked ? [
		spacerTrack(SPACER_LEAD, spacers.lead),
		...windowed,
		spacerTrack(SPACER_TRAIL, spacers.trail)
	] : windowed;
	return [
		...plan.start.map(track),
		...center,
		...plan.end.map(track)
	];
}
/** A declared extent is a resize the user performed, so it answers alone and the track is that many
* pixels. The bounds belong to the gesture, which clamped to them before writing the extent. */
function trackFor(key, declared, def) {
	if (declared !== void 0) return {
		id: key,
		width: declared
	};
	return {
		id: key,
		width: def?.width,
		minWidth: def?.minWidth,
		maxWidth: def?.maxWidth,
		flex: def?.flex
	};
}
/** Writes only on the edge. A repeat of the value already there is one style invalidation for a
* frame that moved nothing, and the track list is the property that then reflows every row. */
function setVar(style, held, name, value) {
	if (held.get(name) === value) return;
	held.set(name, value);
	style.setProperty(name, value);
}
function writeFrame(root, frame, previous, held) {
	const style = root.style;
	setVar(style, held, SG_ROW_H, px(frame.rowHeight));
	setVar(style, held, SG_TOTAL_H, px(frame.totalHeight));
	setVar(style, held, SG_OFFSET_Y, px(frame.offsetY));
	setVar(style, held, SG_INLINE_TRACKS, frame.tracks);
	const names = /* @__PURE__ */ new Set();
	writeExtents(root, frame.extent, frame.drawn, names, held);
	for (const name of previous) {
		if (names.has(name)) continue;
		held.delete(name);
		style.removeProperty(name);
	}
	return names;
}
function writeExtents(root, extent, drawn, names, held) {
	for (const key of drawn) {
		const height = extent[key];
		if (height === void 0) continue;
		const name = rowHeightVar(key);
		setVar(root.style, held, name, px(height));
		names.add(name);
	}
}
var px = (value) => `${Math.round(value * 100) / 100}px`;
//#endregion
//#region src/10_render.ts
var SIDES = [
	"start",
	"center",
	"end"
];
/** The drop line's offsets. Physical, unlike every other number this package writes: they come off
* `getBoundingClientRect`, which reports physical coordinates whatever the writing mode. */
var SG_GUIDE_X = "--sg-guide-x";
var SG_GUIDE_Y = "--sg-guide-y";
/** Built-ins whose own glyph carries a route under the row. Their cell must not add a `c` segment. */
var ROW_ROUTED = /* @__PURE__ */ new Set([
	"check",
	"radio",
	"expand",
	"drag"
]);
var builtInOf = (def) => def !== void 0 && isBuiltIn(def) ? def.builtIn : void 0;
var carriesRowRoute = (def) => {
	const kind = builtInOf(def);
	return kind !== void 0 && ROW_ROUTED.has(kind);
};
var isExpandColumn = (def) => builtInOf(def) === "expand";
var ROW_SEAT = "\0row";
var COL_SEAT = "\0col";
/**
* True when the run that scrolls is the row axis. Only that axis flattens against `expanded`: the
* column axis is always fully open, so a disclosure on a header group is one that can never close.
*/
var rowsRunVertical = (orientation) => conventionalParts(ROW_SEAT, COL_SEAT, orientation)[0] === ROW_SEAT;
var asksToMove = (def) => def?.movable === true;
/** A row never rendered yet, distinct from a row whose data is genuinely absent. */
var UNRENDERED = Symbol("unrendered");
function render(grid, root) {
	let gridId = grid.id.$();
	setAttrs(root, gridAttrs(gridId));
	root.classList.add("sg");
	const scroll = document.createElement("div");
	scroll.className = "sg-scroll";
	const head = box("sg-head");
	const pinnedStart = box("sg-rows sg-pinned-start");
	const canvas = box("sg-canvas");
	const center = box("sg-rows sg-center");
	const pinnedEnd = box("sg-rows sg-pinned-end");
	canvas.append(center);
	const guide = box("sg-guide");
	scroll.append(head, pinnedStart, canvas, pinnedEnd, guide);
	root.append(scroll);
	const marked = [];
	const rows = /* @__PURE__ */ new Map();
	let headerSubs = new Subscription();
	let headKey = null;
	let headBand = null;
	let headSort = [];
	const sizes = Signal(() => groupCounts(grid.view.sorted.$()));
	const verticalKeys = Signal(() => grid.view.vertical.$().nodes.map((it) => it.key));
	const verticalNodes = Signal(() => new Map(grid.view.vertical.$().nodes.map((node) => [node.key, node])));
	const anyChildren = Signal(() => grid.view.vertical.$().nodes.some((it) => it.hasChildren));
	const covers = Signal(() => selectionTest(rangeOf(grid.state.selection.$()), verticalKeys.$(), grid.view.colLeaves.$()));
	const frame = Signal(() => {
		if (!LOG$1.on) return frameBody();
		const started = performance.now();
		const built = frameBody();
		LOG$1.emit(CAT_FRAME, "frame {id} {durationMs}ms", {
			id: built.gridId,
			verticalCount: built.verticalKeys.length,
			horizontalCount: built.horizontalKeys.length,
			durationMs: performance.now() - started
		});
		return built;
	});
	function frameBody() {
		const schema = grid.columns.$();
		const defs = new Map(schema.map((col) => [col.id, col]));
		const nodes = grid.view.cols.$();
		const across = grid.view.horizontal.$();
		const down = grid.view.vertical.$();
		const pinning = across.pinning;
		const leaves = grid.view.colLeaves.$();
		const colPlan = grid.view.colPlan.$();
		const spacers = grid.view.colSpacers.$();
		const runs = {
			start: colPlan.start,
			center: colPlan.center,
			end: colPlan.end
		};
		const orientation = grid.state.orientation.$();
		const rowsVertical = rowsRunVertical(orientation);
		const rows = bandDepth(across.axis, leaves);
		const band = [];
		for (let depth = 0; depth < rows; depth++) band.push({
			start: bandRow(across.axis, runs.start, depth, rows),
			center: bandRow(across.axis, runs.center, depth, rows),
			end: bandRow(across.axis, runs.end, depth, rows)
		});
		return {
			band,
			bandSignature: band.map((row) => SIDES.map((side) => row[side].map((it) => `${it.key ?? ""}+${it.span}`).join(",")).join("|")).join("/"),
			gridId: grid.id.$(),
			plan: grid.view.plan.$(),
			defs,
			horizontalNodes: new Map(nodes.map((node) => [node.key, node])),
			runs,
			spacers,
			colRunSignature: [
				runs.start,
				runs.center,
				runs.end
			].map((run) => run.join("\0")).join("|").concat(spacers.tracked ? "|gap" : ""),
			pinning,
			orientation,
			spans: grid.view.spans.$(),
			covered: grid.view.covered.$(),
			sort: grid.state.sort.$(),
			data: grid.view.detailed.$().by,
			drawsExpander: rowsVertical && !schema.some(isExpandColumn) && anyChildren.$(),
			rowsVertical,
			nodes: verticalNodes.$(),
			group: grid.state.group.$(),
			groupSizes: sizes.$(),
			selection: grid.state.rowSelection.$(),
			covers: covers.$(),
			verticalKeys: verticalKeys.$(),
			horizontalKeys: leaves,
			expanded: grid.state.expanded.$(),
			detail: grid.state.detail.$(),
			drag: grid.state.drag.$(),
			extent: down.extent,
			editing: grid.state.editing.$()
		};
	}
	function headerCell(colId, current, subs) {
		const cell = box("sg-head-cell");
		setAttrs(cell, headerAttrs(colId));
		const entry = addressedEntry("", colId, current.orientation, current.defs, current.data);
		const def = entry.def;
		const direction = sortOf(current.sort, colId);
		if (direction !== null) {
			cell.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
			cell.setAttribute("data-sort", direction);
		}
		const node = current.horizontalNodes.get(colId);
		const label = box("sg-head-label");
		if (asksToMove(def)) setAttrs(label, moveAttrs());
		cell.append(label);
		const slot = def?.headerCell ?? grid.slots.header;
		if (slot !== void 0 && node !== void 0) mount(label, slot({
			col: colId,
			node,
			sort: direction,
			pinned: current.pinning[colId],
			row: entry.row === "" ? null : entry.row,
			data: entry.data,
			grid
		}), subs);
		else label.append(def?.header ?? colId);
		if (def?.resizable === true) {
			const handle = box("sg-resize");
			setAttrs(handle, resizeAttrs());
			cell.append(handle);
		}
		return cell;
	}
	function bandCell(cell, current, subs) {
		const key = cell.key;
		const el = box(key === null ? "sg-head-cell sg-head-filler" : "sg-head-cell sg-head-band");
		el.style.gridColumn = `span ${cell.span}`;
		if (key === null) return el;
		el.setAttribute("data-band", key);
		const entry = addressedEntry("", key, current.orientation, current.defs, current.data);
		const node = current.horizontalNodes.get(key);
		const label = box("sg-head-label");
		el.append(label);
		const slot = entry.def?.headerCell ?? grid.slots.headerGroup;
		if (slot !== void 0 && node !== void 0) mount(label, slot({
			col: key,
			node,
			sort: null,
			pinned: current.pinning[key],
			row: entry.row === "" ? null : entry.row,
			data: entry.data,
			grid
		}), subs);
		else label.append(entry.def?.header ?? key);
		return el;
	}
	function buildHeader(current) {
		headerSubs.unsubscribe();
		headerSubs = new Subscription();
		const last = current.band.length - 1;
		const rows = [];
		for (let depth = 0; depth < current.band.length; depth++) {
			const cells = current.band[depth];
			if (cells === void 0) continue;
			const runs = [];
			for (const side of SIDES) {
				const keys = current.runs[side];
				if (keys.length === 0) continue;
				const run = openRun(side, keys.length, current.spacers);
				for (const cell of cells[side]) {
					const key = cell.key;
					run.append(depth === last && key !== null ? headerCell(key, current, headerSubs) : bandCell(cell, current, headerSubs));
				}
				runs.push(run);
			}
			const row = box("sg-head-row");
			row.replaceChildren(...runs);
			rows.push(row);
		}
		head.replaceChildren(...rows);
		root.style.setProperty(SG_HEAD_ROWS, String(Math.max(1, rows.length)));
	}
	function cellFor(key, across, node, current, subs) {
		const address = cellId(key, across);
		if (current.covered.has(address)) return null;
		const entry = addressedEntry(key, across, current.orientation, current.defs, current.data);
		const { row, col, def } = entry;
		const glyph = carriesRowRoute(def);
		const cell = box(glyph ? "sg-cell sg-cell-glyph" : "sg-cell");
		if (!glyph) setAttrs(cell, cellAttrs(col));
		if (row !== key) setAttrs(cell, rowIdAttrs(row));
		const span = current.spans.get(address);
		if (span !== void 0) {
			cell.setAttribute("data-span", "true");
			cell.style.setProperty("--sg-span-vertical", String(span.vertical));
			cell.style.setProperty("--sg-span-horizontal", String(span.horizontal));
		}
		const data = entry.data;
		if (data === void 0) return cell;
		const editing = current.editing === cellId(row, col);
		if (editing) cell.setAttribute("data-editing", "true");
		const nodePair = [node, current.horizontalNodes.get(across)];
		const ctx = {
			row,
			col,
			data,
			value: readValue(def, data, col),
			node: verticalOf(nodePair, current.orientation) ?? node,
			editing
		};
		const host = editing ? cell : linkIn(cell, hrefOf(grid, def, data));
		const slot = (editing ? grid.slots.editor : void 0) ?? def?.cell ?? grid.slots.cell;
		if (slot === void 0) {
			host.append(textOf(ctx.value));
			return cell;
		}
		mount(host, slot(ctx), subs);
		return cell;
	}
	function expanderFor(key, node, data, current, subs) {
		const el = box("sg-expander");
		setAttrs(el, expandAttrs());
		el.setAttribute("data-leaf", String(!node.hasChildren));
		const slot = grid.slots.expander;
		if (slot !== void 0 && data !== void 0) mount(el, slot({
			row: key,
			data,
			node,
			selected: current.selection[key] === true,
			open: current.expanded[key] === true
		}), subs);
		return el;
	}
	function buildCells(record, key, node, data, current) {
		record.subs.unsubscribe();
		const subs = new Subscription();
		record.subs = subs;
		const runs = [];
		let leading = true;
		record.cells.clear();
		for (const side of SIDES) {
			const keys = current.runs[side];
			if (keys.length === 0) continue;
			const run = openRun(side, keys.length, current.spacers);
			const built = [];
			for (const across of keys) {
				const cell = cellFor(key, across, node, current, subs);
				if (cell === null) continue;
				built.push(cell);
				record.cells.set(across, cell);
			}
			const first = built[0];
			if (leading && current.drawsExpander && first !== void 0) {
				first.prepend(expanderFor(key, node, data, current, subs));
				leading = false;
			}
			for (const cell of built) run.append(cell);
			runs.push(run);
		}
		record.el.replaceChildren(...runs);
	}
	function buildHeading(record, key, node, data, current) {
		record.subs.unsubscribe();
		const subs = new Subscription();
		record.subs = subs;
		record.cells.clear();
		const host = box("sg-group-cell");
		host.append(expanderFor(key, node, void 0, current, subs));
		const label = box("sg-group-label");
		host.append(label);
		const level = data.path.length - 1;
		const field = current.group[level];
		const ctx = {
			row: key,
			data,
			node,
			path: data.path,
			value: data.path[level],
			field,
			header: field === void 0 ? void 0 : current.defs.get(field)?.header,
			count: current.groupSizes.get(key) ?? 0,
			nested: current.group.length > 1,
			open: current.expanded[key] === true,
			selected: current.selection[key] === true
		};
		const slot = grid.slots.groupRow;
		if (slot === void 0) label.append(...headingParts(ctx));
		else mount(label, slot(ctx), subs);
		record.el.replaceChildren(host);
	}
	function buildPanel(record, owner, node, data, current) {
		record.subs.unsubscribe();
		const subs = new Subscription();
		record.subs = subs;
		const panel = box("sg-detail-panel");
		const slot = grid.slots.detail;
		if (slot !== void 0 && data !== void 0) mount(panel, slot({
			row: owner,
			data,
			node,
			selected: current.selection[owner] === true,
			open: current.expanded[owner] === true
		}), subs);
		record.el.replaceChildren(panel);
	}
	function stampSelection(record, key, node, current) {
		const run = current.horizontalKeys;
		for (let index = 0; index < run.length; index++) {
			const across = run[index];
			if (across === void 0) continue;
			const cell = record.cells.get(across);
			if (cell === void 0) continue;
			const on = current.covers(cellId(key, across));
			if (on !== cell.hasAttribute("data-selected")) {
				if (on) cell.setAttribute("data-selected", "true");
				else cell.removeAttribute("data-selected");
			}
			if (!on) {
				cell.removeAttribute("data-edge");
				continue;
			}
			const edge = edgeOf(current, key, node.index, index);
			if (cell.getAttribute("data-edge") !== edge) cell.setAttribute("data-edge", edge);
		}
	}
	/** Which sides of the block a selected cell sits on, so one rectangle draws one border. */
	function edgeOf(current, key, atVertical, atHorizontal) {
		const down = current.verticalKeys;
		const run = current.horizontalKeys;
		const holds = (vertical, horizontal) => vertical !== void 0 && horizontal !== void 0 && current.covers(cellId(vertical, horizontal));
		const across = run[atHorizontal];
		const edges = [];
		if (!holds(down[atVertical - 1], across)) edges.push("top");
		if (!holds(down[atVertical + 1], across)) edges.push("bottom");
		if (!holds(key, run[atHorizontal - 1])) edges.push("start");
		if (!holds(key, run[atHorizontal + 1])) edges.push("end");
		return edges.join(" ");
	}
	function ensureRow(key, current) {
		const node = current.nodes.get(key);
		if (node === void 0) return void 0;
		const panel = isDetailKey(key);
		const owner = rowOfDetailKey(key);
		const data = current.data.get(key);
		const heading = isGroupRow(data);
		let record = rows.get(key);
		if (record === void 0) {
			const el = box(rowClass(panel, heading));
			setAttrs(el, rowAttrs(owner));
			if (panel) el.setAttribute("data-detail", "true");
			if (heading) el.setAttribute("data-group", "true");
			record = {
				el,
				colRunSignature: "",
				data: UNRENDERED,
				editing: null,
				cells: /* @__PURE__ */ new Map(),
				subs: new Subscription()
			};
			rows.set(key, record);
		}
		const identity = data ?? current.data;
		const editing = panel ? null : editingIn(current.editing, key, current.orientation);
		if (record.colRunSignature !== current.colRunSignature || record.data !== identity || record.editing !== editing) {
			if (panel) buildPanel(record, owner, node, data, current);
			else if (heading) buildHeading(record, key, node, data, current);
			else buildCells(record, key, node, data, current);
			record.colRunSignature = current.colRunSignature;
			record.data = identity;
			record.editing = editing;
		}
		record.el.style.setProperty(SG_DEPTH, String(current.rowsVertical ? node.depth : 0));
		if (current.extent[key] === void 0) record.el.style.removeProperty(SG_ROW_HEIGHT_SELF);
		else record.el.style.setProperty(SG_ROW_HEIGHT_SELF, `var(${rowHeightVar(key)}, var(${SG_ROW_H}))`);
		record.el.setAttribute("data-selected", String(current.selection[owner] === true));
		stampSelection(record, key, node, current);
		record.el.setAttribute("data-open", String(current.expanded[owner] === true));
		record.el.setAttribute("data-detail-open", String(current.detail[owner] !== void 0));
		if (node.hasChildren) record.el.setAttribute("aria-expanded", String(current.expanded[owner] === true));
		else record.el.removeAttribute("aria-expanded");
		return record;
	}
	function reconcile(host, keys, current, seen) {
		let cursor = host.firstChild;
		for (const key of keys) {
			if (stopped) return;
			const record = ensureRow(key, current);
			if (record === void 0) continue;
			seen.add(key);
			if (record.el === cursor) {
				cursor = cursor.nextSibling;
				continue;
			}
			host.insertBefore(record.el, cursor);
		}
	}
	function pass(current) {
		if (!LOG$1.on) return passBody(current);
		const started = performance.now();
		passBody(current);
		LOG$1.emit(CAT_DOM, "dom {id} {durationMs}ms", {
			id: current.gridId,
			drawn: current.plan.start.length + current.plan.center.length + current.plan.end.length,
			held: rows.size,
			durationMs: performance.now() - started
		});
	}
	const headCellFor = (colId) => head.querySelector(selectorFor("header", { colId }));
	function paintPreview(current) {
		for (const el of marked) el.removeAttribute("data-dragging");
		marked.length = 0;
		const preview = current.drag;
		if (preview === null) {
			guide.removeAttribute("data-axis");
			return;
		}
		const box = scroll.getBoundingClientRect();
		const mark = (el) => {
			if (el === null) return;
			el.setAttribute("data-dragging", "true");
			marked.push(el);
		};
		const hide = () => guide.removeAttribute("data-axis");
		if (preview.kind === "rowMove") {
			mark(rows.get(preview.row)?.el ?? null);
			const over = rows.get(preview.over)?.el;
			if (over === void 0) return hide();
			const rect = over.getBoundingClientRect();
			const edge = preview.side === "start" ? rect.top : rect.bottom;
			guide.style.setProperty(SG_GUIDE_Y, `${Math.round(edge - box.top + scroll.scrollTop)}px`);
			guide.setAttribute("data-axis", "block");
			return;
		}
		if (preview.kind === "colMove") mark(headCellFor(preview.col));
		const anchor = headCellFor(preview.kind === "colSize" ? preview.col : preview.over);
		if (anchor === null) return hide();
		const rect = anchor.getBoundingClientRect();
		const edge = preview.kind === "colSize" ? rect.left + preview.width : preview.side === "start" ? rect.left : rect.right;
		guide.style.setProperty(SG_GUIDE_X, `${Math.round(edge - box.left + scroll.scrollLeft)}px`);
		guide.setAttribute("data-axis", "inline");
	}
	function passBody(current) {
		if (stopped) return;
		if (current.gridId !== gridId) {
			gridId = current.gridId;
			setAttrs(root, gridAttrs(gridId));
		}
		if (current.colRunSignature !== headKey || current.bandSignature !== headBand || current.sort !== headSort) {
			buildHeader(current);
			headKey = current.colRunSignature;
			headBand = current.bandSignature;
			headSort = current.sort;
		}
		const seen = /* @__PURE__ */ new Set();
		reconcile(pinnedStart, current.plan.start, current, seen);
		reconcile(center, current.plan.center, current, seen);
		reconcile(pinnedEnd, current.plan.end, current, seen);
		if (stopped) return;
		for (const [key, record] of rows) {
			if (seen.has(key)) continue;
			record.subs.unsubscribe();
			record.el.remove();
			rows.delete(key);
		}
		paintPreview(current);
	}
	const subscription = new Subscription();
	let stopped = false;
	if (!root.hasAttribute("tabindex")) root.tabIndex = 0;
	subscription.add(grid.bind(root));
	subscription.add(frame.$.subscribe(pass));
	const onScroll = () => {
		const top = scroll.scrollTop;
		const left = scroll.scrollLeft;
		grid.viewport.$({
			...grid.viewport.$(),
			top,
			left
		});
		grid.dispatch({
			phase: "intent",
			type: "viewport.scroll",
			top,
			left
		});
	};
	scroll.addEventListener("scroll", onScroll, { passive: true });
	subscription.add(() => scroll.removeEventListener("scroll", onScroll));
	const observer = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (entry === void 0) return;
		const { width, height } = entry.contentRect;
		grid.viewport.$({
			...grid.viewport.$(),
			width,
			height
		});
		grid.dispatch({
			phase: "intent",
			type: "viewport.resize",
			width,
			height
		});
	});
	observer.observe(scroll);
	subscription.add(() => observer.disconnect());
	subscription.add(writeGridVars(grid, root));
	subscription.add(() => headerSubs.unsubscribe());
	subscription.add(() => root.style.removeProperty(SG_HEAD_ROWS));
	subscription.add(() => {
		const held = new Subscription();
		for (const record of rows.values()) held.add(record.subs);
		rows.clear();
		held.unsubscribe();
	});
	subscription.add(() => scroll.remove());
	return { stop: () => {
		stopped = true;
		subscription.unsubscribe();
	} };
}
/** Pulls a teardown out of a slot's return, leaving the content or signal the branches below read. */
var split = (content) => {
	if (typeof content === "object" && content !== null && "unsubscribe" in content) {
		const held = content;
		return {
			body: held.$ !== void 0 ? { $: held.$ } : held.content,
			unsubscribe: held.unsubscribe
		};
	}
	return {
		body: content,
		unsubscribe: void 0
	};
};
/** A signal slot subscribes one node into the row's `Subscription`, so a recycled cell cannot keep
* writing into a node that now belongs to another row. */
function mount(host, content, subs) {
	const held = split(content);
	if (held.unsubscribe !== void 0) subs.add(held.unsubscribe);
	const body = held.body;
	if (!isSignal(body)) {
		append(host, body);
		return;
	}
	const anchor = document.createComment("sg");
	host.append(anchor);
	let owned = [];
	subs.add(body.$.subscribe((next) => {
		for (const node of owned) node.remove();
		const batch = document.createDocumentFragment();
		append(batch, next);
		owned = [...batch.childNodes];
		host.insertBefore(batch, anchor);
	}));
}
function append(host, value) {
	if (value === null || value === void 0 || typeof value === "boolean") return;
	if (typeof value === "string" || typeof value === "number") {
		host.append(String(value));
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) append(host, item);
		return;
	}
	if (typeof Node !== "undefined" && value instanceof Node) {
		host.append(value);
		return;
	}
}
/** A column's own target beats the row's. A built-in column holds a control rather than a value,
* so a row link never covers one: the click there belongs to the glyph. */
var hrefOf = (grid, def, row) => def?.href?.(row) ?? (def !== void 0 && isBuiltIn(def) ? void 0 : grid.rowHref?.(row));
function linkIn(cell, href) {
	if (href === void 0) return cell;
	const link = document.createElement("a");
	link.className = "sg-link";
	link.href = href;
	link.draggable = false;
	cell.append(link);
	return link;
}
var textSpan = (className, text) => {
	const el = document.createElement("span");
	el.className = className;
	el.append(text);
	return el;
};
/** The field is drawn only when a second level is open, which is when a `kind` heading and an
* `owner` heading are otherwise two bare values a reader cannot tell apart. */
function headingParts(ctx) {
	const out = [];
	const field = ctx.header ?? ctx.field;
	if (ctx.nested && field !== void 0) out.push(textSpan("sg-group-field", field));
	out.push(textSpan("sg-group-value", textOf(ctx.value)));
	out.push(textSpan("sg-group-count", String(ctx.count)));
	return out;
}
var textOf = (value) => value === null || value === void 0 ? "" : typeof value === "symbol" ? value.toString() : String(value);
var readValue = (def, row, colId) => columnReader(def, colId)(row);
/** A row is one of three kinds, and no key is two of them: a detail key holds a NUL and a group key
* holds the `GROUP_PREFIX` namespace, so the pair can never both answer. */
var rowClass = (panel, heading) => panel ? "sg-row sg-detail-row" : heading ? "sg-row sg-group-row" : "sg-row";
var box = (className) => {
	const el = document.createElement("div");
	el.className = className;
	return el;
};
var runBox = (side, tracks) => {
	const el = box("sg-run");
	el.setAttribute("data-side", side);
	el.style.gridColumn = `span ${Math.max(1, tracks)}`;
	return el;
};
/** An empty box takes the leading spacer track, so auto-placement puts every cell on the track its
* own column occupies and no index arithmetic here has to match `9_css.ts`. Center run only. */
function openRun(side, count, spacers) {
	if (side !== "center" || !spacers.tracked) return runBox(side, count);
	const run = runBox(side, count + 2);
	run.append(box("sg-spacer"));
	return run;
}
var ROUTE_ATTR = "data-route";
/**
* The row id alone. `rowAttrs` also carries the row's route segment, and a second copy of that on
* a cell would lengthen the chain delegation composes to `g/r/r/c`, which no template declares.
* Taken off `rowAttrs` rather than spelled again, so the attribute name has one declaration.
*/
var rowIdAttrs = (rowId) => Object.fromEntries(Object.entries(rowAttrs(rowId)).filter(([name]) => name !== ROUTE_ATTR));
var setAttrs = (el, attrs) => {
	for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
};
var sortOf = (model, colId) => {
	for (const item of model) if (item.field === colId) return item.sort;
	return null;
};
/**
* Only the edited cell's own row rebuilds, so the comparison is scoped to this row's id. The state
* holds a conventional address and the records are keyed by the seat, so it crosses first.
*/
var editingIn = (editing, key, orientation) => {
	if (editing === null) return null;
	const parts = cellParts(editing);
	const [vertical] = conventionalParts(parts[0], parts[1], orientation);
	return vertical === key ? editing : null;
};
//#endregion
//#region bench/scroll/0_bench.ts
var DEFAULTS = {
	rows: 1e5,
	width: 1600,
	height: 900,
	overscan: 4,
	cell: "heavy",
	extent: "uniform",
	cv: 0,
	resize: 0
};
var cfgOf = (params) => {
	const num = (key, fallback) => {
		const raw = params.get(key);
		const value = raw === null ? NaN : Number(raw);
		return Number.isFinite(value) ? value : fallback;
	};
	return {
		rows: num("rows", DEFAULTS.rows),
		width: num("width", DEFAULTS.width),
		height: num("height", DEFAULTS.height),
		overscan: num("overscan", DEFAULTS.overscan),
		cell: params.get("cell") === "plain" ? "plain" : "heavy",
		extent: params.get("extent") === "varied" ? "varied" : "uniform",
		cv: params.get("cv") === "1" ? 1 : 0,
		resize: params.get("resize") === "1" ? 1 : 0
	};
};
var SPARK = 16;
var hash = (n) => {
	let h = Math.imul(n ^ 2654435769, 2246822507);
	h = Math.imul(h ^ h >>> 13, 3266489909);
	return ((h ^ h >>> 16) >>> 0) / 4294967296;
};
var rowAt = (at) => ({
	id: `r${at}`,
	at,
	name: `row ${at}`,
	size: Math.round(hash(at) * 1e5),
	pct: hash(at * 7),
	spark: Array.from({ length: SPARK }, (_value, i) => hash(at * 97 + i))
});
/** A proxy over an empty array: `Array.isArray` still answers true, `map` still walks it, and no
* array of a million objects is ever held. The same trick `demo/5_sheet.ts` uses. */
var INDEX = /^\d+$/;
var dataOf = (rows) => new Proxy([], {
	get: (target, key) => {
		if (key === "length") return rows;
		if (typeof key === "string" && INDEX.test(key)) {
			const at = Number(key);
			return at < rows ? rowAt(at) : void 0;
		}
		return Reflect.get(target, key);
	},
	has: (target, key) => typeof key === "string" && INDEX.test(key) ? Number(key) < rows : Reflect.has(target, key)
});
var el = (tag, cls) => {
	const node = document.createElement(tag);
	node.className = cls;
	return node;
};
var svg = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);
/** A sparkline as one `<rect>` per sample, so the node count is the point rather than the picture. */
var sparkline = (values) => {
	const chart = svg("svg");
	chart.setAttribute("viewBox", `0 0 64 16`);
	chart.setAttribute("width", `64`);
	chart.setAttribute("height", "16");
	for (const [i, value] of values.entries()) {
		const bar = svg("rect");
		bar.setAttribute("x", String(i * 4));
		bar.setAttribute("y", String(16 - value * 16));
		bar.setAttribute("width", "3");
		bar.setAttribute("height", String(value * 16));
		chart.append(bar);
	}
	return chart;
};
/** Nine elements in one cell against a plain text node's one, which is the whole of the `cell`
* factor. Shaped after `demo/6_dense.ts` so the two are comparable. */
var heavyCell = (row, colId) => {
	const host = el("span", "b-stack");
	if (colId === "spark") {
		host.append(sparkline(row.spark));
		return host;
	}
	if (colId === "pct") {
		const meter = el("span", "b-meter");
		const fill = el("span", "b-fill");
		fill.style.inlineSize = `${Math.round(row.pct * 100)}%`;
		meter.append(fill);
		const num = el("span", "b-num");
		num.textContent = `${Math.round(row.pct * 100)}%`;
		host.append(meter, num);
		return host;
	}
	const dot = el("span", "b-dot");
	const label = el("span", "b-label");
	label.textContent = String(colId === "name" ? row.name : row.size);
	const badge = el("span", "b-badge");
	badge.textContent = row.at % 3 === 0 ? "new" : "ok";
	host.append(dot, label, badge);
	return host;
};
var COLUMNS = [
	{
		id: "name",
		header: "Name",
		width: 220,
		value: (row) => row.name
	},
	{
		id: "size",
		header: "Size",
		type: "number",
		width: 120,
		value: (row) => row.size
	},
	{
		id: "pct",
		header: "Share",
		width: 160,
		value: (row) => row.pct
	},
	{
		id: "spark",
		header: "Trend",
		width: 100,
		value: (row) => row.spark.length
	},
	{
		id: "at",
		header: "Index",
		type: "number",
		width: 100,
		value: (row) => row.at
	}
];
var cvOnce = false;
var enableCv = () => {
	if (cvOnce) return;
	cvOnce = true;
	const style = document.createElement("style");
	style.textContent = `.b-cv .sg-center .sg-row { content-visibility: auto; contain-intrinsic-size: auto 36px }`;
	document.head.append(style);
};
var RESIZE_SPAN = .25;
var RESIZE_PERIOD = 40;
var seq = 0;
function mountBench(host, cfg) {
	host.style.inlineSize = `${cfg.width}px`;
	host.style.blockSize = `${cfg.height}px`;
	if (cfg.cv === 1) {
		enableCv();
		host.classList.add("b-cv");
	}
	const extent = cfg.extent === "varied" ? Object.fromEntries(Array.from({ length: cfg.rows }, (_value, at) => [`r${at}`, 36 + at % 5 * 6])) : {};
	const viewport = Signal({
		top: 0,
		left: 0,
		width: cfg.width,
		height: cfg.height
	});
	seq += 1;
	const id = `bench${seq}`;
	const handle = render(grid({
		id,
		rows: dataOf(cfg.rows),
		columns: COLUMNS,
		rowId: (row) => row.id,
		state: Signal({
			virtualize: {
				vertical: true,
				horizontal: false
			},
			density: "standard",
			rowHeight: extent
		}),
		viewport,
		overscan: cfg.overscan,
		slots: cfg.cell === "heavy" ? { cell: (ctx) => heavyCell(ctx.data, ctx.col) } : void 0
	}), host);
	const scroll = host.querySelector(".sg-scroll");
	if (!(scroll instanceof HTMLElement)) throw new Error("bench mount has no scroller");
	const observer = new ResizeObserver((entries) => {
		const box = entries[0]?.contentRect;
		if (box === void 0) return;
		viewport.$({
			...viewport.$(),
			width: box.width,
			height: box.height
		});
	});
	observer.observe(scroll);
	const step = (px, at) => {
		if (cfg.resize === 1) {
			const wave = 1 + Math.sin(at / RESIZE_PERIOD * Math.PI * 2) * RESIZE_SPAN;
			host.style.inlineSize = `${Math.round(cfg.width * wave)}px`;
			host.style.blockSize = `${Math.round(cfg.height * wave)}px`;
		}
		scroll.scrollTop += px;
	};
	return {
		id,
		host,
		scroll,
		step,
		dispose: () => {
			observer.disconnect();
			handle.stop();
		}
	};
}
//#endregion
export { setGridLogEmit as i, cfgOf as n, mountBench as r, DEFAULTS as t };
