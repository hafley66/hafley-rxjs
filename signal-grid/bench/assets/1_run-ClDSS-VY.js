var heap = () => performance.memory?.usedJSHeapSize ?? 0;
/** Milliseconds from navigation start to the first rendered row, resolved on the frame the row
* exists. Called at module scope on each page, so a synchronous mount resolves at once. */
var firstRowAt = (selector) => new Promise((resolve) => {
	const tick = () => {
		if (document.querySelector(selector) !== null) resolve(performance.now());
		else requestAnimationFrame(tick);
	};
	tick();
});
/** `warm` frames discarded, then `frames` measured at 240 px each, reversing at either end. Without
* the reversal a short scroller reports the frame cost of scrolling nothing. */
async function burst(spec) {
	spec.stages?.start();
	const gaps = [];
	let previous = performance.now();
	let step = 0;
	let heapWarm = 0;
	let way = 1;
	await new Promise((resolve) => {
		const tick = (now) => {
			gaps.push(now - previous);
			previous = now;
			const box = spec.scroll();
			if (way > 0 && box.scrollTop + box.clientHeight >= box.scrollHeight - 1) way = -1;
			else if (way < 0 && box.scrollTop <= 0) way = 1;
			spec.step(240 * way, step);
			step += 1;
			if (step === spec.warm) {
				spec.stages?.reset();
				heapWarm = heap();
			}
			if (step < spec.warm + spec.frames) requestAnimationFrame(tick);
			else resolve();
		};
		requestAnimationFrame(tick);
	});
	const stages = spec.stages?.stop() ?? [];
	const measured = gaps.slice(spec.warm);
	const sorted = [...measured].sort((a, b) => a - b);
	return {
		frames: measured.length,
		p50: sorted[Math.floor(sorted.length * .5)] ?? 0,
		p95: sorted[Math.floor(sorted.length * .95)] ?? 0,
		worst: sorted[sorted.length - 1] ?? 0,
		slow: measured.filter((it) => it > 32).length,
		held: spec.held(),
		nodes: spec.scroll().getElementsByTagName("*").length,
		styleBytes: spec.styleBytes(),
		heapWarm,
		heapEnd: heap(),
		stages
	};
}
//#endregion
export { firstRowAt as n, burst as t };
