import * as rxjs from "rxjs"
import * as rx from "rxjs/operators"
import { decorateCreate, decorateOperatorFun } from "./01.patch-observable"

// =============================================================================
// CREATION OPERATORS (decorateCreate) - from main rxjs
// =============================================================================

export const animationFrames = decorateCreate(rxjs.animationFrames, "animationFrames")
export const bindCallback = decorateCreate(rxjs.bindCallback, "bindCallback")
export const bindNodeCallback = decorateCreate(rxjs.bindNodeCallback, "bindNodeCallback")
export const combineLatest = decorateCreate(rxjs.combineLatest, "combineLatest")
export const concat = decorateCreate(rxjs.concat, "concat")
export const connectable = decorateCreate(rxjs.connectable, "connectable")
export const defer = decorateCreate(rxjs.defer, "defer")
export const forkJoin = decorateCreate(rxjs.forkJoin, "forkJoin")
export const from = decorateCreate(rxjs.from, "from")
export const fromEvent = decorateCreate(rxjs.fromEvent, "fromEvent")
export const fromEventPattern = decorateCreate(rxjs.fromEventPattern, "fromEventPattern")
export const generate = decorateCreate(rxjs.generate, "generate")
export const iif = decorateCreate(rxjs.iif, "iif")
export const interval = decorateCreate(rxjs.interval, "interval")
export const merge = decorateCreate(rxjs.merge, "merge")
export const of = decorateCreate(rxjs.of, "of")
export const partition = decorateCreate(rxjs.partition, "partition")
export const race = decorateCreate(rxjs.race, "race")
export const range = decorateCreate(rxjs.range, "range")
export const scheduled = decorateCreate(rxjs.scheduled, "scheduled")
export const throwError = decorateCreate(rxjs.throwError, "throwError")
export const timer = decorateCreate(rxjs.timer, "timer")
export const using = decorateCreate(rxjs.using, "using")
export const zip = decorateCreate(rxjs.zip, "zip")

// =============================================================================
// PIPEABLE OPERATORS (decorateOperatorFun) - from rxjs/operators
// =============================================================================

// Audit/Sample
export const audit = decorateOperatorFun(rx.audit)
export const auditTime = decorateOperatorFun(rx.auditTime)
export const sample = decorateOperatorFun(rx.sample)
export const sampleTime = decorateOperatorFun(rx.sampleTime)

// Buffer
export const buffer = decorateOperatorFun(rx.buffer)
export const bufferCount = decorateOperatorFun(rx.bufferCount)
export const bufferTime = decorateOperatorFun(rx.bufferTime)
export const bufferToggle = decorateOperatorFun(rx.bufferToggle)
export const bufferWhen = decorateOperatorFun(rx.bufferWhen)

// Error handling
export const catchError = decorateOperatorFun(rx.catchError)
export const retry = decorateOperatorFun(rx.retry)
export const retryWhen = decorateOperatorFun(rx.retryWhen)
export const onErrorResumeNext = decorateOperatorFun(rx.onErrorResumeNext)

// Combine/Join
export const combineAll = decorateOperatorFun(rx.combineAll)
export const combineLatestAll = decorateOperatorFun(rx.combineLatestAll)
export const combineLatestWith = decorateOperatorFun(rx.combineLatestWith)
export const concatAll = decorateOperatorFun(rx.concatAll)
export const concatMap = decorateOperatorFun(rx.concatMap)
export const concatMapTo = decorateOperatorFun(rx.concatMapTo)
export const concatWith = decorateOperatorFun(rx.concatWith)
export const exhaust = decorateOperatorFun(rx.exhaust)
export const exhaustAll = decorateOperatorFun(rx.exhaustAll)
export const exhaustMap = decorateOperatorFun(rx.exhaustMap)
export const expand = decorateOperatorFun(rx.expand)
export const mergeAll = decorateOperatorFun(rx.mergeAll)
export const flatMap = decorateOperatorFun(rx.flatMap)
export const mergeMap = decorateOperatorFun(rx.mergeMap)
export const mergeMapTo = decorateOperatorFun(rx.mergeMapTo)
export const mergeScan = decorateOperatorFun(rx.mergeScan)
export const mergeWith = decorateOperatorFun(rx.mergeWith)
export const switchAll = decorateOperatorFun(rx.switchAll)
export const switchMap = decorateOperatorFun(rx.switchMap)
export const switchMapTo = decorateOperatorFun(rx.switchMapTo)
export const switchScan = decorateOperatorFun(rx.switchScan)
export const zipAll = decorateOperatorFun(rx.zipAll)
export const zipWith = decorateOperatorFun(rx.zipWith)

