import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSignal } from "@hafley66/signals/react";
import { getMdviewHost, type MdviewHost } from "./ports.js";
import type { StrSignal } from "./signals.js";

export interface MdDocumentIdentity {
  readonly filePath: string;
  readonly gitRoot?: string;
  readonly gitRootPending: boolean;
}

interface MdDocumentIdentityProviderProps {
  readonly pathSignal: StrSignal;
  readonly children?: ReactNode;
}

const identityContext = createContext<MdDocumentIdentity | null>(null);
type GitRootResolver = NonNullable<MdviewHost["repoRootFor"]>;

// A host replacement must not inherit another host's answer for the same path.
// The inner map is also where rejected lookups are removed so a transient host
// failure does not become a permanent path fallback for the process lifetime.
const gitRootCache = new WeakMap<GitRootResolver, Map<string, Promise<string | undefined>>>();

interface GitRootResolution {
  readonly filePath: string;
  readonly gitRoot?: string;
  readonly pending: boolean;
}

function normalizeRoot(root: string | null | undefined): string | undefined {
  const value = root?.trim();
  return value ? value : undefined;
}

/** Resolve one path through the host and share in-flight/completed lookups. */
export function resolveMdGitRoot(
  filePath: string,
  resolver: MdviewHost["repoRootFor"],
): Promise<string | undefined> {
  if (!resolver) return Promise.resolve(undefined);
  let paths = gitRootCache.get(resolver);
  if (!paths) {
    paths = new Map();
    gitRootCache.set(resolver, paths);
  }
  const cached = paths.get(filePath);
  if (cached) return cached;
  const request = Promise.resolve()
    .then(() => resolver(filePath))
    .then(normalizeRoot)
    .catch(() => {
      if (paths?.get(filePath) === request) paths.delete(filePath);
      return undefined;
    });
  paths.set(filePath, request);
  return request;
}

export function MdDocumentIdentityProvider({ pathSignal, children }: MdDocumentIdentityProviderProps) {
  const filePath = useSignal(pathSignal.$);
  const resolver = getMdviewHost().repoRootFor;
  const [resolution, setResolution] = useState<GitRootResolution>({
    filePath,
    pending: Boolean(resolver),
  });
  const current = resolution.filePath === filePath
    ? resolution
    : { filePath, gitRoot: undefined, pending: Boolean(resolver) };

  useEffect(() => {
    let current = true;
    setResolution({ filePath, pending: Boolean(resolver) });
    if (!resolver) return () => { current = false; };
    void resolveMdGitRoot(filePath, resolver).then((root) => {
      if (!current) return;
      setResolution({ filePath, gitRoot: root, pending: false });
    });
    return () => { current = false; };
  }, [filePath, resolver]);

  const identity = useMemo(
    () => ({ filePath, gitRoot: current.gitRoot, gitRootPending: current.pending }),
    [filePath, current.gitRoot, current.pending],
  );
  return createElement(identityContext.Provider, { value: identity }, children);
}

export function useMdDocumentIdentity(): MdDocumentIdentity {
  const identity = useContext(identityContext);
  if (!identity) throw new Error("mdview: useMdDocumentIdentity() requires MdDocumentIdentityProvider");
  return identity;
}

export function useOptionalMdDocumentIdentity(): MdDocumentIdentity | null {
  return useContext(identityContext);
}
