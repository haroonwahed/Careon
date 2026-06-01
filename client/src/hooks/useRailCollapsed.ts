import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "careon.rail.collapsed";

function shouldAvoidLocalStorage(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  if (import.meta.env.MODE === "test") {
    return true;
  }
  return /jsdom/i.test(window.navigator.userAgent ?? "");
}

function readInitial(): boolean {
  if (shouldAvoidLocalStorage()) {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeValue(next: boolean): void {
  if (shouldAvoidLocalStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* localStorage may throw on quota or disabled storage — ignore. */
  }
}

/**
 * Shared collapse state for the right-side regie rail across pages.
 * Persisted in localStorage so the preference survives reloads and
 * stays consistent between Coordination, Casussen, and Aanbieder beoordeling.
 */
export function useRailCollapsed(): {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggle: () => void;
} {
  const [collapsed, setState] = useState<boolean>(() => readInitial());

  const setCollapsed = useCallback((next: boolean) => {
    setState(next);
    writeValue(next);
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => {
      const next = !prev;
      writeValue(next);
      return next;
    });
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      setState(event.newValue === "1");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { collapsed, setCollapsed, toggle };
}