// Multicasting
export const connect = decorateOperatorFun(rx.connect)
export const multicast = decorateOperatorFun(rx.multicast)
export const publish = decorateOperatorFun(rx.publish)
export const publishBehavior = decorateOperatorFun(rx.publishBehavior)
export const publishLast = decorateOperatorFun(rx.publishLast)
export const publishReplay = decorateOperatorFun(rx.publishReplay)
export const refCount = decorateOperatorFun(rx.refCount)
export const share = decorateOperatorFun(rx.share)
export const shareReplay = decorateOperatorFun(rx.shareReplay)

// Filtering
export const debounce = decorateOperatorFun(rx.debounce)
export const debounceTime = decorateOperatorFun(rx.debounceTime)
export const distinct = decorateOperatorFun(rx.distinct)
export const distinctUntilChanged = decorateOperatorFun(rx.distinctUntilChanged)
export const distinctUntilKeyChanged = decorateOperatorFun(rx.distinctUntilKeyChanged)
export const elementAt = decorateOperatorFun(rx.elementAt)
export const filter = decorateOperatorFun(rx.filter)
export const find = decorateOperatorFun(rx.find)
export const findIndex = decorateOperatorFun(rx.findIndex)
export const first = decorateOperatorFun(rx.first)
export const last = decorateOperatorFun(rx.last)
export const single = decorateOperatorFun(rx.single)
export const skip = decorateOperatorFun(rx.skip)
export const skipLast = decorateOperatorFun(rx.skipLast)
export const skipUntil = decorateOperatorFun(rx.skipUntil)
export const skipWhile = decorateOperatorFun(rx.skipWhile)
export const take = decorateOperatorFun(rx.take)
export const takeLast = decorateOperatorFun(rx.takeLast)
export const takeUntil = decorateOperatorFun(rx.takeUntil)
export const takeWhile = decorateOperatorFun(rx.takeWhile)
export const throttle = decorateOperatorFun(rx.throttle)
export const throttleTime = decorateOperatorFun(rx.throttleTime)

// Transform
export const count = decorateOperatorFun(rx.count)
export const defaultIfEmpty = decorateOperatorFun(rx.defaultIfEmpty)
export const delay = decorateOperatorFun(rx.delay)
export const delayWhen = decorateOperatorFun(rx.delayWhen)
export const dematerialize = decorateOperatorFun(rx.dematerialize)
export const endWith = decorateOperatorFun(rx.endWith)
export const every = decorateOperatorFun(rx.every)
export const finalize = decorateOperatorFun(rx.finalize)
export const groupBy = decorateOperatorFun(rx.groupBy)
export const ignoreElements = decorateOperatorFun(rx.ignoreElements)
export const isEmpty = decorateOperatorFun(rx.isEmpty)
export const map = decorateOperatorFun(rx.map)
export const mapTo = decorateOperatorFun(rx.mapTo)
export const materialize = decorateOperatorFun(rx.materialize)
export const max = decorateOperatorFun(rx.max)
export const min = decorateOperatorFun(rx.min)
export const pairwise = decorateOperatorFun(rx.pairwise)
export const pluck = decorateOperatorFun(rx.pluck)
export const reduce = decorateOperatorFun(rx.reduce)
export const scan = decorateOperatorFun(rx.scan)
export const startWith = decorateOperatorFun(rx.startWith)
export const tap = decorateOperatorFun(rx.tap)
export const throwIfEmpty = decorateOperatorFun(rx.throwIfEmpty)
export const toArray = decorateOperatorFun(rx.toArray)
export const withLatestFrom = decorateOperatorFun(rx.withLatestFrom)

// Timing
export const timeInterval = decorateOperatorFun(rx.timeInterval)
export const timeout = decorateOperatorFun(rx.timeout)
export const timeoutWith = decorateOperatorFun(rx.timeoutWith)
export const timestamp = decorateOperatorFun(rx.timestamp)

