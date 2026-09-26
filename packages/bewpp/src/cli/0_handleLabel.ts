/** Bijective base-26: 0->A ... 25->Z, 26->AA, 27->AB, matching spreadsheet column names. */
export function handleLabel(index: number): string {
  let n = index + 1
  let label = ""
  while (n > 0) {
    const remainder = (n - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

export class HandleAssigner {
  #count = 0
  next(): string {
    return handleLabel(this.#count++)
  }
}
