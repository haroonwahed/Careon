import type { SpaTask } from "../hooks/useTasks";

/** Open = not completed/cancelled bucket from `/care/api/tasks/` (matches Acties page list). */
export function isOpenCareTask(task: SpaTask): boolean {
  return task.actionStatus !== "completed";
}

export function countOpenCareTasks(tasks: SpaTask[]): number {
  return tasks.filter(isOpenCareTask).length;
}
