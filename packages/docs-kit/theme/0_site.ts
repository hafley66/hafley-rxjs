// What a site tells the shared components about itself. Module-level rather than a prop: a markdown
// page writes `<Demo id="..."/>` with no route through which to hand a registry down.
import type { Example } from "../src/0_types.ts"
import type { Evaluated } from "../src/2_embeds.ts"
import type { SectionBuilder, Stats } from "../src/5_stats.ts"

export interface DemoHost {
  readonly byId: (id: string) => Example | undefined
  readonly evaluate: (code: string, source: string) => Evaluated
  /** Where a reader is told to look when an id matches nothing. */
  readonly registry: string
}

export interface ReceiptsHost {
  readonly stats: Stats
  readonly sections: Readonly<Record<string, SectionBuilder>>
}

let demos: DemoHost | null = null
let receipts: ReceiptsHost | null = null

export const useDemos = (host: DemoHost): void => {
  demos = host
}

export const demoHost = (): DemoHost | null => demos

export const useReceipts = (host: ReceiptsHost): void => {
  receipts = host
}

export const receiptsHost = (): ReceiptsHost | null => receipts
