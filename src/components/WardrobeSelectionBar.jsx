import { useEffect, useRef, useState } from "react";

export default function WardrobeSelectionBar({
  inline = false,
  selectedCount,
  clearButtonLabel = null,
  separateClearButton = false,
  bulkCollectionDraft,
  bulkListDraft,
  collectionOptions,
  itemListOptions,
  setBulkCollectionDraft,
  setBulkListDraft,
  favoriteActionLabel,
  excludeActionLabel,
  onEdit,
  onClear,
  onMoveToList,
  onAddCollection,
  onRemoveCollection,
  onClearCollections,
  onFavoriteToggle,
  onExcludeToggle,
  onDelete,
  onCloseEdit
}) {
  const [activeAction, setActiveAction] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef(null);

  useEffect(() => {
    setActiveAction(null);
    setMenuOpen(false);
  }, [selectedCount]);

  useEffect(() => {
    if (!menuOpen && !activeAction) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (barRef.current?.contains(event.target)) {
        return;
      }

      setMenuOpen(false);
      setActiveAction(null);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [activeAction, menuOpen]);

  function preventPointerFocus(event) {
    if (event.detail !== 0) {
      event.preventDefault();
    }
  }

  return (
    <div ref={barRef} className={`wardrobe-selection-bar ${inline ? "is-inline" : ""}`.trim()} aria-label="Wardrobe selection">
      <div className="wardrobe-selection-summary">
        <div className="wardrobe-selection-count wardrobe-selection-chip">
          <span>{selectedCount} selected</span>
        </div>
        {separateClearButton && clearButtonLabel ? (
          <button
            type="button"
            className="ghost-button wardrobe-selection-done-button"
            onMouseDown={preventPointerFocus}
            onClick={onClear}
            aria-label={clearButtonLabel}
          >
            {clearButtonLabel}
          </button>
        ) : (
          <button
            type="button"
            className={`wardrobe-selection-clear wardrobe-selection-chip-clear ${clearButtonLabel ? "is-label" : ""}`.trim()}
            onMouseDown={preventPointerFocus}
            onClick={onClear}
            aria-label={clearButtonLabel || "Clear selection"}
          >
            {clearButtonLabel || "×"}
          </button>
        )}
        <div className="wardrobe-selection-actions wardrobe-toolbar-context-actions">
          <button
            type="button"
            className="secondary-button wardrobe-selection-edit-button"
            onMouseDown={preventPointerFocus}
            onClick={() => {
              setActiveAction(null);
              setMenuOpen(false);
              onEdit();
            }}
            disabled={!selectedCount}
          >
            Edit
          </button>
          <div className="wardrobe-selection-more">
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
            {menuOpen ? (
              <div className="wardrobe-selection-menu">
                <div className="wardrobe-selection-menu-section">
                  <button
                    type="button"
                    className={`ghost-button wardrobe-selection-menu-button ${activeAction === "status" ? "is-active" : ""}`}
                    onMouseDown={preventPointerFocus}
                    onClick={() => {
                      setActiveAction((current) => (current === "status" ? null : "status"));
                      setMenuOpen(true);
                    }}
                    disabled={!selectedCount}
                  >
                    Status
                  </button>
                  <button
                    type="button"
                    className={`ghost-button wardrobe-selection-menu-button ${activeAction === "collections" ? "is-active" : ""}`}
                    onMouseDown={preventPointerFocus}
                    onClick={() => {
                      setActiveAction((current) => (current === "collections" ? null : "collections"));
                      setMenuOpen(true);
                    }}
                    disabled={!selectedCount}
                  >
                    Collections
                  </button>
                </div>

                {activeAction ? (
                  <>
                    <div className="wardrobe-selection-menu-separator" aria-hidden="true" />
                    <div className="wardrobe-bulk-actions" aria-label="Selected item actions">
                      {activeAction === "status" ? (
                        <>
                          <p className="wardrobe-bulk-summary">{selectedCount} item{selectedCount === 1 ? "" : "s"} selected</p>
                          <div className="wardrobe-bulk-group">
                            <label className="wardrobe-bulk-tag-control">
                              <span>Assign status</span>
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
                        </>
                      ) : null}
                      {activeAction === "collections" ? (
                        <>
                          <p className="wardrobe-bulk-summary">{selectedCount} item{selectedCount === 1 ? "" : "s"} selected</p>
                          <div className="wardrobe-bulk-group wardrobe-bulk-collection-group">
                            <label className="wardrobe-bulk-tag-control">
                              <span>Collection</span>
                              <input
                                list="bulk-selection-collection-options"
                                value={bulkCollectionDraft}
                                onChange={(event) => setBulkCollectionDraft(event.target.value)}
                                placeholder="Summer, Travel, Workwear..."
                              />
                            </label>
                            <datalist id="bulk-selection-collection-options">
                              {collectionOptions.map((collection) => (
                                <option key={collection} value={collection} />
                              ))}
                            </datalist>
                            <div className="wardrobe-bulk-group wardrobe-bulk-collection-actions">
                              <button
                                type="button"
                                className="ghost-button"
                                onMouseDown={preventPointerFocus}
                                onClick={() => {
                                  onAddCollection(bulkCollectionDraft);
                                  setActiveAction(null);
                                  setMenuOpen(false);
                                }}
                                disabled={!selectedCount || !bulkCollectionDraft.trim()}
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                className="ghost-button"
                                onMouseDown={preventPointerFocus}
                                onClick={() => {
                                  onRemoveCollection(bulkCollectionDraft);
                                  setActiveAction(null);
                                  setMenuOpen(false);
                                }}
                                disabled={!selectedCount || !bulkCollectionDraft.trim()}
                              >
                                Remove
                              </button>
                              <button
                                type="button"
                                className="ghost-button"
                                onMouseDown={preventPointerFocus}
                                onClick={() => {
                                  onClearCollections();
                                  setActiveAction(null);
                                  setMenuOpen(false);
                                }}
                                disabled={!selectedCount}
                              >
                                Clear All
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}

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
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
