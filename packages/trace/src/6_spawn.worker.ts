import { ident } from "./1_ident.js"

;(globalThis as unknown as { postMessage: (message: unknown) => void }).postMessage(ident())
