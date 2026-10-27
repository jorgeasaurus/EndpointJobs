export function closeDialogOnBackdrop(event: MouseEvent) {
  if (event.target !== event.currentTarget) return;
  const dialog = event.currentTarget;
  if (dialog instanceof HTMLDialogElement) dialog.close();
}
