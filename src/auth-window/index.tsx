import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AuthApp from "./AuthApp";
import "../styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthApp />
  </StrictMode>
);
