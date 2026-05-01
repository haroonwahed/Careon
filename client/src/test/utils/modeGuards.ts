import { screen } from "@testing-library/react";
import { expect } from "vitest";

export const expectRegiekamerMode = () => {
  expect(screen.getByTestId("metric-strip")).toBeInTheDocument();
  expect(screen.queryByTestId("next-best-action")).not.toBeInTheDocument();
  expect(screen.queryByTestId("case-process-timeline")).not.toBeInTheDocument();
};

export const expectCasussenMode = () => {
  expect(screen.getByTestId("worklist")).toBeInTheDocument();
  expect(screen.queryByTestId("metric-strip")).not.toBeInTheDocument();
  expect(screen.queryByTestId("next-best-action")).not.toBeInTheDocument();
};

export const expectCasusDetailMode = () => {
  expect(screen.getByTestId("next-best-action")).toBeInTheDocument();
  expect(screen.getByTestId("case-process-timeline")).toBeInTheDocument();
  expect(screen.queryByTestId("metric-strip")).not.toBeInTheDocument();
};
