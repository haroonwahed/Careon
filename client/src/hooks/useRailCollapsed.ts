import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "careon.rail.collapsed";

function readInitial(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeValue(next: boolean): void {
  if (typeof window === "undefined") {
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
 * stays consistent between Regiekamer, Casussen, and Aanbieder beoordeling.
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
