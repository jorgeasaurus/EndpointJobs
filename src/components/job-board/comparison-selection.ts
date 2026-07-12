export const maximumComparedJobs = 4;

export type ComparisonAction =
  | { type: "clear" }
  | { type: "remove"; jobId: string }
  | { type: "toggle"; jobId: string };

export function updateComparisonSelection(
  current: Set<string>,
  action: ComparisonAction
) {
  if (action.type === "clear") return new Set<string>();

  const next = new Set(current);

  if (action.type === "remove" || next.has(action.jobId)) {
    next.delete(action.jobId);
  } else if (next.size < maximumComparedJobs) {
    next.add(action.jobId);
  }

  return next;
}
