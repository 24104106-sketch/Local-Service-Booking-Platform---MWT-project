import { Component } from "react";

/**
 * Error boundaries MUST be class components — as of React 18/19 there is no
 * hook equivalent (no "useErrorBoundary"). This is the one legitimate
 * exception to "everything is a function component" in this project.
 * It catches render-time errors anywhere below it and shows a fallback
 * instead of a blank white screen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>Something went wrong.</h2>
          <p style={{ color: "var(--muted)" }}>Please refresh the page and try again.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
