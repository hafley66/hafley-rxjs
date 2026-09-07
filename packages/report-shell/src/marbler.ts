// Subpath entry `@hafley66/report-shell/marbler`: the two exports that import @hafley66/marbler (and with it pixi.js).
// Importing the root entry never pulls them in, so the marbler peer is optional.
export { EventsPanel, defaultEventDetail, type EventsPanelProps } from './components/EventsPanel'
export { syncMarbler } from './lib/marblerSync'
