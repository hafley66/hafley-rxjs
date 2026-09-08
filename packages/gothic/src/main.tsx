import { createRoot } from "react-dom/client"
import { enableTips } from "@hafley66/report-shell"
import { App } from "./app/4_App.js"
import "@hafley66/report-shell/kit.css"
import "./app.css"

enableTips()
createRoot(document.getElementById("root") as HTMLElement).render(<App />)
