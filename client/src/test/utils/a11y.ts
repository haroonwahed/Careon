import { render, type RenderOptions } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import type { ReactElement } from "react";
import { expect } from "vitest";

expect.extend(toHaveNoViolations);

export function renderWithA11y(ui: ReactElement, options?: RenderOptions) {
  return render(ui, options);
}

export async function expectNoA11yViolations(container: HTMLElement, label?: string) {
  const results = await axe(container);
  expect(results, label ? `[${label}] accessibility smoke` : "accessibility smoke").toHaveNoViolations();
  return results;
}
