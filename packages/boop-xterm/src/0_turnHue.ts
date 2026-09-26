/** Stable turn id -> hue, so one turn keeps one colour across repaints and
 *  neighbouring turn numbers land far apart on the wheel. */
export function turnHue(turnId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < turnId.length; index++) {
    hash ^= turnId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) * 137) % 360;
}
