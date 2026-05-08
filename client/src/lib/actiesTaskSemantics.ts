import type { SpaTask } from "../hooks/useTasks";

/** Open = not completed/cancelled bucket from `/care/api/tasks/` (matches Acties page list). */
export function isOpenCareTask(task: SpaTask): boolean {
  return task.actionStatus !== "completed";
}

export function countOpenCareTasks(tasks: SpaTask[]): number {
  return tasks.filter(isOpenCareTask).length;
}

export type TaskPriorityKey = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export function normalizeTaskPriority(raw: string): TaskPriorityKey {
  const u = raw.trim().toUpperCase();
  if (u === "URGENT" || u === "HIGH" || u === "MEDIUM" || u === "LOW") return u;
  return "MEDIUM";
}

export function priorityRank(priority: string): number {
  const p = normalizeTaskPriority(priority);
  const order: Record<TaskPriorityKey, number> = {
    URGENT: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  return order[p];
}

/** Earlier / sooner due dates sort first (missing dates last). */
export function compareDueIso(a: SpaTask, b: SpaTask): number {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

export type ActionStatusBucket = SpaTask["actionStatus"];

export function actionStatusRank(status: ActionStatusBucket): number {
  if (status === "overdue") return 0;
  if (status === "today") return 1;
  if (status === "upcoming") return 2;
  return 9;
}

/** Composite urgency sort for werklijst (deadline bucket then priority). */
export function sortTasksByUrgency(tasks: SpaTask[]): SpaTask[] {
  return [...tasks].sort((a, b) => {
    const rs = actionStatusRank(a.actionStatus) - actionStatusRank(b.actionStatus);
    if (rs !== 0) return rs;
    const rp = priorityRank(a.priority) - priorityRank(b.priority);
    if (rp !== 0) return rp;
    return compareDueIso(a, b);
  });
}

export function sortTasksByDueDate(tasks: SpaTask[]): SpaTask[] {
  return [...tasks].sort((a, b) => compareDueIso(a, b));
}

export function sortTasksByCaseId(tasks: SpaTask[]): SpaTask[] {
  return [...tasks].sort(
    (a, b) =>
      a.linkedCaseId.localeCompare(b.linkedCaseId, "nl") || a.title.localeCompare(b.title, "nl"),
  );
}
