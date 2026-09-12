import { i as setGridLogEmit, r as mountBench, t as DEFAULTS } from "./0_bench-CbDffROP.js";
//#region bench/scroll/knobs.ts
var el = (tag, cls) => {
	const node = document.createElement(tag);
	node.className = cls;
	return node;
};
var need = (id) => {
	const found = document.getElementById(id);
	if (found === null) throw new Error(`knobs page has no #${id}`);
	return found;
};
var stage = need("stage");
var rack = need("rack");
var readout = need("readout");
var trace = need("trace");
var curve = need("curve");
var knobs = {
	overscan: 4,
	scale: 1,
	speed: 120,
	cv: false,
	varied: false,
	rows: 1e5,
	heavy: true
};
var BOX = {
	width: 760,
	height: 420
};
var mounted = null;
var rebuilds = 0;
var cfgNow = () => ({
	...DEFAULTS,
	rows: knobs.rows,
	width: BOX.width,
	height: BOX.height,
	overscan: knobs.overscan,
	cell: knobs.heavy ? "heavy" : "plain",
	extent: knobs.varied ? "varied" : "uniform",
	cv: knobs.cv ? 1 : 0,
	resize: 0
});
function rebuild() {
	mounted?.dispose();
	stage.replaceChildren();
	const host = el("div", "k-host");
	stage.append(host);
	mounted = mountBench(host, cfgNow(), { overscan: () => Math.round(knobs.overscan) });
	rebuilds += 1;
	applyBox();
}
function applyBox() {
	const host = mounted?.host;
	if (host === void 0) return;
	host.style.inlineSize = `${Math.round(BOX.width * knobs.scale)}px`;
	host.style.blockSize = `${Math.round(BOX.height * knobs.scale)}px`;
	host.classList.toggle("b-cv", knobs.cv);
}
var FIELDS = [
	{
		key: "overscan",
		label: "overscan",
		note: "rows held past each edge",
		min: 0,
		max: 128,
		step: 1
	},
	{
		key: "scale",
		label: "box scale",
		note: "the grid element's own size",
		min: .3,
		max: 1.6,
		step: .01
	},
	{
		key: "speed",
		label: "scroll px per frame",
		note: "240 is what the matrix drives",
		min: 0,
		max: 480,
		step: 4
	},
	{
		key: "cv",
		label: "content-visibility",
		note: "auto, with an intrinsic size",
		min: 0,
		max: 1,
		step: 1,
		kind: "toggle"
	},
	{
		key: "varied",
		label: "declared row heights",
		note: "a height per row rather than one",
		min: 0,
		max: 1,
		step: 1,
		kind: "toggle"
	},
	{
		key: "heavy",
		label: "heavy cells",
		note: "a chart and a meter per row",
		min: 0,
		max: 1,
		step: 1,
		kind: "toggle",
		rebuilds: true
	},
	{
		key: "rows",
		label: "rows",
		note: "the relation",
		min: 1e3,
		max: 1e6,
		step: 1e3,
		rebuilds: true
	}
];
var readNumber = (key) => {
	const held = knobs[key];
	return typeof held === "boolean" ? held ? 1 : 0 : held;
};
var write = (field, value) => {
	if (field.kind === "toggle") knobs[field.key] = value >= .5;
	else knobs[field.key] = value;
	if (field.rebuilds === true) rebuild();
	else if (field.key === "scale" || field.key === "cv") applyBox();
	else if (field.key === "varied") writeHeights();
};
function writeHeights() {
	const g = mounted;
	if (g === null) return;
	const rows = Math.min(knobs.rows, 2e5);
	const record = knobs.varied ? Object.fromEntries(Array.from({ length: rows }, (_v, at) => [`r${at}`, 36 + at % 5 * 6])) : {};
	g.state.$({
		...g.state.$(),
		rowHeight: record
	});
}
var slots = /* @__PURE__ */ new Map();
for (const field of FIELDS) {
	const row = el("label", "k-field");
	const head = el("span", "k-head");
	head.innerHTML = `<b>${field.label}</b><i>${field.note}</i>`;
	const input = document.createElement("input");
	input.type = field.kind === "toggle" ? "checkbox" : "range";
	input.className = field.kind === "toggle" ? "k-check" : "k-range";
	if (field.kind !== "toggle") {
		input.min = String(field.min);
		input.max = String(field.max);
		input.step = String(field.step);
	}
	const value = el("span", "k-value");
	const sweep = document.createElement("button");
	sweep.className = "k-sweep";
	sweep.textContent = field.rebuilds === true ? "step" : "sweep";
	sweep.addEventListener("click", (event) => {
		event.preventDefault();
		startSweep(field);
	});
	input.addEventListener("input", () => {
		write(field, field.kind === "toggle" ? input.checked ? 1 : 0 : Number(input.value));
		paintRack();
	});
	row.append(head, input, value, sweep);
	rack.append(row);
	slots.set(field.key, {
		input,
		value
	});
}
var fmt = (field, at) => field.kind === "toggle" ? at >= .5 ? "on" : "off" : field.key === "scale" ? at.toFixed(2) : String(Math.round(at));
function paintRack() {
	for (const field of FIELDS) {
		const slot = slots.get(field.key);
		if (slot === void 0) continue;
		const at = readNumber(field.key);
		if (field.kind === "toggle") slot.input.checked = at >= .5;
		else slot.input.value = String(at);
		slot.value.textContent = fmt(field, at);
	}
}
var SWEEP_FRAMES = 240;
var sweep = null;
var points = [];
function startSweep(field) {
	sweep = {
		field,
		at: 0
	};
	points = [];
	curveLabel.textContent = `${field.label}: ${fmt(field, field.min)} to ${fmt(field, field.max)}`;
}
var curveLabel = need("curve-label");
function stepSweep() {
	const run = sweep;
	if (run === null) return;
	const phase = run.at / SWEEP_FRAMES;
	const wave = phase < .5 ? phase * 2 : (1 - phase) * 2;
	const value = run.field.min + (run.field.max - run.field.min) * wave;
	if (run.field.rebuilds === true) {
		const stepped = run.field.min + (run.field.max - run.field.min) * Math.floor(wave * 12) / 11;
		if (Math.abs(stepped - readNumber(run.field.key)) > run.field.step / 2) write(run.field, stepped);
	} else write(run.field, value);
	applyBox();
	paintRack();
	run.at += 1;
	if (run.at > SWEEP_FRAMES) sweep = null;
}
var cost = /* @__PURE__ */ new Map();
setGridLogEmit((category, _message, fields) => {
	const key = category.join(".");
	const ms = typeof fields["durationMs"] === "number" ? fields["durationMs"] : 0;
	cost.set(key, (cost.get(key) ?? 0) + ms);
});
var heapMb = () => (performance.memory?.usedJSHeapSize ?? 0) / 1024 ** 2;
var HISTORY = 320;
var gaps = new Float64Array(HISTORY);
var doms = new Float64Array(HISTORY);
var head = 0;
var filled = 0;
var previous = performance.now();
var running = true;
var SLOW = 32;
function frame(now) {
	const gap = now - previous;
	previous = now;
	if (running) {
		const domBefore = cost.get("signal-grid.dom") ?? 0;
		mounted?.step(knobs.speed, head);
		stepSweep();
		const dom = (cost.get("signal-grid.dom") ?? 0) - domBefore;
		gaps[head % HISTORY] = gap;
		doms[head % HISTORY] = dom;
		const run = sweep;
		if (run !== null) points.push({
			x: readNumber(run.field.key),
			y: gap
		});
		head += 1;
		filled = Math.min(HISTORY, filled + 1);
		if (head % 6 === 0) paint();
	}
	requestAnimationFrame(frame);
}
var line = (ctx, data, max, w, h, stroke) => {
	ctx.beginPath();
	for (let i = 0; i < filled; i++) {
		const at = (head - filled + i) % HISTORY;
		const y = h - Math.min(1, (data[(at + HISTORY) % HISTORY] ?? 0) / max) * h;
		const x = i / Math.max(1, 319) * w;
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.strokeStyle = stroke;
	ctx.lineWidth = 1.5;
	ctx.stroke();
};
var clear = (canvas) => {
	const ratio = devicePixelRatio || 1;
	const w = canvas.clientWidth;
	const h = canvas.clientHeight;
	canvas.width = Math.round(w * ratio);
	canvas.height = Math.round(h * ratio);
	const ctx = canvas.getContext("2d");
	if (ctx === null) throw new Error("no 2d context");
	ctx.scale(ratio, ratio);
	ctx.fillStyle = "#0f1115";
	ctx.fillRect(0, 0, w, h);
	return ctx;
};
var TRACE_MAX = 50;
function paint() {
	const w = trace.clientWidth;
	const h = trace.clientHeight;
	const ctx = clear(trace);
	for (const [at, label] of [
		[8.33, "120 Hz"],
		[16.7, "60 Hz"],
		[SLOW, "32 ms"]
	]) {
		const y = Math.min(h - 2, h - at / TRACE_MAX * h);
		ctx.strokeStyle = "#2a2f36";
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(w, y);
		ctx.stroke();
		ctx.fillStyle = "#6e7681";
		ctx.font = "9px system-ui";
		ctx.fillText(label, 2, Math.max(9, y - 2));
	}
	line(ctx, gaps, TRACE_MAX, w, h, "#6fd7ad");
	line(ctx, doms, 3, w, h, "#5a8fd6");
	const cw = curve.clientWidth;
	const ch = curve.clientHeight;
	const cctx = clear(curve);
	if (points.length > 0) {
		let lo = points[0].x;
		let hi = points[0].x;
		for (const it of points) {
			if (it.x < lo) lo = it.x;
			if (it.x > hi) hi = it.x;
		}
		const span = hi - lo || 1;
		const y32 = ch - SLOW / TRACE_MAX * ch;
		cctx.strokeStyle = "#2a2f36";
		cctx.beginPath();
		cctx.moveTo(0, y32);
		cctx.lineTo(cw, y32);
		cctx.stroke();
		for (const it of points) {
			const x = (it.x - lo) / span * cw;
			const y = ch - Math.min(1, it.y / TRACE_MAX) * ch;
			cctx.fillStyle = it.y > SLOW ? "#e06c6c" : it.y > 16.7 ? "#e2b45e" : "#6fd7ad";
			cctx.fillRect(x - 1, y - 1, 2.5, 2.5);
		}
		cctx.fillStyle = "#6e7681";
		cctx.font = "9px system-ui";
		cctx.fillText(lo.toFixed(lo < 10 ? 1 : 0), 2, ch - 3);
		const hiText = hi.toFixed(hi < 10 ? 1 : 0);
		cctx.fillText(hiText, cw - cctx.measureText(hiText).width - 2, ch - 3);
		cctx.fillText("32 ms", 2, Math.max(9, y32 - 2));
	}
	const held = mounted?.host.getElementsByClassName("sg-row").length ?? 0;
	const nodes = mounted?.scroll.getElementsByTagName("*").length ?? 0;
	const window = Math.max(1, filled);
	let sum = 0;
	let slow = 0;
	for (let i = 0; i < window; i++) {
		const at = gaps[i] ?? 0;
		sum += at;
		if (at > SLOW) slow += 1;
	}
	readout.innerHTML = `<b>${(1e3 / (sum / window)).toFixed(1)} fps</b> ${(sum / window).toFixed(1)} ms mean &middot; ${slow} slow of ${window} &middot; ${held} rows, ${nodes} nodes &middot; heap ${heapMb().toFixed(0)} MB &middot; ${rebuilds} rebuild${rebuilds === 1 ? "" : "s"}`;
}
var toggle = need("toggle");
toggle.addEventListener("click", () => {
	running = !running;
	toggle.textContent = running ? "pause" : "run";
});
rebuild();
paintRack();
requestAnimationFrame(frame);
//#endregion
