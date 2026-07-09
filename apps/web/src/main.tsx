import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "@/auth";
import { queryClient } from "@/lib/api";
import { ThemeProvider } from "@/theme";
import { App } from "@/app";

import "@/styles.css";
import "@/styles/features.css";
import "@/styles/admin.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The website root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
