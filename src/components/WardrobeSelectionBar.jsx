import { useEffect, useRef, useState } from "react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setActiveAction(null);
    setMenuOpen(false);
  }, [selectedCount]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (menuRef.current?.contains(event.target)) {
        return;
      }

      setMenuOpen(false);
      setActiveAction(null);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [menuOpen]);

  function preventPointerFocus(event) {
    if (event.detail !== 0) {
      event.preventDefault();
    }
  }

  return (
    <div className={`wardrobe-selection-bar ${inline ? "is-inline" : ""}`.trim()} aria-label="Wardrobe selection">
      <div className="wardrobe-selection-summary">
        <div className="wardrobe-selection-count wardrobe-selection-chip">
          <span>{selectedCount} selected</span>
          <button
            type="button"
            className="wardrobe-selection-clear wardrobe-selection-chip-clear"
            onMouseDown={preventPointerFocus}
            onClick={onClear}
            aria-label="Clear selection"
          >
            ×
          </button>
        </div>
        <div className="wardrobe-selection-actions wardrobe-toolbar-context-actions">
          <button
            type="button"
            className="secondary-button wardrobe-selection-edit-button"
            onMouseDown={preventPointerFocus}
            onClick={() => {
              setMenuOpen(false);
              setActiveAction(null);
              onEdit();
            }}
            disabled={!selectedCount}
          >
            Edit
          </button>
          <div ref={menuRef} className="wardrobe-selection-more">
            <button
              type="button"
              className={`ghost-button wardrobe-selection-actions-trigger ${menuOpen || activeAction ? "is-active" : ""}`}
              aria-label="More selection actions"
              aria-expanded={menuOpen || Boolean(activeAction)}
              aria-haspopup="menu"
              onMouseDown={preventPointerFocus}
              onClick={() => {
                setActiveAction(null);
                setMenuOpen((current) => !current);
              }}
              disabled={!selectedCount}
            >
              Actions ▾
            </button>
            {menuOpen || activeAction ? (
              <div className="wardrobe-selection-menu">
              <div className="wardrobe-selection-menu-section">
                <button
                  type="button"
                  className={`ghost-button wardrobe-selection-menu-button ${activeAction === "list" ? "is-active" : ""}`}
                  onMouseDown={preventPointerFocus}
                  onClick={() => setActiveAction("list")}
                  disabled={!selectedCount}
                >
                  List
                </button>
              </div>

              <div className="wardrobe-selection-menu-separator" aria-hidden="true" />

              <div className="wardrobe-selection-menu-section">
                <button
                  type="button"
                  className="ghost-button wardrobe-selection-menu-button"
                  onMouseDown={preventPointerFocus}
                  onClick={() => {
                    onFavoriteToggle();
                    setActiveAction(null);
                    setMenuOpen(false);
                    onCloseEdit?.();
                  }}
                  disabled={!selectedCount}
                >
                  {favoriteActionLabel}
                </button>
                <button
                  type="button"
                  className="ghost-button wardrobe-selection-menu-button"
                  onMouseDown={preventPointerFocus}
                  onClick={() => {
                    onExcludeToggle();
                    setActiveAction(null);
                    setMenuOpen(false);
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
                  onMouseDown={preventPointerFocus}
                  onClick={() => {
                    onDelete();
                    setActiveAction(null);
                    setMenuOpen(false);
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
                        onMouseDown={preventPointerFocus}
                        onClick={() => {
                          onMoveToList(bulkListDraft);
                          setActiveAction(null);
                          setMenuOpen(false);
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
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
