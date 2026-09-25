import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { of } from "rxjs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StreamdownBody from "./0_Streamdown.js";
import { commandPlugin, defaultMdPlugins, tablePlugin, type MdFenceCommandRequest, type MdFenceProps, type MdPlugin } from "./plugins/index.js";
import { MdPluginContext, type MdPluginScope } from "./plugins/4_MdPluginContext.js";
import { installMdviewHost, type MdviewHost } from "./ports.js";
import "./mdview.css";

installMdviewHost({
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
} as unknown as MdviewHost);

const fence = "```";
const markdown = [
  `${fence}shout`,
  "hello plugins",
  fence,
  "",
  "| name | kind |",
  "| --- | --- |",
  "| a | b |",
  "",
  `${fence}ts`,
  "const a={b:1}",
  fence,
  "",
].join("\n");

const Shout = ({ code, language, dark }: MdFenceProps) => <p data-shout="first">{`${language}:${dark}:${code.toUpperCase()}`}</p>;
const Whisper = ({ code }: MdFenceProps) => <p data-shout="second">{code.toLowerCase()}</p>;
const shoutPlugin = (): MdPlugin => ({ name: "shout", fence: { languages: ["shout"], component: Shout } });
const whisperPlugin = (): MdPlugin => ({ name: "whisper", fence: { languages: ["shout"], component: Whisper } });

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

async function render(scope: MdPluginScope | null, text = markdown): Promise<void> {
  const body = <StreamdownBody components={{}} dark>{text}</StreamdownBody>;
  const tree: ReactNode = scope ? <MdPluginContext.Provider value={scope}>{body}</MdPluginContext.Provider> : body;
  await act(() => root.render(tree));
}

function shape() {
  return {
    shout: [...host.querySelectorAll<HTMLElement>("[data-shout]")].map((node) => `${node.dataset.shout} ${node.textContent}`),
    codeBlocks: [...host.querySelectorAll('[data-streamdown="code-block"] code')].map((node) => node.textContent),
    persistedTables: host.querySelectorAll(".mdview-table").length,
    tables: host.querySelectorAll("table").length,
  };
}

it("renders a custom plugin's fence language, and only the slots the array holds", async () => {
  await render({ plugins: [shoutPlugin()], columns: 80 });
  await vi.waitFor(() => expect(host.querySelectorAll("[data-shout]")).toHaveLength(1));
  expect(shape()).toMatchInlineSnapshot(`
    {
      "codeBlocks": [
        "const a={b:1}",
      ],
      "persistedTables": 0,
      "shout": [
        "first shout:true:HELLO PLUGINS
    ",
      ],
      "tables": 1,
    }
  `);
});

it("keeps the default array's table and highlighted code when the host gives none", async () => {
  await render(null);
  await vi.waitFor(() => expect(host.querySelectorAll('code span[style*="--sdm-c"]')).not.toHaveLength(0));
  const implicit = shape();
  await render({ plugins: defaultMdPlugins, columns: 80 });
  expect({ implicit, explicit: shape() }).toMatchInlineSnapshot(`
    {
      "explicit": {
        "codeBlocks": [
          "hello plugins",
          "const a={b:1}",
        ],
        "persistedTables": 1,
        "shout": [],
        "tables": 0,
      },
      "implicit": {
        "codeBlocks": [
          "hello plugins",
          "const a={b:1}",
        ],
        "persistedTables": 1,
        "shout": [],
        "tables": 0,
      },
    }
  `);
});

it("gives a fence to the earliest plugin that claims its language", async () => {
  await render({ plugins: [shoutPlugin(), whisperPlugin()], columns: 80 });
  await vi.waitFor(() => expect(host.querySelectorAll("[data-shout]")).toHaveLength(1));
  const shoutFirst = shape().shout;
  await render({ plugins: [whisperPlugin(), shoutPlugin()], columns: 80 });
  await vi.waitFor(() => expect(host.querySelector("[data-shout]")?.getAttribute("data-shout")).toBe("second"));
  expect({ shoutFirst, whisperFirst: shape().shout }).toMatchInlineSnapshot(`
    {
      "shoutFirst": [
        "first shout:true:HELLO PLUGINS
    ",
      ],
      "whisperFirst": [
        "second hello plugins
    ",
      ],
    }
  `);
});

it("runs command plugins through the host runner, and renders fences as written without one", async () => {
  const requests: MdFenceCommandRequest[] = [];
  const plugins = [
    commandPlugin({ match: "^(ts|shout)$", command: "fmt --width $WIDTH", as: "replace" }),
    shoutPlugin(),
    tablePlugin(),
  ];
  await render({ plugins, columns: 80 });
  const written = shape();
  await render({
    plugins,
    columns: 64,
    runCommand: (request) => {
      requests.push(request);
      return of({ stdout: `${request.text.trim()} /* ${request.columns} cols */\n`, stderr: "", code: 0 });
    },
  });
  await vi.waitFor(() => expect(shape().codeBlocks[0]).toContain("cols"));
  expect({ written, formatted: shape(), requests }).toMatchInlineSnapshot(`
    {
      "formatted": {
        "codeBlocks": [
          "const a={b:1} /* 64 cols */",
        ],
        "persistedTables": 1,
        "shout": [
          "first shout:true:HELLO PLUGINS /* 64 COLS */
    ",
        ],
        "tables": 0,
      },
      "requests": [
        {
          "columns": 64,
          "command": "fmt --width $WIDTH",
          "language": "shout",
          "text": "hello plugins
    ",
        },
        {
          "columns": 64,
          "command": "fmt --width $WIDTH",
          "language": "ts",
          "text": "const a={b:1}
    ",
        },
      ],
      "written": {
        "codeBlocks": [
          "const a={b:1}",
        ],
        "persistedTables": 1,
        "shout": [
          "first shout:true:HELLO PLUGINS
    ",
        ],
        "tables": 0,
      },
    }
  `);
});
