// Shared by the parse snapshot and the browser test: two streams, group, complete, error, `^`,
// a legend, and an operator written as the derived lane's label.
export const marblesFenceBody = [
  "@title map(v => v * 10) throws on d",
  "@legend A=10 B=20 C=30",
  "",
  "source : -a-(bc)-d-|",
  "  map(v => v * 10) : ^A-(BC)-#",
].join("\n");
