/**
 * PipeTree - Pure render component for pipe tree visualization
 *
 * All transforms happen in 1_data/pipe-tree.ts via RxJS.
 * This component just renders what it receives.
 */

import type { PipeNode, PipeTreeState } from '../1_data/pipe-tree';
import type { ObservableMetadata } from '../../tracking/types';

interface PipeTreeProps {
  state: PipeTreeState;
}

/**
 * Get the single operator that created this observable
 * (the last one in the chain, since operators accumulate)
 */
function getOwnOperator(obs: ObservableMetadata): string | undefined {
  if (obs.operators.length === 0) return undefined;
  return obs.operators[obs.operators.length - 1];
}

/**
 * Single tree node - observable with its children
 */
function TreeNode({ node, depth = 0 }: { node: PipeNode; depth?: number }) {
  const obs = node.observable;
  const indent = depth * 20;

  // Get just this observable's operator (last in chain)
  const ownOperator = getOwnOperator(obs);

  // Primary name priority: variableName > subjectType > operator > creationFn > fallback
  const primaryName = obs.variableName
    || obs.subjectType
    || ownOperator
    || obs.creationFn
    || (obs.parentId ? 'piped' : obs.id);

  // Secondary label: context info
  // - Inner observables show "(of switchMap)" etc.
  // - Named observables show full operator chain: (filter → switchMap → shareReplay)
  // - Unnamed piped observables don't need secondary (operator is primary)
  const secondaryLabel = obs.createdByOperator
    ? `(of ${obs.createdByOperator})`
    : obs.variableName && obs.operators.length > 0
      ? `(${obs.operators.join(' → ')})`
      : '';

  return (
    <div style={{ marginLeft: indent }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderLeft: depth > 0 ? '2px solid #374151' : 'none',
          marginBottom: 2,
        }}
      >
        {/* Tree connector */}
        {depth > 0 && (
          <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>└─</span>
        )}

        {/* Observable name */}
        <span
          style={{
            color: obs.subjectType ? '#60a5fa' : '#a78bfa',
            fontWeight: obs.subjectType ? 600 : 400,
            fontFamily: 'monospace',
          }}
        >
          {primaryName}
        </span>

        {/* Secondary label (operator or context) */}
        {secondaryLabel && (
          <span style={{ color: '#6b7280', fontSize: 12 }}>{secondaryLabel}</span>
        )}

        {/* ID badge */}
        <span
          style={{
            color: '#4b5563',
            fontSize: 10,
            background: '#1f2937',
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          {obs.id}
        </span>
      </div>

      {/* Children */}
      {node.children.map((child) => (
        <TreeNode key={child.observable.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

/**
 * PipeTree - renders all observable pipe chains as a tree
 */
export function PipeTree({ state }: PipeTreeProps) {
  const { roots, activeCount, totalCount } = state;

  if (totalCount === 0) {
    return (
      <div style={{ color: '#6b7280', padding: 16 }}>
        No observables tracked yet.
      </div>
    );
  }

  // If tree building produced no roots, show flat list as fallback
  if (roots.length === 0) {
    return (
      <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
        <div style={{ color: '#9ca3af', marginBottom: 8 }}>
          {activeCount} active / {totalCount} total (no tree structure)
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
      {roots.map((root) => (
        <TreeNode key={root.observable.id} node={root} />
      ))}
    </div>
  );
}
