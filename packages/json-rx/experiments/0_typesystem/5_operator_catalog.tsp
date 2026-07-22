namespace JsonRxExperiment;

model Stream<T> { value: T; }
model Transform<Input, Output> { input: Input; output: Output; }
model Predicate<Input> { input: Input; output: boolean; }
model Reducer<State, Event> { state: State; event: Event; output: State; }

// Creation operators have no implicit input stream.
op From<T>(): Stream<T>;
op Timer(): Stream<uint64>;
op Merge2<A, B>(a: Stream<A>, b: Stream<B>): Stream<A | B>;
op Merge3<A, B, C>(a: Stream<A>, b: Stream<B>, c: Stream<C>): Stream<A | B | C>;
op Merge4<A, B, C, D>(a: Stream<A>, b: Stream<B>, c: Stream<C>, d: Stream<D>): Stream<A | B | C | D>;
op Merge5<A, B, C, D, E>(a: Stream<A>, b: Stream<B>, c: Stream<C>, d: Stream<D>, e: Stream<E>): Stream<A | B | C | D | E>;
op CombineLatest2<A, B>(a: Stream<A>, b: Stream<B>): Stream<[A, B]>;
op CombineLatest3<A, B, C>(a: Stream<A>, b: Stream<B>, c: Stream<C>): Stream<[A, B, C]>;
op CombineLatest4<A, B, C, D>(a: Stream<A>, b: Stream<B>, c: Stream<C>, d: Stream<D>): Stream<[A, B, C, D]>;
op CombineLatest5<A, B, C, D, E>(a: Stream<A>, b: Stream<B>, c: Stream<C>, d: Stream<D>, e: Stream<E>): Stream<[A, B, C, D, E]>;

// Pipeable operators receive the implicit input stream first.
op Map<Input, Output>(input: Stream<Input>, transform: Transform<Input, Output>): Stream<Output>;
op Filter<T>(input: Stream<T>, predicate: Predicate<T>): Stream<T>;
op Scan<Event, State>(input: Stream<Event>, reducer: Reducer<State, Event>, seed: State): Stream<State>;
op WithLatestFrom2<Input, A>(input: Stream<Input>, a: Stream<A>): Stream<[Input, A]>;
op WithLatestFrom3<Input, A, B>(input: Stream<Input>, a: Stream<A>, b: Stream<B>): Stream<[Input, A, B]>;
op WithLatestFrom4<Input, A, B, C>(input: Stream<Input>, a: Stream<A>, b: Stream<B>, c: Stream<C>): Stream<[Input, A, B, C]>;
op WithLatestFrom5<Input, A, B, C, D>(input: Stream<Input>, a: Stream<A>, b: Stream<B>, c: Stream<C>, d: Stream<D>): Stream<[Input, A, B, C, D]>;
op MergeMap<Input, Output>(input: Stream<Input>, project: Transform<Input, Stream<Output>>, concurrency?: int32): Stream<Output>;
op SwitchMap<Input, Output>(input: Stream<Input>, project: Transform<Input, Stream<Output>>): Stream<Output>;
op ConcatMap<Input, Output>(input: Stream<Input>, project: Transform<Input, Stream<Output>>): Stream<Output>;
op TakeUntil<T, Notification>(input: Stream<T>, notifier: Stream<Notification>): Stream<T>;
op ShareReplay<T>(input: Stream<T>, bufferSize: int32, refCount: boolean): Stream<T>;
