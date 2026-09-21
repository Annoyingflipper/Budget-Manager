import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Catches render errors from its subtree. A class component because React
 * only supports error-boundary semantics (getDerivedStateFromError /
 * componentDidCatch) on class components — there is no hooks equivalent.
 *
 * Why this exists: before v2.1 there were no lazy chunks, so a mid-session
 * deploy was invisible. Now an already-open window holding the old
 * index.html can request a chunk filename that no longer exists on the
 * server. vercel.json has no explicit rewrites, so Vite's SPA fallback
 * returns index.html with a 200, the dynamic import rejects on the
 * resulting MIME type, and React unmounts the whole root — a blank page,
 * with no address bar or reload button in an installed standalone window.
 * Wrapping the lazy Suspense boundary here turns that into a recoverable,
 * themed message instead.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
          <div className="bg-card rounded-card p-6 max-w-sm w-full text-center space-y-4">
            <p className="text-body">Something went wrong. Reload to get the latest version.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-positive text-white rounded-control px-4 py-2 text-label"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
