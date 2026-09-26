// Pure CSV -> ECharts option. No DOM and no echarts import: the fence and the node test both
// consume this, and the option shape is the CSV contract shared with
// ~/projects/sparkup/scripts/5_echarts_lines.py so the same CSV files drive both renderers.

export interface EchartsLineSeries {
  name: string;
  type: "line";
  showSymbol: boolean;
  connectNulls: false;
  data: readonly (readonly [number | string, number | null])[];
}

export interface EchartsOption {
  // ECharts options are open bags; the index signature lets this value reach `setOption` as-is.
  [key: string]: unknown;
  title?: { text: string; left: "center" };
  tooltip: { trigger: "axis" };
  legend: { top: number };
  grid: { top: number; left: number; right: number; bottom: number };
  dataZoom: readonly { type: "inside" | "slider" }[];
  xAxis: { type: "time" | "value" | "category"; name: string };
  yAxis: { type: "value"; scale: true };
  series: readonly EchartsLineSeries[];
}

/** The `title="..."` attribute of a fence meta string, or "" when absent. */
export function echartsTitle(meta: string | undefined): string {
  const match = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta ?? "");
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

/** One CSV record. Quotes wrap a cell and `""` is a literal quote, as `csv.reader` reads it. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (quoted) {
      if (character !== '"') cell += character;
      else if (line[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === ",") { cells.push(cell); cell = ""; }
    else cell += character;
  }
  cells.push(cell);
  return cells;
}

function csvRows(code: string): string[][] {
  return code
    .replace(/\r?\n$/, "")
    .split(/\r?\n/)
    .filter((line) => line !== "")
    .map(splitCsvLine);
}

function numberOrNull(raw: string): number | null {
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Epoch seconds become ms; ISO becomes ms; a non-numeric x stays a string for a category axis. */
function xValue(raw: string, isTime: boolean): number | string {
  if (!isTime) return numberOrNull(raw) ?? raw;
  const seconds = numberOrNull(raw);
  if (seconds !== null) return seconds * 1000;
  const iso = Date.parse(raw);
  return Number.isNaN(iso) ? raw : iso;
}

export function echartsOption(code: string, title = ""): EchartsOption {
  const trimmed = code.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as EchartsOption;

  const [header = [], ...body] = csvRows(code);
  const isTime = header[0] === "time";
  const xs = body.map((row) => xValue(row[0] ?? "", isTime));
  const numericX = xs.every((x) => typeof x === "number");
  const series: EchartsLineSeries[] = header.slice(1).map((name, index) => ({
    name,
    type: "line",
    showSymbol: body.length <= 40,
    connectNulls: false,
    data: body.map((row, at) => [xs[at], numberOrNull(row[index + 1] ?? "")] as const),
  }));

  return {
    title: { text: title, left: "center" },
    tooltip: { trigger: "axis" },
    legend: { top: 28 },
    grid: { top: 70, left: 60, right: 30, bottom: 60 },
    dataZoom: [{ type: "inside" }, { type: "slider" }],
    xAxis: { type: isTime ? "time" : numericX ? "value" : "category", name: header[0] ?? "" },
    yAxis: { type: "value", scale: true },
    series,
  };
}
