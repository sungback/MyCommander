import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { getCurrentWindow } from "@tauri-apps/api/window";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 화면 렌더링이 안착된 직후 부드럽게 창을 띄워 깜빡임을 방지합니다.
setTimeout(() => {
  getCurrentWindow().show().catch(console.error);
}, 100);
