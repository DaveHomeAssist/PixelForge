import React from "react";
import { createRoot } from "react-dom/client";
import PixelForge from "./PixelForge.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PixelForge />
    </ErrorBoundary>
  </React.StrictMode>,
);
