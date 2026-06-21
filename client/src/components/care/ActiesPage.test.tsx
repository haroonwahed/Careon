import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiesPage } from "./ActiesPage";

const mockUseTasks = vi.fn();

vi.mock("../../hooks/useTasks", () => ({
  useTasks: (...args: unknown[]) => mockUseTasks(...args),
}));

vi.mock("../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    me: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("ActiesPage", () => {
  it("shows the operational empty state when no open actions exist", () => {
    const refetch = vi.fn();
    mockUseTasks.mockReturnValue({
      tasks: [],
      loading: false,
      error: null,
      totalCount: 0,
      refetch,
    });

    const onNavigate = vi.fn();
    render(<ActiesPage onCaseClick={vi.fn()} onNavigateToCasussen={onNavigate} />);

    expect(screen.getByRole("heading", { name: "Acties" })).toBeInTheDocument();
    expect(screen.getByText("Geen openstaande acties")).toBeInTheDocument();
    expect(screen.getByText("Er zijn geen taken die jouw beslissing of opvolging vragen.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bekijk actieve casussen" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("omits the empty-state CTA when navigation is unavailable", () => {
    mockUseTasks.mockReturnValue({
      tasks: [],
      loading: false,
      error: null,
      totalCount: 0,
      refetch: vi.fn(),
    });

    render(<ActiesPage onCaseClick={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Bekijk actieve casussen" })).not.toBeInTheDocument();
  });

  it("renders the dominant task surface and worklist when actions exist", () => {
    mockUseTasks.mockReturnValue({
      tasks: [
        {
          id: "task-1",
          linkedCaseId: "case-1",
          title: "Casusgegevens invullen",
          description: "Aanvullende informatie nodig",
          caseTitle: "Test casus",
          actionStatus: "overdue",
          dueDate: "2026-05-08",
          assignedTo: "Jane Doe",
          priority: "URGENT",
          status: "OPEN",
          createdAt: "2026-06-08T08:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      totalCount: 1,
      refetch: vi.fn(),
    });

    const onCaseClick = vi.fn();
    render(<ActiesPage onCaseClick={onCaseClick} onNavigateToCasussen={vi.fn()} />);

    expect(screen.getByTestId("acties-uitvoerlijst")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kritiek/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maak casus compleet" })).toBeInTheDocument();

    const row = screen.getByText("Casusgegevens invullen").closest("[data-care-work-row]");
    expect(row).not.toBeNull();
    const rowEl = row as HTMLElement;
    expect(within(rowEl).getByText("Casusgegevens invullen")).toBeInTheDocument();
    expect(within(rowEl).getByText(/CAS-2026-CASE1/i)).toBeInTheDocument();
    expect(within(rowEl).getByText(/Jane Doe/i)).toBeInTheDocument();
    expect(within(rowEl).getByRole("button", { name: "Maak casus compleet" })).toBeInTheDocument();

    fireEvent.click(within(rowEl).getByRole("button", { name: "Maak casus compleet" }));
    expect(onCaseClick).toHaveBeenCalledWith("case-1");
  });
});
