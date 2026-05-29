import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

document.documentElement.dataset.bundleBuild = "2026-05-29-force-rebuild-1";

createRoot(document.getElementById("root")!).render(<App />);
