import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CasePrimaryActionPanel } from "./CaseExecutionWorkspaceSections";

describe("CasePrimaryActionPanel", () => {
  it("keeps blocked state quiet while disabling the CTA", () => {
    render(
      <CasePrimaryActionPanel
        statusLabel="Wacht op besluit"
        actionHolderLabel="Gemeente"
        waitingOnLabel="Aanvulling nodig"
        nextStepLabel="Controleer persoonsbeeld"
        primaryCtaLabel="Volgende"
        onPrimaryAction={vi.fn()}
        primaryDisabled
        disabledReason="Vul het persoonsbeeld in om door te gaan."
      />,
    );

    expect(screen.getByTestId("next-best-action")).toHaveAttribute("data-blocked", "true");
    expect(screen.getByRole("button", { name: "Volgende" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
