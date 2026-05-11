import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getDjangoAuthDocumentRedirectUrl } from "./lib/routes";

const dest = getDjangoAuthDocumentRedirectUrl();
const here = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
if (dest && dest !== here) {
  window.location.replace(dest);
} else {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("Missing #root element");
  }
  createRoot(rootEl).render(<App />);
}
