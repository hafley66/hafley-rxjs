# @hafley66/rxjs-ext

RxJS operators that should exist but don't.

📚 **[Full API Documentation](https://hafley66.github.io/hafley-rxjs/)**

---

## `renext`

Re-emit current value on trigger. "renext" = re-emit next.

```
source$:    --A---------B--------->
trigger$:   ------X--X------X----->
output:     --A---A--A--B---B----->
```

```ts
const trigger$ = merge(interval(30000), windowFocus$, manualRefetch$)
userId$.pipe(renext(trigger$))

// Factory form - conditional repeat
userId$.pipe(renext((id) => id > 0 ? interval(30000) : NEVER))
```

---

## `repeatExt` / `retryExt`

Extended repeat/retry with access to last emitted value.

```ts
// repeatExt - repeat based on last value
fetchUser(id).pipe(
  repeatExt((user) => user.isActive ? timer(5000) : NEVER)
)

// retryExt - retry with error + last value
fetchUser(id).pipe(
  retryExt((error, lastUser) => {
    if (error.status === 404) return EMPTY
    return timer(1000 * 2 ** error.attempt)
  })
)
```

---

## `makeSwitchMapCached`

Creates a switchMap that caches. Reuses in-flight requests for same input.

```
input$:     --A-----A-----B-----A-->
fetch(A):   --====A       (reused)
fetch(B):                  --===B
output:     ------A---A-----B---A-->
```

```ts
const switchMapCached = makeSwitchMapCached("users", { ttl: 60000 })

userId$.pipe(
  switchMapCached(id => fetchUser(id))
).subscribe(...)

switchMapCached.cache.delete("users:123")  // invalidate
switchMapCached.cache.clear()               // clear all
```

---

## `mergeByKey` / `mergeByTup` / `mergeByKeyScan`

Merge observables preserving key structure.

```
a$: --1-------3-->
b$: ----"x"------->

mergeByKey:     --{a,1}--{b,"x"}--{a,3}-->
mergeByTup:     --["a",1]-["b","x"]-["a",3]-->
mergeByKeyScan: {a:0,b:""}--{a:1,b:""}-{a:1,b:"x"}-{a:3,b:"x"}-->
```

```ts
mergeByKeyScan({ loading: loading$, data: data$ }, { loading: true, data: null })
```

---

## `combinePartialArray` / `combinePartialRecord`

Like combineLatest but emits on FIRST emission from ANY source.

```
a$: --1-------3-->
b$: ------"x"---->

combineLatest:       ------[1,"x"]--[3,"x"]-->     (waits for all)
combinePartialArray: --[1,undefined]-[1,"x"]-[3,"x"]-->
```

---

## `DEBUG_TAG` / `CONSOLE_TAG`

Log all observable lifecycle events.

```ts
source$.pipe(DEBUG_TAG("fetch"))
// fetch/subscribe, fetch/next 123, fetch/complete

source$.pipe(CONSOLE_TAG("fetch"))
// (fetch 0)/subscribe, (fetch 0)/next 123  (unique ID per sub)
```

---

## `shareLatest`

Shorthand for `shareReplay({ bufferSize: 1, refCount: true })`.

---

## `deferFrom`

`defer(() => from(factory()))` in one call.

```ts
deferFrom(() => fetch("/api"))  // lazy
```

---

## `AND_THEN`

combineLatest that accepts mix of observables and static values.

```ts
AND_THEN({ user: user$, config: { debug: true } })
  .subscribe(({ user, config }) => ...)
```
