export default function WardrobeSelectionBar({
  selectedCount,
  bulkListDraft,
  setBulkListDraft,
  bulkStyleTagDraft,
  setBulkStyleTagDraft,
  bulkClimateTagDraft,
  setBulkClimateTagDraft,
  itemListOptions,
  styleTagOptions,
  editableClimateTagOptions,
  onEdit,
  onClear,
  onDone,
  onMoveToList,
  onFavorite,
  onUnfavorite,
  onDelete,
  onAddStyle,
  onRemoveStyle,
  onAddClimate,
  onRemoveClimate
}) {
  return (
    <div className="wardrobe-selection-bar" aria-label="Wardrobe selection">
      <div className="wardrobe-selection-summary">
        <strong className="wardrobe-selection-count">{selectedCount} selected</strong>
        <div className="wardrobe-selection-actions">
          <button type="button" className="ghost-button" onClick={onEdit} disabled={selectedCount !== 1}>
            Edit
          </button>
          <button type="button" className="ghost-button" onClick={onFavorite} disabled={!selectedCount}>
            Favorite
          </button>
          <button type="button" className="ghost-button" onClick={onUnfavorite} disabled={!selectedCount}>
            Unfavorite
          </button>
          <button type="button" className="ghost-button danger" onClick={onDelete} disabled={!selectedCount}>
            Delete
          </button>
          <button type="button" className="ghost-button" onClick={onClear} disabled={!selectedCount}>
            Clear
          </button>
          <button type="button" className="ghost-button" onClick={onDone}>
            Done
          </button>
        </div>
      </div>

      <div className="wardrobe-bulk-actions" aria-label="Selected item actions">
        <div className="wardrobe-bulk-group">
          <label className="wardrobe-bulk-tag-control">
            <span>Move</span>
            <select value={bulkListDraft} onChange={(event) => setBulkListDraft(event.target.value)}>
              {itemListOptions.map((list) => (
                <option key={list} value={list}>{list}</option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={() => onMoveToList(bulkListDraft)} disabled={!selectedCount || !bulkListDraft}>
            Apply
          </button>
        </div>

        <div className="wardrobe-bulk-group">
          <label className="wardrobe-bulk-tag-control">
            <span>Style</span>
            <select value={bulkStyleTagDraft} onChange={(event) => setBulkStyleTagDraft(event.target.value)}>
              {styleTagOptions.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={onAddStyle} disabled={!selectedCount || !bulkStyleTagDraft}>
            Add
          </button>
          <button type="button" className="ghost-button" onClick={onRemoveStyle} disabled={!selectedCount || !bulkStyleTagDraft}>
            Remove
          </button>
        </div>

        <div className="wardrobe-bulk-group">
          <label className="wardrobe-bulk-tag-control">
            <span>Climate</span>
            <select value={bulkClimateTagDraft} onChange={(event) => setBulkClimateTagDraft(event.target.value)}>
              {editableClimateTagOptions.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={onAddClimate} disabled={!selectedCount || !bulkClimateTagDraft}>
            Add
          </button>
          <button type="button" className="ghost-button" onClick={onRemoveClimate} disabled={!selectedCount || !bulkClimateTagDraft}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
