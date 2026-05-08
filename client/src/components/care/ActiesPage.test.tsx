import { fireEvent, render, screen } from "@testing-library/react";
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
  it("shows Open casussen in empty state when navigation handler is provided", () => {
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

    expect(screen.getByRole("button", { name: "Ververs" })).toBeInTheDocument();
    expect(screen.getByText("Geen openstaande acties")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("acties-empty-open-casussen"));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Ververs" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("omits Open casussen when no navigation handler", () => {
    const refetch = vi.fn();
    mockUseTasks.mockReturnValue({
      tasks: [],
      loading: false,
      error: null,
      totalCount: 0,
      refetch,
    });

    render(<ActiesPage onCaseClick={vi.fn()} />);

    expect(screen.queryByTestId("acties-empty-open-casussen")).not.toBeInTheDocument();
  });

  it("shows a dominant attention bar for urgent work", () => {
    mockUseTasks.mockReturnValue({
      tasks: [
        {
          id: "task-1",
          linkedCaseId: "case-1",
          title: "Casusgegevens invullen",
          caseTitle: "Test",
          actionStatus: "overdue",
          dueDate: "2026-05-08",
          assignedTo: "Jane Doe",
          priority: "URGENT",
        },
      ],
      loading: false,
      error: null,
      totalCount: 1,
      refetch: vi.fn(),
    });

    render(<ActiesPage onCaseClick={vi.fn()} onNavigateToCasussen={vi.fn()} />);

    expect(screen.getByText(/kritieke actie/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toon te laat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open casussen" })).toBeInTheDocument();
  });
});
