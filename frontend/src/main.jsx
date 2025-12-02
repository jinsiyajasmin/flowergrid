import React from "react";
import { createRoot } from "react-dom/client";
import ChatScreenMui from "./ChatScreenMui";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 40 }}>⚠️ Something went wrong: {String(this.state.error)}</div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <ChatScreenMui />
  </ErrorBoundary>
);