// Repeat/Retry
export const repeat = decorateOperatorFun(rx.repeat)
export const repeatWhen = decorateOperatorFun(rx.repeatWhen)

// Scheduling
export const observeOn = decorateOperatorFun(rx.observeOn)
export const subscribeOn = decorateOperatorFun(rx.subscribeOn)

// Sequence
export const sequenceEqual = decorateOperatorFun(rx.sequenceEqual)

// Window
export const window = decorateOperatorFun(rx.window)
export const windowCount = decorateOperatorFun(rx.windowCount)
export const windowTime = decorateOperatorFun(rx.windowTime)
export const windowToggle = decorateOperatorFun(rx.windowToggle)
export const windowWhen = decorateOperatorFun(rx.windowWhen)

// Pipeable versions of join operators (different from creation versions above)
export const raceWith = decorateOperatorFun(rx.raceWith)

// =============================================================================
// RE-EXPORT NON-DECORATED STUFF (classes, constants, utilities)
// =============================================================================

export {
  Observable,
  Subject,
  BehaviorSubject,
  ReplaySubject,
  AsyncSubject,
  Subscription,
  Subscriber,
  Notification,
  EMPTY,
  NEVER,
  // Schedulers
  asapScheduler,
  asyncScheduler,
  queueScheduler,
  animationFrameScheduler,
  // Utilities
  pipe,
  noop,
  identity,
  isObservable,
  lastValueFrom,
  firstValueFrom,
  // Errors
  ArgumentOutOfRangeError,
  EmptyError,
  NotFoundError,
  ObjectUnsubscribedError,
  SequenceError,
  TimeoutError,
  UnsubscriptionError,
} from "rxjs"

// =============================================================================
// LEGACY PROXY OBJECT (for backwards compatibility with existing tests)
// =============================================================================

export const proxy = {
  // Creation operators
  from,
  of,
  timer,
  combineLatest,
  merge,
  interval,
  defer,
  range,
  throwError,
  forkJoin,
  fromEvent,
  fromEventPattern,
  bindCallback,
  bindNodeCallback,
  iif,
  generate,
  using,
  race,
  zip,
  concat,
  partition,
  animationFrames,
  scheduled,
  connectable,

  // Pipeable operators
  map,
  filter,
  scan,
  take,
  skip,
  tap,
  switchMap,
  mergeMap,
  concatMap,
  exhaustMap,
  debounceTime,
  throttleTime,
  delay,
  distinctUntilChanged,
  catchError,
  retry,
  share,
  shareReplay,
  repeat,
  audit,
  auditTime,
  sample,
  sampleTime,
  buffer,
  bufferCount,
  bufferTime,
  bufferToggle,
  bufferWhen,
  combineAll,
  combineLatestAll,
  combineLatestWith,
  concatAll,
  concatMapTo,
  concatWith,
  connect,
  count,
  debounce,
  defaultIfEmpty,
  delayWhen,
  dematerialize,
  distinct,
  distinctUntilKeyChanged,
  elementAt,
  endWith,
  every,
  exhaust,
  exhaustAll,
  expand,
  finalize,
  find,
  findIndex,
  first,
  flatMap,
  groupBy,
  ignoreElements,
  isEmpty,
  last,
  mapTo,
  materialize,
  max,
  mergeAll,
  mergeMapTo,
  mergeScan,
  mergeWith,
  min,
  multicast,
  observeOn,
  onErrorResumeNext,
  pairwise,
  pluck,
  publish,
  publishBehavior,
  publishLast,
  publishReplay,
  raceWith,
  reduce,
  refCount,
  repeatWhen,
  retryWhen,
  sequenceEqual,
  single,
  skipLast,
  skipUntil,
  skipWhile,
  startWith,
  subscribeOn,
  switchAll,
  switchMapTo,
  switchScan,
  takeLast,
  takeUntil,
  takeWhile,
  throttle,
  throwIfEmpty,
  timeInterval,
  timeout,
  timeoutWith,
  timestamp,
  toArray,
  window,
  windowCount,
  windowTime,
  windowToggle,
  windowWhen,
  withLatestFrom,
  zipAll,
  zipWith,
}
