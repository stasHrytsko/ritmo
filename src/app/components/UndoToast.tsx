/**
 * Says what was just removed and offers it back for a few seconds. The bar
 * drains for exactly as long as the offer stands.
 */
export function UndoToast({
  label,
  durationMs,
  onUndo
}: {
  label: string;
  durationMs: number;
  onUndo: () => void;
}) {
  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span>{label}</span>
      <button type="button" onClick={onUndo}>Отменить</button>
      <i className="undo-toast-bar" style={{ animationDuration: `${durationMs}ms` }} />
    </div>
  );
}
