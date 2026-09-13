import { i as mountBench, l as __toESM, n as DEFAULTS, o as setGridLogEmit, s as cellId, t as COLUMNS } from "./0_bench-CoT3Z-06.js";
import { a as require_react, t as Heavy } from "./2_heavy-5kugUYg1.js";
import { t as reactSlot } from "./react-BGNvf7iF.js";
//#region bench/scroll/chaos.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var must = (id) => {
	const found = document.getElementById(id);
	if (found === null) throw new Error(`chaos page has no #${id}`);
	return found;
};
var board = must("board");
var stage = must("stage");
var readout = must("readout");
var trace = must("trace");
var cfg = {
	...DEFAULTS,
	rows: 2e5,
	width: 1180,
	height: 620,
	cell: "heavy",
	src: "proxy"
};
var overscan = 4;
var jsx = reactSlot((ctx) => (0, import_react.createElement)(Heavy, {
	row: ctx.data,
	col: ctx.col
}));
var cells = "dom";
var mounted = mountBench(stage, cfg, { overscan: () => overscan });
var state = mounted.state;
function remount() {
	mounted.dispose();
	stage.replaceChildren();
	mounted = mountBench(stage, cfg, { overscan: () => overscan }, cells === "react" ? (ctx) => jsx({
		data: ctx.data,
		col: ctx.col,
		value: ctx.value
	}) : void 0);
	state = mounted.state;
}
var COL_IDS = COLUMNS.map((it) => it.id);
var tri = (phase) => phase < .5 ? phase * 2 : 2 - phase * 2;
/** Churn on: every driver rewrites its signal each frame with a fresh object that is equal to the
* one already there. Off: it writes only when the value changed, which is what an application does. */
var churn = false;
var setChurn = (on) => {
	churn = on;
};
var same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
var put = (signal, next) => {
	if (!churn && same(signal.$(), next)) return;
	signal.$(next);
};
var pick = (list, at) => list[at % list.length];
var SIDES = [
	"start",
	"end",
	void 0
];
var DENSITY = [
	"compact",
	"standard",
	"comfortable"
];
var KEYS = [
	"ArrowDown",
	"ArrowUp",
	"ArrowRight",
	"ArrowLeft",
	"Enter",
	"Escape",
	" "
];
var rowAtTop = () => Math.floor(mounted.scroll.scrollTop / 36);
var DRIVERS = [
	{
		name: "scroll",
		period: 97,
		every: "frame",
		run: (phase, at) => {
			const span = mounted.scroll.scrollHeight - mounted.scroll.clientHeight;
			const speed = 120 + tri(phase) * 760;
			const jump = at % 419 === 0;
			const next = jump ? Math.round(Math.random() * span) : mounted.scroll.scrollTop + (phase < .5 ? speed : -speed);
			mounted.scroll.scrollTop = Math.max(0, Math.min(span, next));
			return jump ? `jump ${Math.round(mounted.scroll.scrollTop)}` : `${Math.round(speed)} px/f`;
		}
	},
	{
		name: "box",
		period: 131,
		every: "frame",
		run: (phase) => {
			const wave = .72 + tri(phase) * .28;
			const w = Math.round(cfg.width * wave);
			const h = Math.round(cfg.height * (.8 + tri(phase) * .2));
			stage.style.inlineSize = `${w}px`;
			stage.style.blockSize = `${h}px`;
			return `${w}x${h}`;
		}
	},
	{
		name: "overscan",
		period: 53,
		every: "frame",
		run: (phase) => {
			overscan = Math.round(tri(phase) * 48);
			return String(overscan);
		}
	},
	{
		name: "density",
		period: 149,
		every: "period",
		run: (_phase, at) => {
			const next = pick(DENSITY, Math.floor(at / 149));
			put(state.density, next);
			return next;
		}
	},
	{
		name: "sort",
		period: 181,
		every: "period",
		run: (_phase, at) => {
			const step = Math.floor(at / 181) % (COL_IDS.length * 2 + 1);
			if (step === COL_IDS.length * 2) {
				put(state.sort, []);
				return "none";
			}
			const col = pick(COL_IDS, Math.floor(step / 2));
			const dir = step % 2 === 0 ? "asc" : "desc";
			put(state.sort, [{
				field: col,
				sort: dir
			}]);
			return `${col} ${dir}`;
		}
	},
	{
		name: "colWidth",
		period: 67,
		every: "frame",
		run: (phase, at) => {
			const col = pick(COL_IDS, Math.floor(at / 67));
			const width = Math.round(80 + tri(phase) * 220);
			put(state.colWidth, {
				...state.colWidth.$(),
				[col]: width
			});
			return `${col} ${width}`;
		}
	},
	{
		name: "colOrder",
		period: 211,
		every: "period",
		run: (_phase, at) => {
			const turn = Math.floor(at / 211) % COL_IDS.length;
			const next = [...COL_IDS.slice(turn), ...COL_IDS.slice(0, turn)];
			put(state.colOrder, next);
			return next.join(",");
		}
	},
	{
		name: "colPinning",
		period: 173,
		every: "period",
		run: (_phase, at) => {
			const turn = Math.floor(at / 173);
			const col = pick(COL_IDS, turn);
			const side = pick(SIDES, turn);
			const next = { ...state.colPinning.$() };
			if (side === void 0) delete next[col];
			else next[col] = side;
			put(state.colPinning, next);
			return side === void 0 ? `${col} free` : `${col} ${side}`;
		}
	},
	{
		name: "colHidden",
		period: 127,
		every: "period",
		run: (phase, at) => {
			const col = pick(COL_IDS, Math.floor(at / 127));
			const hide = phase < .35;
			const next = { ...state.colHidden.$() };
			if (hide) next[col] = true;
			else delete next[col];
			put(state.colHidden, next);
			return hide ? `${col} hidden` : "all shown";
		}
	},
	{
		name: "rowPinning",
		period: 191,
		every: "period",
		run: (_phase, at) => {
			const turn = Math.floor(at / 191) % 3;
			if (turn === 2) {
				put(state.rowPinning, {});
				return "none";
			}
			const base = turn * 1e3;
			const keys = [`r${base}`, `r${base + 1}`];
			put(state.rowPinning, Object.fromEntries(keys.map((k) => [k, turn === 0 ? "start" : "end"])));
			return `${keys.length} ${turn === 0 ? "start" : "end"}`;
		}
	},
	{
		name: "rowSelection",
		period: 29,
		every: "frame",
		run: (phase) => {
			const top = rowAtTop() + Math.round(tri(phase) * 12);
			const band = Object.fromEntries(Array.from({ length: 6 }, (_value, i) => [`r${top + i}`, true]));
			put(state.rowSelection, band);
			return `6 from r${top}`;
		}
	},
	{
		name: "range",
		period: 37,
		every: "frame",
		run: (phase) => {
			const top = rowAtTop() + Math.round(tri(phase) * 8);
			const wide = 1 + Math.round(tri(phase) * (COL_IDS.length - 1));
			const anchor = cellId(`r${top}`, pick(COL_IDS, 0));
			const head = cellId(`r${top + 3}`, pick(COL_IDS, wide - 1));
			put(state.selection, {
				anchor,
				head,
				mode: "cell",
				blocks: []
			});
			return `r${top} x ${wide}`;
		}
	},
	{
		name: "focus",
		period: 17,
		every: "frame",
		run: (phase, at) => {
			const top = rowAtTop() + Math.round(tri(phase) * 10);
			const id = cellId(`r${top}`, pick(COL_IDS, at));
			put(state.focus, id);
			return `r${top}`;
		}
	},
	{
		name: "listView",
		period: 233,
		every: "period",
		run: (phase) => {
			const on = phase > .78;
			put(state.listView, on);
			return on ? "on" : "off";
		}
	},
	{
		name: "hue",
		period: 71,
		every: "frame",
		run: (phase) => {
			const deg = Math.round(tri(phase) * 360);
			stage.style.setProperty("--sg-focus", `hsl(${deg} 80% 62%)`);
			stage.style.setProperty("--sg-selected-bg", `hsl(${deg} 40% 22%)`);
			return `${deg}deg`;
		}
	},
	{
		name: "events",
		period: 23,
		every: "period",
		run: (_phase, at) => {
			const cells = stage.getElementsByClassName("sg-cell");
			const target = cells[at % Math.max(1, cells.length)];
			if (!(target instanceof HTMLElement)) return "no cell";
			const opts = {
				bubbles: true,
				cancelable: true,
				composed: true
			};
			target.dispatchEvent(new PointerEvent("pointerdown", {
				...opts,
				button: 0,
				pointerId: 1
			}));
			target.dispatchEvent(new PointerEvent("pointerup", {
				...opts,
				button: 0,
				pointerId: 1
			}));
			target.dispatchEvent(new MouseEvent("click", {
				...opts,
				button: 0
			}));
			const key = pick(KEYS, Math.floor(at / 23));
			stage.dispatchEvent(new KeyboardEvent("keydown", {
				...opts,
				key
			}));
			return `click + ${key === " " ? "Space" : key}`;
		}
	}
];
var cards = /* @__PURE__ */ new Map();
var off = /* @__PURE__ */ new Set();
for (const driver of DRIVERS) {
	const card = document.createElement("div");
	card.className = "d-card";
	card.innerHTML = `<b>${driver.name}</b><span class="d-p">${driver.every === "frame" ? "1f" : `${driver.period}f`}</span><i class="d-v">idle</i>`;
	card.addEventListener("click", () => {
		if (off.has(driver.name)) off.delete(driver.name);
		else off.add(driver.name);
		card.classList.toggle("d-off", off.has(driver.name));
		at = 0;
		slow = 0;
		times.length = 0;
	});
	board.append(card);
	cards.set(driver.name, card.getElementsByClassName("d-v")[0]);
}
var pkgMs = 0;
var byStage = /* @__PURE__ */ new Map();
setGridLogEmit((category, _message, fields) => {
	const ms = typeof fields["durationMs"] === "number" ? fields["durationMs"] : 0;
	pkgMs += ms;
	const key = category[category.length - 1] ?? "?";
	byStage.set(key, (byStage.get(key) ?? 0) + ms);
});
var TRACE = 360;
var times = [];
var running = false;
var at = 0;
var frames = 0;
var slow = 0;
var since = performance.now();
var previous = performance.now();
var fps = 0;
var mean = 0;
var p95 = 0;
var pkgPerFrame = 0;
var stages = "";
var share = 0;
var ctx = trace.getContext("2d");
var paintTrace = () => {
	if (ctx === null) return;
	const w = trace.width;
	const h = trace.height;
	ctx.clearRect(0, 0, w, h);
	ctx.strokeStyle = "#2a2f36";
	for (const line of [
		8.3,
		16.6,
		33
	]) {
		const y = h - line / 50 * h;
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(w, y);
		ctx.stroke();
	}
	ctx.beginPath();
	for (const [i, ms] of times.entries()) {
		const x = i / TRACE * w;
		const y = h - Math.min(1, ms / 50) * h;
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.strokeStyle = "#6fd7ad";
	ctx.lineWidth = 1;
	ctx.stroke();
};
var mb = (bytes) => bytes === void 0 ? "n/a" : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
var paint = () => {
	const heap = performance.memory;
	const rows = stage.getElementsByClassName("sg-row").length;
	const nodes = stage.getElementsByTagName("*").length;
	const total = stage.getElementsByClassName("sg-cell").length;
	const filled = stage.querySelectorAll(".sg-cell .b-stack").length;
	const bare = total > 0 && filled * 4 < total;
	readout.innerHTML = `<b>${fps.toFixed(0)} fps</b> ${mean.toFixed(1)} ms mean, p95 ${p95.toFixed(1)} ms &middot; <b class="${slow === 0 ? "ok" : "bad"}">${slow}</b> frames over 32 ms of ${at} &middot; <b>package ${pkgPerFrame.toFixed(2)} ms/f</b>, ${share.toFixed(0)}% of the frame (${stages}) &middot; ${rows} rows, ${nodes} nodes &middot; <b class="${bare ? "bad" : "ok"}">${filled} of ${total}</b> cells filled &middot; <b>${cells === "react" ? "reactSlot" : "DOM"}</b> writer &middot; heap ${mb(heap?.usedJSHeapSize)}`;
};
var tick = (now) => {
	const gap = now - previous;
	previous = now;
	if (running) {
		times.push(gap);
		if (times.length > TRACE) times.shift();
		if (gap > 32) slow += 1;
		frames += 1;
		at += 1;
		for (const driver of DRIVERS) {
			if (off.has(driver.name)) continue;
			if (driver.every === "period" && at % driver.period !== 0) continue;
			const value = driver.run(at % driver.period / driver.period, at);
			const card = cards.get(driver.name);
			if (card !== void 0) card.textContent = value;
		}
	}
	if (now - since >= 500) {
		const window = times.slice(-120).sort((a, b) => a - b);
		fps = frames * 1e3 / (now - since);
		mean = window.reduce((carry, it) => carry + it, 0) / Math.max(1, window.length);
		p95 = window[Math.floor(window.length * .95)] ?? 0;
		pkgPerFrame = pkgMs / Math.max(1, frames);
		share = mean === 0 ? 0 : pkgPerFrame / mean * 100;
		stages = [...byStage].map(([name, ms]) => [name, ms / Math.max(1, frames)]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, ms]) => `${name} ${ms.toFixed(1)}`).join(", ");
		byStage.clear();
		pkgMs = 0;
		frames = 0;
		since = now;
		paint();
		paintTrace();
	}
	requestAnimationFrame(tick);
};
var toggle = must("toggle");
toggle.addEventListener("click", () => {
	running = !running;
	toggle.textContent = running ? "pause" : "run";
});
var cellsBox = must("cells");
cellsBox.addEventListener("change", () => {
	cells = cellsBox.checked ? "react" : "dom";
	remount();
	at = 0;
	slow = 0;
	times.length = 0;
});
var churnBox = must("churn");
churnBox.addEventListener("change", () => {
	setChurn(churnBox.checked);
	at = 0;
	slow = 0;
	times.length = 0;
});
must("reset").addEventListener("click", () => {
	at = 0;
	slow = 0;
	times.length = 0;
});
paint();
requestAnimationFrame(tick);
//#endregion
