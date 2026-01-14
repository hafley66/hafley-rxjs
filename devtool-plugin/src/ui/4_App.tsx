/**
 * Root Application Component
 *
 * Renders the RxJS debugger visualization.
 * Uses a DataProvider to access tracking data.
 */

import { useState, useEffect } from 'react';
import type { DataProvider } from './1_data/provider';
import { InlineProvider } from './1_data/inline';
import { activeOnly$, type PipeTreeState } from './1_data/pipe-tree';
import { use$ } from './2_hooks/use$';
import { PipeTree } from './3_components/PipeTree';

interface AppProps {
  provider?: DataProvider;
}

/**
 * Main visualization app.
 * If no provider is given, creates an InlineProvider.
 */
export function App({ provider: externalProvider }: AppProps) {
  // Create provider if not provided
  const [internalProvider] = useState<DataProvider>(() => externalProvider ?? new InlineProvider());
  const provider = externalProvider ?? internalProvider;

  // Clean up provider on unmount
  useEffect(() => {
    if (!externalProvider) {
      return () => internalProvider.dispose();
    }
    return undefined;
  }, [externalProvider, internalProvider]);

  // Subscribe to pipe tree state
  const pipeTree = use$<PipeTreeState>(provider.pipeTree$, { roots: [], activeCount: 0, totalCount: 0 });
  const activeOnly = use$<boolean>(activeOnly$, true);

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        color: '#e5e7eb',
        padding: 16,
        boxSizing: 'border-box',
        background: '#0f172a',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>RxJS Debugger</h2>
        <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span><span style={{ color: '#3b82f6' }}>●</span> {pipeTree.activeCount} / {pipeTree.totalCount}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => activeOnly$.next(e.target.checked)}
            />
            Active only
          </label>
        </div>
      </div>

      {/* Pipe Tree */}
      <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
        <PipeTree state={pipeTree} />
      </div>
    </div>
  );
}
