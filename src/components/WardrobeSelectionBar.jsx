import { useEffect, useState } from "react";

export default function WardrobeSelectionBar({
  inline = false,
  selectedCount,
  bulkListDraft,
  setBulkListDraft,
  itemListOptions,
  favoriteActionLabel,
  excludeActionLabel,
  onEdit,
  onClear,
  onMoveToList,
  onFavoriteToggle,
  onExcludeToggle,
  onDelete,
  onCloseEdit
}) {
  const [activeAction, setActiveAction] = useState(null);

  useEffect(() => {
    setActiveAction(null);
  }, [selectedCount]);

  return (
    <div className={`wardrobe-selection-bar ${inline ? "is-inline" : ""}`.trim()} aria-label="Wardrobe selection">
      <div className="wardrobe-selection-summary">
        <div className="wardrobe-selection-count">
          <span>{selectedCount} selected</span>
          <button type="button" className="wardrobe-selection-clear" onClick={onClear} aria-label="Clear selection">
            ×
          </button>
        </div>
        <div className="wardrobe-selection-actions">
          <button type="button" className="ghost-button" onClick={onEdit} disabled={!selectedCount}>
            Edit
          </button>
          <details className="wardrobe-selection-more">
            <summary className="ghost-button" aria-label="More selection actions">Actions ▾</summary>
            <div className="wardrobe-selection-menu">
              <div className="wardrobe-selection-menu-section">
                <button
                  type="button"
                  className="ghost-button wardrobe-selection-menu-button"
                  onClick={() => {
                    onFavoriteToggle();
                    setActiveAction(null);
                    onCloseEdit?.();
                  }}
                  disabled={!selectedCount}
                >
                  {favoriteActionLabel}
                </button>
                <button
                  type="button"
                  className={`ghost-button wardrobe-selection-menu-button ${activeAction === "list" ? "is-active" : ""}`}
                  onClick={() => setActiveAction("list")}
                  disabled={!selectedCount}
                >
                  List
                </button>
                <button
                  type="button"
                  className="ghost-button wardrobe-selection-menu-button"
                  onClick={() => {
                    onExcludeToggle();
                    setActiveAction(null);
                    onCloseEdit?.();
                  }}
                  disabled={!selectedCount}
                >
                  {excludeActionLabel}
                </button>
              </div>

              <div className="wardrobe-selection-menu-section wardrobe-selection-menu-section-danger">
                <button
                  type="button"
                  className="ghost-button wardrobe-selection-menu-button wardrobe-selection-menu-button-danger"
                  onClick={() => {
                    onDelete();
                    setActiveAction(null);
                    onCloseEdit?.();
                  }}
                  disabled={!selectedCount}
                >
                  Delete
                </button>
              </div>

              {activeAction ? (
                <div className="wardrobe-bulk-actions" aria-label="Selected item actions">
                  {activeAction === "list" ? (
                    <div className="wardrobe-bulk-group">
                      <label className="wardrobe-bulk-tag-control">
                        <span>Assign list</span>
                        <select value={bulkListDraft} onChange={(event) => setBulkListDraft(event.target.value)}>
                          {itemListOptions.map((list) => (
                            <option key={list} value={list}>{list}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          onMoveToList(bulkListDraft);
                          setActiveAction(null);
                        }}
                        disabled={!selectedCount || !bulkListDraft}
                      >
                        Apply
                      </button>
                    </div>
                  ) : null}

                </div>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
