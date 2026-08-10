# Path router type oracle lab

Pinned compile-only fixtures:

| file | package |
|---|---|
| `1_reactRouter4.oracle.ts` | `react-router@4.3.1` with `@types/react-router@4.0.25` |
| `2_reactRouter5.oracle.ts` | `react-router@5.3.4` with `@types/react-router@5.1.20` |
| `3_reactRouter6.oracle.ts` | `react-router@6.30.4` |
| `4_reactRouter7.oracle.ts` | `react-router@7.18.1` |
| `5_tanstackRouter.oracle.ts` | `@tanstack/react-router@1.170.18` |
| `6_IPath.target.oracle.ts` | proposed unary `IPath` type contract |

Run:

```sh
pnpm --filter @hafley66/path-router-lab typecheck
```

The `@ts-expect-error` assertions are part of the oracle. An unused directive
fails the lab when a dependency begins accepting an invalid construction.
