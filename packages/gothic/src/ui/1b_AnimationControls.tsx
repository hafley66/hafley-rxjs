
const BUTTON = "rounded border border-edge px-3 py-1.5 text-xs text-fg hover:bg-well focus-visible:outline-2 focus-visible:outline-ink"

export function AnimationControls({
  label, time, duration = 1, running, loop = true, onSeek, onToggle, onReplay, holdTitle = "Save this frame in the URL and selected named state",
}: {
  label: string
  time: number
  duration?: number
  running: boolean
  loop?: boolean
  holdTitle?: string
  onSeek(time: number): void
  onToggle(): void
  onReplay(): void
}) {
  return <div className="my-3 flex flex-wrap items-center gap-3" data-animation-controls={label}>
    <button className={BUTTON} title="Play or pause the current frame" onClick={onToggle}>{running ? "Pause" : !loop && time >= duration ? "Replay" : "Play"}</button>
    <input aria-label={`${label} time`} title="Scrub and hold a frame" className="min-w-20 flex-1 accent-ink" type="range" min="0" max={duration} step={duration / 1000 || 0.001} value={time} onChange={e => onSeek(Number(e.target.value))} />
    <output className="w-10 text-right font-mono text-[11px] text-muted">{Math.round(time / (duration || 1) * 100)}%</output>
    <button className={BUTTON} title={holdTitle} onClick={() => onSeek(time)}>Hold</button>
    <button className={BUTTON} title="Replay from the beginning" onClick={onReplay}>Restart</button>
  </div>
}
