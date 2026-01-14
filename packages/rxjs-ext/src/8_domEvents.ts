import { Observable } from "rxjs"

export const HEvents = [
  "abort",
  "animationcancel",
  "animationend",
  "animationiteration",
  "animationstart",
  "auxclick",
  "beforeinput",
  "beforetoggle",
  "blur",
  "cancel",
  "canplay",
  "canplaythrough",
  "change",
  "click",
  "close",
  "contextlost",
  "contextmenu",
  "contextrestored",
  "copy",
  "cuechange",
  "cut",
  "dblclick",
  "drag",
  "dragend",
  "dragenter",
  "dragleave",
  "dragover",
  "dragstart",
  "drop",
  "durationchange",
  "emptied",
  "ended",
  "error",
  "focus",
  "formdata",
  "gotpointercapture",
  "input",
  "invalid",
  "keydown",
  "keypress",
  "keyup",
  "load",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "lostpointercapture",
  "mousedown",
  "mouseenter",
  "mouseleave",
  "mousemove",
  "mouseout",
  "mouseover",
  "mouseup",
  "paste",
  "pause",
  "play",
  "playing",
  "pointercancel",
  "pointerdown",
  "pointerenter",
  "pointerleave",
  "pointermove",
  "pointerout",
  "pointerover",
  "pointerup",
  "progress",
  "ratechange",
  "reset",
  "resize",
  "scroll",
  "scrollend",
  "securitypolicyviolation",
  "seeked",
  "seeking",
  "select",
  "selectionchange",
  "selectstart",
  "slotchange",
  "stalled",
  "submit",
  "suspend",
  "timeupdate",
  "toggle",
  "touchcancel",
  "touchend",
  "touchmove",
  "touchstart",
  "transitioncancel",
  "transitionend",
  "transitionrun",
  "transitionstart",
  "volumechange",
  "waiting",
  "webkitanimationend",
  "webkitanimationiteration",
  "webkitanimationstart",
  "webkittransitionend",
  "wheel",
] as const

export type HtmlEvent = (typeof HEvents)[number]
export const HEVENTS = new Set(HEvents)

export type DelegatedObservable<Event> = Observable<
  Event & {
    delegateElement: HTMLElement
  }
>

