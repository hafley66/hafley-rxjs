import { defineExtensionMessaging } from "@webext-core/messaging"
import type { DomCommand } from "../0_controls.js"

interface Messages {
  dom(command: DomCommand): unknown
  ready(): void
}
export const { sendMessage, onMessage } = defineExtensionMessaging<Messages>()
