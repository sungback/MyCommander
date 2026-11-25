import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

import { getCurrentWindow } from "@tauri-apps/api/window";

// E2E 빌드(VITE_E2E=true)에서만 WDIO 플러그인을 불러온다. 일반 빌드에서는 분기째 제거된다.
if (import.meta.env.VITE_E2E === "true") {
  void import("@wdio/tauri-plugin");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// 화면 렌더링이 안착된 직후 부드럽게 창을 띄워 깜빡임을 방지합니다.
setTimeout(() => {
  getCurrentWindow().show().catch(console.error);
}, 100);
