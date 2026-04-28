import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/theme"; // applies cached theme immediately

createRoot(document.getElementById("root")!).render(<App />);
