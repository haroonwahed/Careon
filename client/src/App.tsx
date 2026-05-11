import { useEffect, useLayoutEffect, useState } from "react";
import { MultiTenantDemo } from "./components/examples/MultiTenantDemo";
import { PublicLandingPage } from "./components/public/PublicLandingPage";
import { isAuthDocumentPath, PUBLIC_LANDING_URL, redirectIfAuthDocumentPath } from "./lib/routes";

/** Keep SPA routing in sync with `window.location` when the shell uses `history.pushState` / `replaceState`. */
function useSyncedPathname(): string {
  const [pathname, setPathname] = useState(
    () => (typeof window !== "undefined" ? window.location.pathname : "/"),
  );
  useLayoutEffect(() => {
    const sync = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", sync);
    const originalPush = history.pushState.bind(history);
    const originalReplace = history.replaceState.bind(history);
    history.pushState = (...args: Parameters<typeof originalPush>) => {
      originalPush(...args);
      sync();
    };
    history.replaceState = (...args: Parameters<typeof originalReplace>) => {
      originalReplace(...args);
      sync();
    };
    return () => {
      window.removeEventListener("popstate", sync);
      history.pushState = originalPush;
      history.replaceState = originalReplace;
    };
  }, []);
  return pathname;
}

/** Leave the Vite SPA and load Django’s HTML for login/register/logout (session + forms). */
function AuthDocumentRedirect() {
  useEffect(() => {
    redirectIfAuthDocumentPath();
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
  const pathname = useSyncedPathname();
  const isPublicRoute = pathname === PUBLIC_LANDING_URL;
  const isAuthRoute = isAuthDocumentPath(pathname);

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
