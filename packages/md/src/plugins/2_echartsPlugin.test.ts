import { expect, it } from "vitest";
import { echartsOption, echartsTitle } from "./0_echartsOption.js";

// The sparkup 5_echarts_lines.py CSV contract: first column is x, the rest are line series.
const sample = [
  "time,spark_1,spark_2",
  "1790353200,46.85,45.85",
  "1790353500,46.85,45.95",
].join("\n");

it("turns the sparkup time CSV into the shared ECharts option", () => {
  expect(echartsOption(sample, "ec temp")).toMatchInlineSnapshot(`
    {
      "dataZoom": [
        {
          "type": "inside",
        },
        {
          "type": "slider",
        },
      ],
      "grid": {
        "bottom": 60,
        "left": 60,
        "right": 30,
        "top": 70,
      },
      "legend": {
        "top": 28,
      },
      "series": [
        {
          "connectNulls": false,
          "data": [
            [
              1790353200000,
              46.85,
            ],
            [
              1790353500000,
              46.85,
            ],
          ],
          "name": "spark_1",
          "showSymbol": true,
          "type": "line",
        },
        {
          "connectNulls": false,
          "data": [
            [
              1790353200000,
              45.85,
            ],
            [
              1790353500000,
              45.95,
            ],
          ],
          "name": "spark_2",
          "showSymbol": true,
          "type": "line",
        },
      ],
      "title": {
        "left": "center",
        "text": "ec temp",
      },
      "tooltip": {
        "trigger": "axis",
      },
      "xAxis": {
        "name": "time",
        "type": "time",
      },
      "yAxis": {
        "scale": true,
        "type": "value",
      },
    }
  `);
});

it("gives a numeric x a value axis and an empty cell a null gap", () => {
  expect(echartsOption(["x,temperature", "1,20", "2,", "3,21"].join("\n"))).toMatchInlineSnapshot(`
    {
      "dataZoom": [
        {
          "type": "inside",
        },
        {
          "type": "slider",
        },
      ],
      "grid": {
        "bottom": 60,
        "left": 60,
        "right": 30,
        "top": 70,
      },
      "legend": {
        "top": 28,
      },
      "series": [
        {
          "connectNulls": false,
          "data": [
            [
              1,
              20,
            ],
            [
              2,
              null,
            ],
            [
              3,
              21,
            ],
          ],
          "name": "temperature",
          "showSymbol": true,
          "type": "line",
        },
      ],
      "title": {
        "left": "center",
        "text": "",
      },
      "tooltip": {
        "trigger": "axis",
      },
      "xAxis": {
        "name": "x",
        "type": "value",
      },
      "yAxis": {
        "scale": true,
        "type": "value",
      },
    }
  `);
});

it("gives a non-numeric x a category axis", () => {
  expect(echartsOption(["station,temperature", "alpha,20", "beta,21"].join("\n"))).toMatchInlineSnapshot(`
    {
      "dataZoom": [
        {
          "type": "inside",
        },
        {
          "type": "slider",
        },
      ],
      "grid": {
        "bottom": 60,
        "left": 60,
        "right": 30,
        "top": 70,
      },
      "legend": {
        "top": 28,
      },
      "series": [
        {
          "connectNulls": false,
          "data": [
            [
              "alpha",
              20,
            ],
            [
              "beta",
              21,
            ],
          ],
          "name": "temperature",
          "showSymbol": true,
          "type": "line",
        },
      ],
      "title": {
        "left": "center",
        "text": "",
      },
      "tooltip": {
        "trigger": "axis",
      },
      "xAxis": {
        "name": "station",
        "type": "category",
      },
      "yAxis": {
        "scale": true,
        "type": "value",
      },
    }
  `);
});

it("passes a raw ECharts option JSON through", () => {
  expect(echartsOption('{"series":[{"type":"line","data":[1,2,3]}]}')).toMatchInlineSnapshot(`
    {
      "series": [
        {
          "data": [
            1,
            2,
            3,
          ],
          "type": "line",
        },
      ],
    }
  `);
});

it("reads the title from the fence meta", () => {
  expect(echartsTitle('title="ec temp"')).toBe("ec temp");
  expect(echartsTitle("title='ec temp' other=1")).toBe("ec temp");
  expect(echartsTitle(undefined)).toBe("");
});
