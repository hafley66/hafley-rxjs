import { i as setGridLogEmit, r as mountBench, t as DEFAULTS } from "./0_bench-CSCYsUzo.js";
//#region bench/scroll/gallery.ts
var cfg = (patch) => ({
	...DEFAULTS,
	rows: 1e5,
	width: 520,
	height: 300,
	...patch
});
var TILES = [
	{
		label: "baseline",
		note: "100k rows, heavy cells, overscan 4",
		cfg: cfg({})
	},
	{
		label: "plain cells",
		note: "one text node per cell",
		cfg: cfg({ cell: "plain" })
	},
	{
		label: "overscan 0",
		note: "no buffer past the viewport",
		cfg: cfg({ overscan: 0 })
	},
	{
		label: "overscan 96",
		note: "the buffer that breaks the frame",
		cfg: cfg({ overscan: 96 })
	},
	{
		label: "overscan 96 + content-visibility",
		note: "the only cell the property rescues",
		cfg: cfg({
			overscan: 96,
			cv: 1
		})
	},
	{
		label: "varied row heights",
		note: "a declared height for every row",
		cfg: cfg({ extent: "varied" })
	},
	{
		label: "1M rows",
		note: "ten times the relation, same window",
		cfg: cfg({ rows: 1e6 })
	},
	{
		label: "small box",
		note: "320 x 190 viewport",
		cfg: cfg({
			width: 320,
			height: 190
		})
	},
	{
		label: "large box",
		note: "900 x 420 viewport",
		cfg: cfg({
			width: 900,
			height: 420
		})
	},
	{
		label: "resizing box",
		note: "the grid itself changing size every frame",
		cfg: cfg({ resize: 1 })
	}
];
var el = (tag, cls) => {
	const node = document.createElement(tag);
	node.className = cls;
	return node;
};
var boardFound = document.getElementById("board");
var readoutFound = document.getElementById("readout");
if (boardFound === null || readoutFound === null) throw new Error("gallery page has no #board or #readout");
var board = boardFound;
var readout = readoutFound;
var live = [];
var solo = null;
for (const tile of TILES) {
	const card = el("section", "b-card");
	const head = el("header", "b-head");
	head.innerHTML = `<b>${tile.label}</b><span>${tile.note}</span>`;
	const host = el("div", "b-host");
	const stats = el("div", "b-stats");
	card.append(head, host, stats);
	board.append(card);
	const index = live.length;
	head.addEventListener("click", () => {
		solo = solo === index ? null : index;
		for (const [i, it] of live.entries()) it.card.classList.toggle("b-dim", solo !== null && solo !== i);
	});
	live.push({
		tile,
		mounted: mountBench(host, tile.cfg),
		stats,
		card
	});
}
var cost = /* @__PURE__ */ new Map();
setGridLogEmit((_category, _message, fields) => {
	const id = String(fields["id"] ?? "");
	const ms = typeof fields["durationMs"] === "number" ? fields["durationMs"] : 0;
	cost.set(id, (cost.get(id) ?? 0) + ms);
});
var memory = () => performance.memory ?? {};
var mb = (bytes) => bytes === void 0 ? "n/a" : (bytes / 1024 ** 2).toFixed(1) + " MB";
var SPEED = 60;
var running = false;
var at = 0;
var frames = 0;
var since = performance.now();
var fps = 0;
var worst = 0;
var previous = performance.now();
var tick = (now) => {
	const gap = now - previous;
	previous = now;
	if (running) {
		if (gap > worst) worst = gap;
		for (const [i, it] of live.entries()) if (solo === null || solo === i) it.mounted.step(SPEED, at);
		at += 1;
		frames += 1;
	}
	if (now - since >= 1e3) {
		fps = frames * 1e3 / (now - since);
		paint();
		frames = 0;
		since = now;
		worst = 0;
		cost.clear();
	}
	requestAnimationFrame(tick);
};
function paint() {
	const heap = memory();
	const nodes = document.getElementsByTagName("*").length;
	readout.innerHTML = `<b>${fps.toFixed(1)} fps</b> worst frame ${worst.toFixed(1)} ms &middot; heap ${mb(heap.usedJSHeapSize)} of ${mb(heap.jsHeapSizeLimit)} &middot; ${nodes} nodes on the page &middot; ${solo === null ? `${live.length} grids` : `solo: ${live[solo]?.tile.label ?? ""}`}`;
	for (const it of live) {
		const rows = it.mounted.host.getElementsByClassName("sg-row").length;
		const count = it.mounted.scroll.getElementsByTagName("*").length;
		const ms = cost.get(it.mounted.id) ?? 0;
		const share = Math.min(100, ms / Math.max(1, fps) * 100);
		it.stats.innerHTML = `<span>${rows} rows</span><span>${count} nodes</span><span>${(ms / Math.max(1, fps)).toFixed(2)} ms/f</span><span class="b-bar"><i style="inline-size:${share.toFixed(0)}%"></i></span>`;
	}
}
var toggle = document.getElementById("toggle");
if (toggle !== null) toggle.addEventListener("click", () => {
	running = !running;
	toggle.textContent = running ? "pause" : "run";
});
requestAnimationFrame(tick);
//#endregion
