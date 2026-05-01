import { describe, expect, it } from "vitest";
import type { SpaTask } from "../hooks/useTasks";
import { countOpenCareTasks, isOpenCareTask } from "./actiesTaskSemantics";

function task(partial: Partial<SpaTask> & Pick<SpaTask, "id" | "actionStatus">): SpaTask {
  return {
    title: "t",
    description: "",
    priority: "LOW",
    status: "PENDING",
    linkedCaseId: "",
    caseTitle: "",
    assignedTo: "",
    dueDate: "2026-04-30",
    createdAt: "2026-04-01T00:00:00.000Z",
    ...partial,
  };
}

describe("actiesTaskSemantics", () => {
  it("isOpenCareTask excludes completed bucket", () => {
    expect(isOpenCareTask(task({ id: "1", actionStatus: "overdue" }))).toBe(true);
    expect(isOpenCareTask(task({ id: "2", actionStatus: "today" }))).toBe(true);
    expect(isOpenCareTask(task({ id: "3", actionStatus: "upcoming" }))).toBe(true);
    expect(isOpenCareTask(task({ id: "4", actionStatus: "completed" }))).toBe(false);
  });

  it("countOpenCareTasks matches Acties default list (non-completed only)", () => {
    const tasks = [
      task({ id: "a", actionStatus: "overdue" }),
      task({ id: "b", actionStatus: "completed" }),
      task({ id: "c", actionStatus: "today" }),
    ];
    expect(countOpenCareTasks(tasks)).toBe(2);
  });
});
