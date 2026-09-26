export function bracketedPaste(body: string): string {
  const text = body
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x09\x0b-\x1f\x7f]+/g, " ");
  return `\x1b[200~${text}\x1b[201~`;
}

