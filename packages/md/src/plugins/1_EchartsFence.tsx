import { LineChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useMemo, useRef } from "react";
import { echartsOption, echartsTitle } from "./0_echartsOption.js";
import type { MdFenceProps } from "./0_types.js";

// Only the renderer the CSV contract needs: a line chart on a grid, with the tooltip, legend,
// title and both dataZoom flavours the sparkup options ask for. No bundle-wide `echarts` import.
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, TitleComponent, CanvasRenderer]);

const HEIGHT = 420;

export default function EchartsFence({ code, meta, dark }: MdFenceProps) {
  const host = useRef<HTMLDivElement>(null);
  const option = useMemo(() => echartsOption(code, echartsTitle(meta)), [code, meta]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const chart = echarts.init(element, dark ? "dark" : undefined);
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option, dark]);

  return <div className="mdview-echarts" ref={host} data-diagram-theme={dark ? "dark" : "light"} style={{ width: "100%", height: HEIGHT }} />;
}
