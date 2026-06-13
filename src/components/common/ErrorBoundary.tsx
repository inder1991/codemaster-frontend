/**
 * ErrorBoundary -- minimal React class error boundary.
 *
 * Catches render-phase exceptions from the component subtree and
 * swaps in `fallback` instead of propagating the error up the tree.
 * Must be a class component; function components cannot implement
 * the error boundary lifecycle methods.
 */

import { Component } from "react";
import type { ReactNode } from "react";

export interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: unknown): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error("[ErrorBoundary] caught render error:", error);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
