import "@testing-library/jest-dom";

/** Desktop viewport so Tailwind `lg`/`xl` responsive variants apply in jsdom (sidebar, rails). */
const TEST_VIEWPORT_CSS_WIDTH = 1440;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => {
    const pxMatch = /(\d+(?:\.\d+)?)px/.exec(query);
    const px = pxMatch ? Number(pxMatch[1]) : 0;
    let matches = false;
    if (query.includes("max-width") && px) {
      matches = TEST_VIEWPORT_CSS_WIDTH <= px;
    } else if (query.includes("min-width") && px) {
      matches = TEST_VIEWPORT_CSS_WIDTH >= px;
    }
    const mql = {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    };
    return mql;
  },
});