export type HtmlEventIndex$ = {
  abort: DelegatedObservable<UIEvent>
  animationcancel: DelegatedObservable<AnimationEvent>
  animationend: DelegatedObservable<AnimationEvent>
  animationiteration: DelegatedObservable<AnimationEvent>
  animationstart: DelegatedObservable<AnimationEvent>
  auxclick: DelegatedObservable<MouseEvent>
  beforeinput: DelegatedObservable<InputEvent>
  beforetoggle: DelegatedObservable<Event>
  blur: DelegatedObservable<FocusEvent>
  cancel: DelegatedObservable<Event>
  canplay: DelegatedObservable<Event>
  canplaythrough: DelegatedObservable<Event>
  change: DelegatedObservable<Event>
  click: DelegatedObservable<MouseEvent>
  close: DelegatedObservable<Event>
  compositionend: DelegatedObservable<CompositionEvent>
  compositionstart: DelegatedObservable<CompositionEvent>
  compositionupdate: DelegatedObservable<CompositionEvent>
  contextlost: DelegatedObservable<Event>
  contextmenu: DelegatedObservable<MouseEvent>
  contextrestored: DelegatedObservable<Event>
  copy: DelegatedObservable<ClipboardEvent>
  cuechange: DelegatedObservable<Event>
  cut: DelegatedObservable<ClipboardEvent>
  dblclick: DelegatedObservable<MouseEvent>
  drag: DelegatedObservable<DragEvent>
  dragend: DelegatedObservable<DragEvent>
  dragenter: DelegatedObservable<DragEvent>
  dragleave: DelegatedObservable<DragEvent>
  dragover: DelegatedObservable<DragEvent>
  dragstart: DelegatedObservable<DragEvent>
  drop: DelegatedObservable<DragEvent>
  durationchange: DelegatedObservable<Event>
  emptied: DelegatedObservable<Event>
  ended: DelegatedObservable<Event>
  error: DelegatedObservable<ErrorEvent>
  focus: DelegatedObservable<FocusEvent>
  focusin: DelegatedObservable<FocusEvent>
  focusout: DelegatedObservable<FocusEvent>
  formdata: DelegatedObservable<FormDataEvent>
  gotpointercapture: DelegatedObservable<PointerEvent>
  input: DelegatedObservable<Event>
  invalid: DelegatedObservable<Event>
  keydown: DelegatedObservable<KeyboardEvent>
  keypress: DelegatedObservable<KeyboardEvent>
  keyup: DelegatedObservable<KeyboardEvent>
  load: DelegatedObservable<Event>
  loadeddata: DelegatedObservable<Event>
  loadedmetadata: DelegatedObservable<Event>
  loadstart: DelegatedObservable<Event>
  lostpointercapture: DelegatedObservable<PointerEvent>
  mousedown: DelegatedObservable<MouseEvent>
  mouseenter: DelegatedObservable<MouseEvent>
  mouseleave: DelegatedObservable<MouseEvent>
  mousemove: DelegatedObservable<MouseEvent>
  mouseout: DelegatedObservable<MouseEvent>
  mouseover: DelegatedObservable<MouseEvent>
  mouseup: DelegatedObservable<MouseEvent>
  paste: DelegatedObservable<ClipboardEvent>
  pause: DelegatedObservable<Event>
  play: DelegatedObservable<Event>
  playing: DelegatedObservable<Event>
  pointercancel: DelegatedObservable<PointerEvent>
  pointerdown: DelegatedObservable<PointerEvent>
  pointerenter: DelegatedObservable<PointerEvent>
  pointerleave: DelegatedObservable<PointerEvent>
  pointermove: DelegatedObservable<PointerEvent>
  pointerout: DelegatedObservable<PointerEvent>
  pointerover: DelegatedObservable<PointerEvent>
  pointerup: DelegatedObservable<PointerEvent>
  progress: DelegatedObservable<ProgressEvent>
  ratechange: DelegatedObservable<Event>
  reset: DelegatedObservable<Event>
  resize: DelegatedObservable<UIEvent>
  scroll: DelegatedObservable<Event>
  scrollend: DelegatedObservable<Event>
  securitypolicyviolation: DelegatedObservable<SecurityPolicyViolationEvent>
  seeked: DelegatedObservable<Event>
  seeking: DelegatedObservable<Event>
  select: DelegatedObservable<Event>
  selectionchange: DelegatedObservable<Event>
  selectstart: DelegatedObservable<Event>
  slotchange: DelegatedObservable<Event>
  stalled: DelegatedObservable<Event>
  submit: DelegatedObservable<SubmitEvent>
  suspend: DelegatedObservable<Event>
  timeupdate: DelegatedObservable<Event>
  toggle: DelegatedObservable<Event>
  touchcancel: DelegatedObservable<TouchEvent>
  touchend: DelegatedObservable<TouchEvent>
  touchmove: DelegatedObservable<TouchEvent>
  touchstart: DelegatedObservable<TouchEvent>
  transitioncancel: DelegatedObservable<TransitionEvent>
  transitionend: DelegatedObservable<TransitionEvent>
  transitionrun: DelegatedObservable<TransitionEvent>
  transitionstart: DelegatedObservable<TransitionEvent>
  volumechange: DelegatedObservable<Event>
  waiting: DelegatedObservable<Event>
  webkitanimationend: DelegatedObservable<Event>
  webkitanimationiteration: DelegatedObservable<Event>
  webkitanimationstart: DelegatedObservable<Event>
  webkittransitionend: DelegatedObservable<Event>
  wheel: DelegatedObservable<WheelEvent>
}
