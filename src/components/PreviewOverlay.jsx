import DismissibleBackdrop from "./DismissibleBackdrop";

export default function PreviewOverlay({
  open,
  eyebrow = "Preview",
  title,
  meta = null,
  onClose,
  closeLabel = "Close",
  closeAriaLabel = null,
  actions = null,
  children
}) {
  if (!open) {
    return null;
  }

  const showBackStyleClose = closeLabel === "<";
  const closeButton = (
    <button
      type="button"
      className={`ghost-button ${showBackStyleClose ? "preview-overlay-close-button is-back" : "preview-overlay-close-button"}`.trim()}
      onClick={onClose}
      aria-label={closeAriaLabel || closeLabel}
    >
      {closeLabel}
    </button>
  );

  return (
    <DismissibleBackdrop className="floating-backdrop preview-overlay-backdrop" onDismiss={onClose}>
      <div
        className="preview-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title || eyebrow}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="preview-overlay-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2>{title}</h2>
            {meta ? <p className="preview-overlay-subtitle">{meta}</p> : null}
          </div>
          <div className="preview-overlay-header-actions">
            {showBackStyleClose ? closeButton : null}
            {actions}
            {showBackStyleClose ? null : closeButton}
          </div>
        </div>
        <div className="preview-overlay-body">{children}</div>
      </div>
    </DismissibleBackdrop>
  );
}
