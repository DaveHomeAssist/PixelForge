import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { error, copied: false };
  }

  componentDidCatch(error, info) {
    this.errorInfo = info;
    console.error(error);
  }

  copyReport = async () => {
    const { error } = this.state;
    const report = [
      "PixelForge error report",
      error?.stack || error?.message || String(error),
      this.errorInfo?.componentStack || "",
    ].join("\n\n");
    try {
      await navigator.clipboard?.writeText(report);
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="pf-error-shell">
        <section className="pf-error-card">
          <div className="pf-menu-brand">PixelForge</div>
          <h1>Editor crashed</h1>
          <p>The current browser session hit an unrecoverable render error.</p>
          <pre>{error.message}</pre>
          <div className="pf-error-actions">
            <button type="button" className="pf-chip-btn active" onClick={() => window.location.reload()}>Reload</button>
            <button type="button" className="pf-chip-btn" onClick={this.copyReport}>{copied ? "Copied" : "Copy Report"}</button>
          </div>
        </section>
      </main>
    );
  }
}
