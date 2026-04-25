import { useEffect, useState } from "react";
import { MultiTenantDemo } from "./components/examples/MultiTenantDemo";
import { PublicLandingPage } from "./components/public/PublicLandingPage";
import { PUBLIC_LANDING_URL, SPA_DASHBOARD_URL } from "./lib/routes";

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const storedTheme = window.localStorage.getItem("careon-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [isDashboardView] = useState(() => new URLSearchParams(window.location.search).get("view") === "dashboard");
  const [isPublicRoute] = useState(() => window.location.pathname === PUBLIC_LANDING_URL || window.location.pathname.startsWith("/static/spa/"));

  useEffect(() => {
    window.localStorage.setItem("careon-theme", theme);
  }, [theme]);

  if (isPublicRoute && !isDashboardView) {
    return (
      <div className={theme === "dark" ? "dark" : ""}>
        <PublicLandingPage
          onThemeToggle={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
          onOpenDashboard={() => {
            window.location.assign(SPA_DASHBOARD_URL);
          }}
        />
      </div>
    );
  }

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <MultiTenantDemo
        theme={theme}
        onThemeToggle={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
      />
    </div>
  );
}
