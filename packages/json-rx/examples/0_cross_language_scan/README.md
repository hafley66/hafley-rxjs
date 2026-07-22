# Cross-language pipeline proof

`0_pipeline.tsp` owns the example payload models, keyed inputs, event union, and
state transition declaration. It imports the pure decorators from
`src/6_codegen`; the package core contains no Instant or usage model names.

The generated algorithms implement the same portable slice:

1. `mergeByKey` turns a model of typed streams into a discriminated event stream.
2. `scan` replaces state for `snapshot` and patches state for `update`.

The TypeScript target lowers keyed inputs to RxJS `map` and `merge`, followed by
`scan`. The Rust target accepts any `Stream` for each input. The test supplies
`tokio::sync::mpsc` receivers through `tokio_stream::wrappers::ReceiverStream`.
The generated implementation uses one `tokio::select!` arm per TypeSpec model
property and returns an `async_stream::stream!`.

Run both implementations:

```sh
npm run cross-language:check
```

OpenAPI and JSON Schema model generation can replace `0_models.ts` and
`rust/src/models.rs`. Algorithm generation imports those model types and does
not own transport or application schemas.
