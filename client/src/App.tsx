import { useEffect, useState } from "react";
import { MultiTenantDemo } from "./components/examples/MultiTenantDemo";
import { PublicLandingPage } from "./components/public/PublicLandingPage";
import { getDjangoAuthDocumentRedirectUrl, isAuthDocumentPath, PUBLIC_LANDING_URL } from "./lib/routes";

/** Leave the Vite SPA and load Django’s HTML for login/register/logout (session + forms). */
function AuthDocumentRedirect() {
  useEffect(() => {
    const dest = getDjangoAuthDocumentRedirectUrl();
    if (!dest) {
      return;
    }
    const here = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (dest !== here) {
      window.location.replace(dest);
    }
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <p className="text-sm text-muted-foreground">Doorverbinden naar aanmelden…</p>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedTheme = window.localStorage.getItem("careon-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      // Apply immediately to avoid flash of wrong theme on portals
      if (storedTheme === "dark") document.documentElement.classList.add("dark");
      return storedTheme;
    }

    document.documentElement.classList.remove("dark");
    return "light";
  });
  const [isDashboardView] = useState(() => new URLSearchParams(window.location.search).get("view") === "dashboard");
  const [isPublicRoute] = useState(() => window.location.pathname === PUBLIC_LANDING_URL);
  const [isAuthRoute] = useState(() => isAuthDocumentPath(window.location.pathname));

  useEffect(() => {
    window.localStorage.setItem("careon-theme", theme);
    // Apply dark class to <html> so Radix UI portals rendered to document.body
    // inherit the correct CSS custom properties (Select, Dialog, Popover, etc.)
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  if (isPublicRoute && !isDashboardView) {
    return (
      <div className={theme === "dark" ? "dark" : ""}>
        <PublicLandingPage
          onThemeToggle={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
        />
      </div>
    );
  }

  if (isAuthRoute) {
    return (
      <div className={theme === "dark" ? "dark" : ""}>
        <AuthDocumentRedirect />
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
