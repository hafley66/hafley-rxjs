import StreamdownBody from "./0_Streamdown.js";
import { defaultMdPlugins } from "./plugins/3_defaultMdPlugins.js";
import { MdPluginContext } from "./plugins/4_MdPluginContext.js";

export function MarkdownBody({ source, dark }: { source: string; dark: boolean }) {
  return (
    <MdPluginContext.Provider value={{ plugins: defaultMdPlugins, columns: 80 }}>
      <StreamdownBody components={{}} dark={dark}>{source}</StreamdownBody>
    </MdPluginContext.Provider>
  );
}
