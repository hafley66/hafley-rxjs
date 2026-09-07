import { createRoot } from "react-dom/client"
import { App } from "./app/4_App.js"
import "./app.css"

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
