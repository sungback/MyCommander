import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "12px",
            padding: "24px",
            fontFamily: "system-ui, sans-serif",
            background: "var(--color-bg-primary, #1e1e1e)",
            color: "var(--color-text-primary, #e0e0e0)",
          }}
        >
          <p style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
            오류가 발생했습니다
          </p>
          <p
            style={{
              fontSize: "13px",
              opacity: 0.7,
              margin: 0,
              maxWidth: "400px",
              textAlign: "center",
              wordBreak: "break-all",
            }}
          >
            {this.state.error?.message ?? "알 수 없는 오류"}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "8px",
              padding: "8px 20px",
              fontSize: "13px",
              cursor: "pointer",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.1)",
              color: "inherit",
            }}
          >
            앱 새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
