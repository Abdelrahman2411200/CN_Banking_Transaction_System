import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/globals.css";

document.documentElement.classList.add("light");

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root mount node not found");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
