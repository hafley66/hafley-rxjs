/**
 * Mount Helper
 *
 * Mounts the RxJS debugger visualization into a DOM element.
 * Uses Shadow DOM for style isolation.
 */

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { App } from './4_App';
import type { DataProvider } from './1_data/provider';

/**
 * Mount options
 */
export interface MountOptions {
  /** Custom data provider (defaults to InlineProvider) */
  provider?: DataProvider;
  /** Use Shadow DOM for style isolation (default: true) */
  useShadowDOM?: boolean;
}

/**
 * Mount result - provides unmount function
 */
export interface MountResult {
  /** Unmount the visualization and clean up */
  unmount: () => void;
}

// Base styles injected into Shadow DOM
const BASE_STYLES = `
  :host {
    display: block;
    background: #111827;
    border-radius: 8px;
    overflow: hidden;
  }

  * {
    box-sizing: border-box;
  }
`;

/**
 * Mount the RxJS debugger visualization into a container element.
 *
 * @param container - The DOM element to mount into
 * @param options - Mount configuration options
 * @returns Object with unmount function
 *
 * @example
 * ```ts
 * // Mount into a div
 * const container = document.getElementById('debugger');
 * const { unmount } = mount(container);
 *
 * // Later, clean up
 * unmount();
 * ```
 */
export function mount(container: HTMLElement, options: MountOptions = {}): MountResult {
  const { provider, useShadowDOM = true } = options;

  let root: Root;
  let renderTarget: HTMLElement;

  if (useShadowDOM) {
    // Create Shadow DOM for style isolation
    const shadow = container.attachShadow({ mode: 'open' });

    // Inject base styles
    const style = document.createElement('style');
    style.textContent = BASE_STYLES;
    shadow.appendChild(style);

    // Create render container inside shadow
    renderTarget = document.createElement('div');
    shadow.appendChild(renderTarget);
  } else {
    // Render directly into container
    renderTarget = container;
  }

  // Create React root and render
  root = createRoot(renderTarget);
  root.render(createElement(App, { provider }));

  return {
    unmount: () => {
      root.unmount();
      if (useShadowDOM) {
        // Shadow DOM will be garbage collected with the container
      }
    },
  };
}

/**
 * Create a floating debugger panel.
 * Appends to document.body with fixed positioning.
 *
 * @param options - Mount configuration options
 * @returns Object with unmount function
 */
export function mountFloating(options: MountOptions = {}): MountResult {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 999999;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    border-radius: 8px;
  `;
  document.body.appendChild(container);

  const result = mount(container, options);

  return {
    unmount: () => {
      result.unmount();
      container.remove();
    },
  };
}
