import { Component, type ReactNode } from 'react';
import { Button } from '@mucsi96/react-ui';

// React caches rejected lazy imports. Reload the document to retry with the
// current deployment's bundles rather than rendering the same rejected import.
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <section role="alert">
      <h1>Unable to load this page</h1>
      <p>Reload to try again.</p>
      <Button onPress={() => window.location.reload()}>Reload page</Button>
    </section>;
    return this.props.children;
  }
}
