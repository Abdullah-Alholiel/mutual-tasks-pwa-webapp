/**
 * Shared date helpers (no external deps).
 *
 * endOfToday exists so the task form's default due date and its tests can
 * never drift apart (L4d acceptance finding, run 26): the form's submit
 * button disables on `dueDate.getTime() < Date.now()`, so a "creation
 * moment" default bricks the button after any hesitation. End of today
 * (23:59:59.999 local) keeps "today" valid until midnight.
 */
export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Mirror of TaskForm's submit-button disabled rule: the button is disabled
 * when the (optional) due date is strictly before "now". Exported so the
 * acceptance tests pin the REAL semantics, not a copy.
 */
export function dueDateDisablesSubmit(dueDate: Date | undefined, now: number): boolean {
  return dueDate ? dueDate.getTime() < now : false;
}
