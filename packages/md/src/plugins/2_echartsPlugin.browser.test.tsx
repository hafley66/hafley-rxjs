import * as echarts from "echarts/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StreamdownBody from "../0_Streamdown.js";
import { installMdviewHost, type MdviewHost } from "../ports.js";
import { MdPluginContext } from "./4_MdPluginContext.js";
import { echartsPlugin } from "./echarts.js";
import "../mdview.css";

installMdviewHost({
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
} as unknown as MdviewHost);

const fence = "```";
const plugins = [echartsPlugin()];

// The sparkup telemetry CSV shape: epoch-second time column, one column per box, a gap in spark_2.
const CSV = [
  "time,spark_1,spark_2",
  "1790000000,61,58",
  "1790000300,72,",
  "1790000600,70,69",
  "1790000900,55,57",
].join("\n");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  host.style.width = "900px";
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

async function render(dark: boolean): Promise<HTMLElement> {
  const markdown = [`${fence}echarts title="gpu_temp_c"`, CSV, fence, ""].join("\n");
  await act(() => root.render(
    <MdPluginContext.Provider value={{ plugins, columns: 80 }}>
      <StreamdownBody components={{}} dark={dark}>{markdown}</StreamdownBody>
    </MdPluginContext.Provider>,
  ));
  await vi.waitFor(() => expect(host.querySelector(".mdview-echarts canvas")).not.toBeNull(), { timeout: 20_000 });
  return host.querySelector<HTMLElement>(".mdview-echarts")!;
}

/** What the mounted chart instance holds: the option echarts merged, read back from the instance. */
function chartState(element: HTMLElement) {
  const chart = echarts.getInstanceByDom(element);
  const option = chart?.getOption() as {
    title: { text: string }[];
    xAxis: { type: string; name: string }[];
    series: { name: string; type: string; data: [number, number | null][] }[];
  };
  return {
    title: option.title[0]?.text,
    xAxis: option.xAxis.map((axis) => `${axis.type} ${axis.name}`),
    series: option.series.map((series) => ({ name: series.name, type: series.type, data: series.data })),
    size: `${chart?.getWidth()}x${chart?.getHeight()}`,
  };
}

/** Pixels on the chart canvas that differ from its top-left pixel: zero means nothing was drawn. */
function paintedPixels(element: HTMLElement): number {
  const canvas = element.querySelector("canvas")!;
  const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  let painted = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2] || pixels[i + 3] !== pixels[3]) painted++;
  }
  return painted;
}

it("renders an echarts fence as a mounted line chart built from the CSV, and paints it", async () => {
  const element = await render(false);
  await vi.waitFor(() => expect(paintedPixels(element)).toBeGreaterThan(1000), { timeout: 10_000 });
  expect({ theme: element.dataset.diagramTheme, ...chartState(element) }).toMatchInlineSnapshot(`
    {
      "series": [
        {
          "data": [
            [
              1790000000000,
              61,
            ],
            [
              1790000300000,
              72,
            ],
            [
              1790000600000,
              70,
            ],
            [
              1790000900000,
              55,
            ],
          ],
          "name": "spark_1",
          "type": "line",
        },
        {
          "data": [
            [
              1790000000000,
              58,
            ],
            [
              1790000300000,
              null,
            ],
            [
              1790000600000,
              69,
            ],
            [
              1790000900000,
              57,
            ],
          ],
          "name": "spark_2",
          "type": "line",
        },
      ],
      "size": "900x420",
      "theme": "light",
      "title": "gpu_temp_c",
      "xAxis": [
        "time time",
      ],
    }
  `);
});

it("re-creates the chart on a dark toggle and disposes it on unmount", async () => {
  const light = await render(false);
  const lightChart = echarts.getInstanceByDom(light);
  const dark = await render(true);
  await vi.waitFor(() => expect(dark.dataset.diagramTheme).toBe("dark"));
  const darkChart = echarts.getInstanceByDom(dark);
  await act(() => root.unmount());
  root = createRoot(host);
  expect({
    sameElement: light === dark,
    newInstance: lightChart !== darkChart,
    lightDisposed: lightChart?.isDisposed(),
    darkDisposedOnUnmount: darkChart?.isDisposed(),
  }).toMatchInlineSnapshot(`
    {
      "darkDisposedOnUnmount": true,
      "lightDisposed": true,
      "newInstance": true,
      "sameElement": false,
    }
  `);
});
