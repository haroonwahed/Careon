import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfielPage } from "./ProfielPage";

const mockUseCurrentUser = vi.fn();

vi.mock("../../hooks/useCurrentUser", () => ({
  useCurrentUser: (...args: unknown[]) => mockUseCurrentUser(...args),
}));

describe("ProfielPage", () => {
  it("shows a dedicated profile surface and forwards to settings", async () => {
    mockUseCurrentUser.mockReturnValue({
      me: {
        id: 1,
        email: "test@example.com",
        fullName: "Test User",
        username: "test",
        workflowRole: "gemeente",
        organization: { id: 10, slug: "gemeente-demo", name: "Gemeente Demo" },
        permissions: { allowRoleSwitch: true },
        flags: { pilotUi: true, spaOnlyWorkflow: true },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const onNavigateToSettings = vi.fn();
    const user = userEvent.setup();
    render(<ProfielPage onNavigateToSettings={onNavigateToSettings} />);

    expect(screen.getByRole("heading", { name: "Profiel" })).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Naar instellingen" })).toBeInTheDocument();

    await user.click(screen.getByTestId("profiel-page-info"));
    expect(screen.getByText(/persoonlijke accountcontext/i)).toBeInTheDocument();
    expect(screen.getByText(/Instellingen blijft de plek voor governance/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Naar instellingen" }));
    expect(onNavigateToSettings).toHaveBeenCalledTimes(1);
  });
});
