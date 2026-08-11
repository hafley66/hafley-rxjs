import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createMarbler } from "./1_model"
import { MarblerPanel } from "./2_Marbler"
import type { MarbleEvent } from "./0_types"

type EventTuple = [string, string, string, number, string, string, string, number, number, string, string, string, Array<["queue" | "send" | "wait" | "receive" | "work", number, number]>]

const tuples: EventTuple[] = [
  ["m-91f2","spawn research-lane","POST",202,"request","root","642 B",45,178,"root","research-lane","Inventory Chromium Network panel extraction seams",[["queue",45,62],["send",62,80],["wait",80,195],["receive",195,223]]],
  ["m-a4c8","search component candidates","TOOL",200,"tool","research-lane","1.1 kB",238,514,"research-lane","web","Search HAR waterfall and DevTools component packages",[["queue",238,250],["send",250,286],["wait",286,690],["receive",690,752]]],
  ["m-0d31","inspect @cloudflare/waterfall","GET",200,"tool","research-lane","8.4 kB",374,297,"research-lane","npm","Read package API, license, and render structure",[["queue",374,382],["send",382,405],["wait",405,614],["receive",614,671]]],
  ["m-ec77","inspect waterfall-tools","GET",200,"tool","research-lane","24.7 kB",512,621,"research-lane","github","Read canvas renderer and embedding API",[["queue",512,526],["send",526,559],["wait",559,1040],["receive",1040,1133]]],
  ["m-129a","summarize candidates","POST",200,"result","research-lane","2.2 kB",1182,332,"research-lane","root","Cloudflare web component and canvas renderer comparison",[["queue",1182,1195],["send",1195,1220],["work",1220,1442],["receive",1442,1514]]],
  ["m-5be0","spawn source-lane","POST",202,"request","root","590 B",310,164,"root","source-lane","Trace NetworkWaterfallColumn dependencies",[["queue",310,322],["send",322,341],["wait",341,438],["receive",438,474]]],
  ["m-bb42","read NetworkLogView.ts","GET",200,"tool","source-lane","31.2 kB",528,462,"source-lane","github","Locate data grid, filter, and waterfall ownership",[["queue",528,539],["send",539,572],["wait",572,901],["receive",901,990]]],
  ["m-724d","dependency map","POST",200,"result","source-lane","3.8 kB",1041,388,"source-lane","root","NetworkDataGridNode → TimeCalculator → WaterfallColumn",[["queue",1041,1053],["send",1053,1072],["work",1072,1360],["receive",1360,1429]]],
  ["m-a810","selection changed","NOTE",200,"note","marbler","184 B",1580,18,"marbler","ui","Selected m-129a",[["send",1580,1598]]],
  ["m-347c","render final panel","TOOL",200,"tool","root","18.6 kB",1652,794,"root","marbler","Compose grid rows, waterfall phases, and details",[["queue",1652,1672],["send",1672,1710],["work",1710,2352],["receive",2352,2446]]],
  ["m-f016","capture screenshot","GET",200,"result","marbler","486 kB",2470,156,"marbler","browser","PNG receipt at 1440 × 900",[["queue",2470,2482],["send",2482,2505],["wait",2505,2581],["receive",2581,2626]]],
]

const events: MarbleEvent[] = tuples.map(([id,name,method,status,type,initiator,size,start,duration,from,to,preview,phases]) => ({
  id, name, method, status, type, initiator, size, start, duration, from, to, preview,
  phases: phases.map(([kind, phaseStart, end]) => ({ kind, start: phaseStart, end })),
}))

const model = createMarbler(events)
createRoot(document.getElementById("root")!).render(<StrictMode><MarblerPanel model={model} /></StrictMode>)
