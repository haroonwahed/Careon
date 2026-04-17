import { useEffect, useState } from "react";
import { MultiTenantDemo } from "./components/examples/MultiTenantDemo";

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

  useEffect(() => {
    window.localStorage.setItem("careon-theme", theme);
  }, [theme]);

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <MultiTenantDemo
        theme={theme}
        onThemeToggle={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
      />
    </div>
  );
}