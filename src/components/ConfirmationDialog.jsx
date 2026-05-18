export default function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="floating-backdrop confirm-backdrop" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
        <div>
          <p className="eyebrow">Confirm</p>
          <h2>{title}</h2>
        </div>
        <p>{message}</p>
        <div className="confirm-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
