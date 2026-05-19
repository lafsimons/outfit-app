export default function PreviewOverlay({
  open,
  eyebrow = "Preview",
  title,
  meta = null,
  onClose,
  actions = null,
  children
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="floating-backdrop preview-overlay-backdrop" onClick={onClose}>
      <div
        className="preview-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title || eyebrow}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="preview-overlay-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            {meta ? <p className="preview-overlay-subtitle">{meta}</p> : null}
          </div>
          <div className="preview-overlay-header-actions">
            {actions}
            <button type="button" className="ghost-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="preview-overlay-body">{children}</div>
      </div>
    </div>
  );
}
