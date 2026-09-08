import { createRoot } from "react-dom/client"
import { App } from "./app/4_App.js"
import { enableTips } from "./kit/6_tips.js"
import "@hafley66/report-shell/kit.css"
import "./app.css"

enableTips()
createRoot(document.getElementById("root") as HTMLElement).render(<App />)
