/**
 * RxJS -> React Bridge Hook
 *
 * Subscribes to an Observable and returns its current value as React state.
 * Automatically handles subscription lifecycle.
 */

import { useState, useEffect, useRef } from 'react';
import type { Observable } from 'rxjs';

/**
 * Subscribe to an Observable and get its latest value as React state.
 *
 * @param obs$ - The Observable to subscribe to
 * @param defaultValue - Initial value before first emission
 * @returns The current value from the Observable
 *
 * @example
 * ```tsx
 * const subscriptions = use$(provider.subscriptions$, []);
 * ```
 */
export function use$<T>(obs$: Observable<T>, defaultValue: T): T {
  const [value, setValue] = useState<T>(defaultValue);
  const obsRef = useRef(obs$);

  useEffect(() => {
    // Update ref if observable changes
    obsRef.current = obs$;

    const subscription = obs$.subscribe({
      next: (v) => setValue(v),
      error: (err) => {
        console.error('[use$] Observable error:', err);
      },
    });

    return () => subscription.unsubscribe();
  }, [obs$]);

  return value;
}

/**
 * Subscribe to an Observable that may emit undefined/null.
 * Similar to use$ but without requiring a default value.
 *
 * @param obs$ - The Observable to subscribe to
 * @returns The current value (may be undefined)
 */
export function use$Optional<T>(obs$: Observable<T>): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    const subscription = obs$.subscribe({
      next: (v) => setValue(v),
      error: (err) => {
        console.error('[use$Optional] Observable error:', err);
      },
    });

    return () => subscription.unsubscribe();
  }, [obs$]);

  return value;
}
