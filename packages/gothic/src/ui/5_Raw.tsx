import type { ReactNode } from "react"

// generator output is an svg markup string; React only places it
export function Raw({ html, className }: { html: string; className?: string }): ReactNode {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: the generators emit svg source, never user input
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
