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
    mockUseTasks.mockReturnValue({
      tasks: [],
      loading: false,
      error: null,
      totalCount: 0,
      refetch: vi.fn(),
    });

    const onNavigate = vi.fn();
    render(<ActiesPage onCaseClick={vi.fn()} onNavigateToCasussen={onNavigate} />);

    expect(screen.getByText("Geen openstaande acties")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("acties-empty-open-casussen"));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("omits Open casussen when no navigation handler", () => {
    mockUseTasks.mockReturnValue({
      tasks: [],
      loading: false,
      error: null,
      totalCount: 0,
      refetch: vi.fn(),
    });

    render(<ActiesPage onCaseClick={vi.fn()} />);

    expect(screen.queryByTestId("acties-empty-open-casussen")).not.toBeInTheDocument();
  });
});
