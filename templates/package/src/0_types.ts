/** Options every entry point in this package resolves against. */
export interface __Ident__Options {
  /** Print each step to the console. */
  trace?: boolean
}

/** What a caller gets when they pass nothing. Every option is resolved here, so no call site defaults. */
export const defaults: Required<__Ident__Options> = { trace: false }
